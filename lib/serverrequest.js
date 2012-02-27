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

"use strict";

var Chainsaw = require('chainsaw'),
  clone = require('clone'),
  util = require('util'),
  winston = require('winston'),
  qtypeToName = require('native-dns').consts.qtypeToName;

var cache = {};

setInterval(function () {
  Object.keys(cache).forEach(function (c) {
    var entry, now;
    entry = cache[c];
    now = new Date().getTime();
    if (now - c.ttl > 0) {
      delete cache[c];
    }
  });
}, 300);

var ServerRequest = module.exports = function (db, req, res) {
  var err,
    question,
    original_name,
    qhash,
    resource_name,
    domain,
    resource;

  question = req.question[0];
  original_name = question.name;
  qhash = question.name + question.type + question.class;

  return Chainsaw(function (saw) {
    this.fail = function (cb) {
      cb(err);
      saw.down('done');
      saw.next();
    };

    this.notfound = function (cb) {
      cb(err);
      saw.down('done');
      saw.next();
    };

    this.done = function (cb) {
      if (!err && !cache[qhash]) {
        cache[qhash] = {
          ttl: new Date().getTime() + 60000,
          res: this.resource,
        }
      }
      cb();
    };

    this.hasDomain = function (zones) {
      var zonename, zoneid, parts, temp_resource;

      parts = original_name.split('.').map(function (n) { return n.toLowerCase(); });

      while (parts.length) {
        zonename = parts.join('.');
        zoneid = zones[zonename];

        if (zoneid) {
          resource_name = temp_resource;
          domain = zoneid;
          break;
        }

        if (!temp_resource)
          temp_resource = '';
        else
          temp_resource += '.';

        temp_resource += parts[0];

        parts.splice(0, 1);
      }

      if (!domain) {
        err = new Error("Not a hosted domain: " + original_name);
        saw.down('notfound');
      } else if (!resource_name) {
        resource_name = '@';
      }

      saw.next();
    };

    this.inCache = function () {
      var c = cache[qhash], now;
      if (c) {
        now = new Date().getTime();
        if (now - c.ttl < 0) {
          this.resource = c.res;
          saw.down('isAllowed');
        } else {
          delete cache[qhash];
        }
      }
      saw.next();
    };

    this.hasQuery = function () {
      var self = this;

      db.Zone.findOne()
        .where('_id', domain)
        .where('resources.name', resource_name)
        .where('resources.type', qtypeToName(question.type))
        .run(function (error, data) {
          if (error) {
            err = error;
            saw.down('fail');
          } else if (data) {
            resource = data.resources[0];
          } else {
            err = new Error("Not found: " + original_name + " (" + resource_name + ")");
            saw.down('notfound');
          }
          saw.next();
        });
    };

    this.isAllowed = function () {
      saw.next();
    };

    this.Policy = function (cb) {
      //winston.info('Resource is:', this.resource.name);
      if (!resource) {
        saw.down('notfound');
      } else {
        var nodes = resource.nodes;

      //this.resource.handler(req, nodes, function (results) {
        cb(original_name, parseInt(resource.ttl), nodes);
        saw.down('done');
      //});
      }
      saw.next();
    };

    this.handleNonQuery = function () {
      switch (question.type) {
        case consts.NAME_TO_QTYPE.AXFR:
          saw.down('done');
          break;
        default:
          break;
      }
      saw.next();
    };
  });
};
