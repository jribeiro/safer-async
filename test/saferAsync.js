#!/usr/bin/env node

/*!
 * async
 * https://github.com/jribeiro/saferAsync
 *
 * Copyright 2015 Joao Ribeiro
 * Released under the MIT license
 */

//var reporter = require('nodeunit').reporters.default;
var async = require('../lib/saferAsync');

var asyncTests = require('../async/test/test-async');
var _ = require('lodash');

delete asyncTests['noConflict - node only']

_.each(asyncTests, function (fn, key) {

    exports[key] = fn;
});