#!/usr/bin/env node

/*!
 * async
 * https://github.com/jribeiro/safer-async
 *
 * Copyright 2015 Joao Ribeiro
 * Released under the MIT license
 */

var loadModule = require('./loadModule');
var saferAsync = require('../lib/saferAsync');

var asyncTests = loadModule(__dirname + '/../async/test/test-async.js', {
    '../lib/async': saferAsync
});

/*var asyncTests = {
    exports: {}
}*/

var resetOptions = function () {
    saferAsync.defaults({
        startTaskCB: function () {},
        endTaskCB: function () {},
        errorCB: function (err) {
            console.error('Error running async task', err.msg, err.stack);
        },
        timeout: 0,
        timeoutCB: function () {}
    });
};

asyncTests.exports['saferAsync'] = {

    defaults: {

        tearDown: function (callback) {

            resetOptions();
            callback();
        },

        'properties are set': function (test) {
            var options = saferAsync.defaults({
                startTaskCB: function () {
                    test.ok(true);
                },
                endTaskCB: function () {
                    test.ok(true);
                },
                errorCB: function () {
                    test.ok(true);
                },
                timeout: 300,
                timeoutCB: function () {
                    test.ok(true);
                    test.done();
                }
            });

            options.startTaskCB();
            options.endTaskCB();
            options.errorCB();
            test.equals(options.timeout, 300);
            options.timeoutCB();
        }

    },

    auto: {

        'start and finish callbacks are called': function (test) {

            test.expect(3);

            var startCalls = [],
                endCalls = [],
                startValuesTotal = 0;

            var startTaskCb = function (task) {
                startCalls.push(task.name);
                return 1;
            };

            var endTasksCb = function (task, startValue) {
                startValuesTotal += startValue;
                endCalls.push(task.name);
            };

            var options = {
                startTaskCB: startTaskCb,
                endTaskCB: endTasksCb
            };

            saferAsync.auto({
                task1: ['task2', function(callback){
                    setTimeout(function(){
                        callback();
                    }, 25);
                }],
                task2: function(callback){
                    setTimeout(function(){
                        callback();
                    }, 50);
                }
            },
            function(){
                test.same(startCalls, ['task2','task1']);
                test.same(endCalls, ['task2','task1']);
                test.equals(startValuesTotal, 2);

                resetOptions();
                test.done();
            }, options);
        },

        'timeout is triggered': function (test) {

            test.expect(2);

            var timeoutCB = function (task, wrappedCB) {
                test.equals(task.name, 'task2');
                wrappedCB('timeout')
            };

            var options = {
                timeout: 100,
                timeoutCB: timeoutCB
            };

            saferAsync.auto({
                task1: ['task2', function(callback){
                    setTimeout(function(){
                        callback();
                    }, 25);
                }],
                task2: function(callback){
                    setTimeout(function(){
                        callback();
                    }, 150);
                }
            }, function (error) {
                test.equals(error, 'timeout');
                test.done();
                resetOptions();
            }, options);
        }
    }
};

module.exports = asyncTests.exports;
