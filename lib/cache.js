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

var MemoryStore = require('./memory').MemoryStore;
var Lookup = require('./utils').Lookup;
var Heap = require('binaryheap');
var winston = require('winston');

var Cache = module.exports = function (opts) {
  opts = opts || {};
  this._store = opts.store || new MemoryStore();
  this._zone = '.' || opts.zone;
  this._max_keys = opts.max_keys || 1000;
  this._lru = new Heap(true);
  this._lru_keys = {};
  this._gc = setInterval(this.gc.bind(this), opts.gc || 60 * 1000);
  this._gc.unref();
  this._in_gc = false;
};

Cache.prototype.gc = function () {
  if (this._in_gc)
    return;

  winston.debug('cache gc started');

  this._in_gc = true;

  var self = this;
  var toremove = [];
  var k;

  while (Object.keys(this._lru_keys).length > this._max_keys) {
    k = this._lru.pop().name;
    delete this._lru_keys[k.toLowerCase()];
    toremove.push(k);
  }

  function cleanCache() {
    if (!toremove.length) {
      winston.debug('cache gc done');
      self._in_gc = false;
      return;
    }

    var key = toremove.pop();
    winston.debug('cache delete', [key]);
    self._store.delete(self._zone, key, cleanCache);
  }

  cleanCache();
};

Cache.prototype.store = function (packet) {
  var self = this;
  var now = Date.now();
  var c = {};

  function each(record) {
    var r = c[record.name.toLowerCase()];
    var t;

    if (!r)
      r = c[record.name.toLowerCase()] = {};

    t = r[record.type];

    if (!t)
      t = r[record.type] = [];

    record._ttl_expires = (record.ttl * 1000) + now;

    t.push(record);
  }

  packet.answer.forEach(each);
  packet.authority.forEach(each);
  packet.additional.forEach(each);  

  Object.keys(c).forEach(function (key) {
    var lru = self._lru_keys[key];

    if (lru)
      self._lru.remove(lru);
    else
      lru = self._lru_keys[key] = {
        name: key,
      };

    self._lru.insert(lru, now);

    self._store.delete(self._zone, key, function () {
      winston.debug('cache delete and store', [key]);
      self._store.set(self._zone, key, c[key]);
    });
  });
};

Cache.prototype.lookup = function (question, cb) {
  var self = this;
  winston.debug('cache lookup', [question]);
  Lookup(this._store, this._zone, question, function (err, results) {
    var now = Date.now();
    var i, rr, lru;
    var r = results;
    var shouldPurge = {};

    if (results) {
      for (i = 0; i < results.length; i++) {
        rr = results[i];

        if (rr._ttl_expires < now) {
          shouldPurge[rr.name.toLowerCase()] = true;
        } else {
          lru = self._lru_keys[rr.name.toLowerCase()];
          winston.debug('cache lru update', [self._lru_keys, lru]);
          self._lru.remove(lru);
          self._lru.insert(lru, now);
        }
      }
    }

    if (Object.keys(shouldPurge).length) {
      winston.debug('caching purging', Object.keys(shouldPurge));
      r = undefined;
      Object.keys(shouldPurge).forEach(function (name) {
        var lru = self._lru_keys[name.toLowerCase()];
        self._lru.remove(lru);
        delete self._lru_keys[name.toLowerCase()];
        self._store.delete(self._zone, name);
      });
    }

    cb(r);
  });
};
