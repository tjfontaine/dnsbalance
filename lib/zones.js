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

var dns = require('native-dns');
var MemoryStore = require('./memory').MemoryStore;
var utils = require('./utils');
var winston = require('winston');

var Zones = exports.Zones = function (opts) {
  opts = opts || {};
  this._store = opts.store || new MemoryStore();
  this._zones = {};
};

Zones.prototype.have = function (domain) {
  var zone, name, z;
  var parts = domain.toLowerCase().split('.');

  while (parts.length) {
    zone = parts.join('.');

    z = this._zones[zone];

    winston.debug('have zone:', [zone, z, parts, Object.keys(this._zones)]);
    if (z) {
      return z;
    }

    if (!name)
      name = '';
    else
      name += '.';

    name += parts[0];

    parts.splice(0, 1);
  }
};

var NAME_TO_QTYPE = dns.consts.NAME_TO_QTYPE;
var QTYPE_TO_NAME = dns.consts.QTYPE_TO_NAME;
var CNAME = NAME_TO_QTYPE.CNAME;

Zones.prototype.lookup = function (question, zone, cb) {
  var name = utils.ensure_absolute(question.name);
  //var zone = this.have(name);

  var self = this;

  if (!zone) {
    process.nextTick(function () {
      cb(null, null);
    });
    return;
  }

  var results;

  function found (err, r) {
    if (err) {
      cb(err, results);
    } else if (r) {
      if (r[question.type]) {
        if (!results)
          results = [];
        results = results.concat(r[question.type]);
        cb(null, results);
      } else if (r[CNAME]) {
        if (!results)
          results = [];
        results = results.concat(r[CNAME]);
        name = r[CNAME][0].data;
        self._store.get(zone.name, name, found);
      } else {
        cb(null, results);
      }
    } else {
      cb(null, results);
    }
  }

  this._store.get(zone.name, name, found);
};

Zones.prototype.add = function (zone, cb) {
  var i = -1;
  var self = this;
  var qualified = zone.name = utils.ensure_absolute(zone.name);
  var is_qualified = new RegExp(qualified + '$', 'i');
  var z = {};

  Object.keys(zone).forEach(function (k) {
    if (k != 'records')
      z[k] = zone[k];
  });

  winston.debug('adding zone', [z]);
  this._zones[qualified] = z;

  function complete (err, result) {
    i += 1;

    var record = zone.records[i];
    var rrname;
    var type;

    if (record) {
      type = record.type

      if (!isNaN(type))
        type = QTYPE_TO_NAME[type];

      record.type = type.toUpperCase();

      record = dns[record.type](record);

      if (!record.name || record.name == '@')
        record.name = qualified;

      if (!is_qualified.test(record.name))
        record.name = record.name + '.' + qualified;

      self._store.set(qualified, record.name, record.type, record, complete);
    } else {
      cb(err, null);
    }
  };

  process.nextTick(function () {
    if (zone.records) {
      complete();
    } else {
      cb(null, null);
    }
  });
};

Zones.prototype.delete = function (zone, cb) {
  if (!this._zones[zone]) {
    process.nextTick(function () {
      cb(null, null);
    });
    return;
  }

  delete this._zones[zone];
  this._store.delete(domain, cb);
};
