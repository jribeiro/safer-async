/*!
 * saferAsync
 * https://github.com/jribeiro/saferAsync
 *
 * Copyright 2015 Joao Ribeiro
 * Released under the MIT license
 *
 */
(function saferAsync() {
    'use strict';

    /**
     * Dependencies
     *
     * @type {Object}
     */
    var libs = {
        domain: require('domain'),
        async: require('async'),
        _: require('lodash')
    };

    /**
     * saferAsync internal functions
     *
     * @type {Object}
     */
    var internals = {

        /**
         * A number, or a string containing a number.
         *
         * @typedef {Object} Options
         *
         * @property {Function} startTaskCB - called when a task has started
         * @property {Function} endTaskCB - called when a task has finished
         * @property {Function} errorCB - error callback for exceptions. By default writes the error message and
         *                                stacktrace to stderr
         * @property {number} timeout - timeout for the task in ms. Pass 0 for no timeout. Default: 0
         * @property {Function} timeoutCB - called if a given task timesout
         */
        options: {

            /**
             * Function to be called when a task starts. If a
             *
             * @param {{name: String, deps: Array}} task - object containing information about the task
             *
             * @returns {*} [startValue] - if a value is returned it will be saved and passed to the endTaskCB.
             */
            startTaskCB: function startTaskCB (task) {},

            /**
             * Function to be called when the task ends
             *
             * @param {{name: String, deps: Array}} task - object containing information about the task
             * @param {*} [startValue] - return value of the startTaskCB function.
             * @param {*} error - error object returned by the function
             * @param {...*} [result] - the result of the task. This may be one or more arguments as per specified
             * on the async docs
             *
             * @returns {void}
             */
            endTaskCB: function endTaskCB (task, startValue, error, result) {},

            /**
             * Callback to be called if an error occurs
             *
             * @param {Error} err
             */
            errorCB: function errorCB (err) {

                console.error('Error running async task', err.msg, err.stack);
            },

            /**
             * Timeout value of each task.
             *
             * @type {number}
             */
            timeout: 0,

            /**
             *
             * @param {{name: String, deps: Array}} task - object containing information about the task
             * @param {Function} wrappedCB - the callback function which timedout
             *
             * @returns {void}
             */
            timeoutCB: function timeoutCB (task, wrappedCB) {}
        },

        /**
         * Creates a domain and binds the error function.
         *
         * @param options
         *
         * @returns {Object}
         */
        createDomain: function createDomain (options) {

            var domain = libs.domain.create();
            domain.on('error', options.errorCB);

            return domain;
        },

        /**
         * Wraps a task with the control functions
         *
         * @param {Options} options - object containing the default options extended by the task specified options
         * @param {Array|Function} value - task to be wrapped
         * @param {String} key - task name
         * @param {Object} tasks - list of tasks
         *
         * @returns {void}
         */
        handleTask: function handleTask (options, value, key, tasks) {

            var taskArr = libs._.isArray(value) ? value : [value];
            var task = internals.createTaskObject(options, taskArr, key);

            taskArr[taskArr.length - 1] = internals.wrapTask(task);
            tasks[key] = taskArr.length > 1 ? taskArr : taskArr[0];
        },

        /**
         * Task
         *
         * @typedef {Object} Task
         *
         * @property {String} name - task name
         * @property {Array} deps - task dependencies
         * @property {Function} fn - Original task function
         * @property {Options} options - default options extended with optional custom options
         * @property {number} [timeout] - timeout id. only set if the timeout is set to bigger than 0 in the options
         */
        /**
         * Converts the task array to an object to be passed through the callbacks
         *
         * @param {Options} options
         * @param {Array} taskArr - task
         * @param {String} key - task name
         *
         * @returns {Task}
         */
        createTaskObject: function createTaskObject (options, taskArr, key) {

            return {
                name: key,
                deps: taskArr.slice(0, -1),
                fn: taskArr[taskArr.length - 1],
                options: options,
                timeout: null
            }
        },

        /**
         * Wraps the original task
         *
         * @param {Task} task - task to be wrapped
         *
         * @returns {Function}
         */
        wrapTask: function wrapTask (task) {
            var counter = 0;

            /**
             * Function which will replace the original task function. It is responsible for creating another function
             * which will: trigger startTaskCB; call the original function with the wrapped callback and bind the
             * timeout if active
             *
             * @param {Function} callback - function passed from asyncjs as the callback function. this will be wrapped
             * @param {*} results
             *
             * @returns {void}
             */
            return function wrappedTask (callback, results) {

                if (counter === 1) {
                    throw new Error('Error in task: ' + task.name + ' - Function called multiple times. Aborting');
                }

                counter += 1;

                // call the start callback and save it's return value which will be passed to the endTaskCB
                task.startObject = task.options.startTaskCB({
                    name: task.name,
                    deps: task.deps
                });

                var wrappedCB = internals.wrapCB(task, callback);

                task.fn(wrappedCB, results);
                internals.bindCallbackTimeout(task, wrappedCB);
            }
        },

        /**
         * Wraps the callback function
         *
         * @param {Task} task
         * @param {Function} callback - original callback
         *
         * @returns {Function}
         */
        wrapCB: function wrapCB (task, callback) {

            var counter = 0;

            /**
             * Function to be passed to the original task function instead of the original async function
             *
             * @param {*} error
             * @param {*} params
             *
             * @returns {void}
             */
            return function wrappedCallback (error, params) {

                if (counter === 1) {
                    throw new Error('Error in task: ' + task.name + ' - Callback called multiple times. Aborting');
                }

                counter += 1;

                // call the end callback
                task.options.endTaskCB({
                    name: task.name,
                    deps: task.deps
                }, task.startObject, arguments);

                clearTimeout(task.timeout);
                callback.apply(this, arguments);
            }
        },

        /**
         * Binds the task timeout
         *
         * @param {Task} task
         * @param {Function} wrappedCB
         *
         * @returns {void}
         */
        bindCallbackTimeout: function bindCallbackTimeout (task, wrappedCB) {

            if (!task.options.timeout) {
                return;
            }

            task.timeout = setTimeout(
                internals.timeoutHandler.bind(this, task, wrappedCB),
                task.options.timeout
            );
        },

        /**
         * Handles the task timeout. This is just another wrapper on top of the passed timeout function to make sure the
         * timeoutId is cleared.
         *
         * @param task
         * @param
         *
         * @returns {void}
         */
        timeoutHandler: function timeoutHandler (task, wrappedCB) {

            clearTimeout(task.timeout);
            task.options.timeoutCB(task, wrappedCB);
        }
    };

    var api = {

        /**
         * Sets the default options for the wrapper
         *
         * @param options
         *
         * @returns {Options}
         */
        defaults: function defaults (options) {

            return internals.options = libs._.extend({}, internals.options, options);
        },

        /**
         * Auto function
         *
         * @param {Object} tasks - tasks list as defined by async docs
         * @param {Function} callback - finish flow function as described in the docs
         * @param {Options} [_options] - optional options object
         *
         * @returns {void}
         */
        auto: function (tasks, callback, _options) {

            var options = libs._.extend({} , internals.options, _options);
            var domain = internals.createDomain(options);

            /**
             * Wraps the passed tasks and calls async.auto
             *
             * @param options
             * @param tasks
             * @param callback
             */
            var run = function (options, tasks, finishCB) {

                libs._.each(tasks, internals.handleTask.bind(this, options));
                libs.async.auto(tasks, finishCB);
            };

            /**
             * Finishes the flow
             *
             * @param callback
             * @param domain
             * @param error
             * @param result
             */
            var finish = function (callback, domain, error, result) {

                if (libs._.isFunction(callback)) {

                    var args = Array.prototype.slice.call(arguments, 2);
                    callback.apply(this, args);
                }

                domain.exit();
            };

            domain.run(run.bind(
                this,
                options,
                tasks,
                finish.bind(this, callback, domain)
            ));
        }
    };

    module.exports = libs._.extend({}, libs.async, api);
})();