/*
Copyright 2012 Timothy J Fontaine <tjfontaine@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN

*/

'use strict';

var winston = require('winston');

var MemoryStore = exports.MemoryStore = function (opts) {
  this._store = {};
};

MemoryStore.prototype.get = function (domain, key, type, cb) {
  winston.debug('MemoryStore get: ' + [domain, key, type].join(', '));
  var d = domain.toLowerCase();
  var k = key.toLowerCase();
  var result = this._store[d];

  if (result)
    result = result[k];

  if (result)
    result = result[type];

  process.nextTick(function () {
    cb(null, result);
  });
};

MemoryStore.prototype.set = function (domain, key, type, data, cb) {
  winston.debug('MemoryStore set: ' + [domain, key, type, data].join(', '));
  var d = domain.toLowerCase();
  var k = key.toLowerCase();
  var result_domain = this._store[d];
  var result_key, result;

  if (!result_domain)
    result_domain = this._store[d] = {};

  result_key = result_domain[k];

  if (!result_key)
    result_key = result_domain[k] = {};

  result = result_key[type];

  if (!result)
    result = result_key[type] = [];

  result.push(data);

  process.nextTick(function () {
    cb(null, result);
  });
};

MemoryStore.prototype.delete = function (domain, cb) {
  delete this._store[domain.toLowerCase()];

  process.nextTick(function () {
    cb(null, domain);
  });
};
