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

var EventEmitter = require('events').EventEmitter,
  check = require('range_check'),
  dns = require('native-dns'),
  util = require('util'),
  utils = require('./utils'),
  winston = require('winston'),
  NAME_TO_RCODE = dns.consts.NAME_TO_RCODE;

var ServerRequest = module.exports = function (cfg, req, res) {
  this.cfg = cfg;
  this.req = req;
  this.res = res;
  this.question = req.question[0];
  this.zones = cfg.zones;
  this.zone = undefined;
  this.forwarders = cfg.forwarders;
  this._found = false;
  this._done = false;
  this._stop = false;
  this._cache = false;
}
util.inherits(ServerRequest, EventEmitter);

ServerRequest.prototype.done = function () {
  if (!this._done) {
    this._done = true;
    this._stop = true;
    this.emit('done', this._cache);
  }
};

ServerRequest.prototype.forbidden = function () {
  if (!this._stop) {
    this._stop = true;
    this.emit('forbidden');
    this.done();
  }
};

ServerRequest.prototype.failure = function () {
  if (!this._stop) {
    this._stop = true;
    this.emit('failure');
    this.done();
  }
};

ServerRequest.prototype.results = function (error, results) {
  if (!this._stop) {
    this._stop = true;

    if (error) {
      this.emit('error', error);
    } else {
      if (results) {
        this.emit('results', results);
      } else {
        this.emit('notfound');
      }
    }

    this.done();
  }
};

ServerRequest.prototype.start = function () {
  var next, aclname, acl, address, i, ip, found;

  this.question.name = utils.ensure_absolute(this.question.name);

  this.zone = this.zones.have(this.question.name);

  if (!this.zone) {
    winston.debug('Not our zone', [this.question.name]);

    address = this.req._socket._remote.address;

    for (aclname in this.cfg.acl) {
      acl = this.cfg.acl[aclname];

      if (!(acl.ip instanceof Array))
        acl.ip = [acl.ip];

      for (i in acl.ip) {
        ip = acl.ip[i];
        if (ip == address || check.in_range(address, ip)) {
          found = true;
          break;
        }
      }

      if (found)
        break;
    }

    winston.debug('Recursion', [found, acl]);
    if (found && acl.recursion) {
      next = this.recurse;
    } else {
      this.forbidden();
      return;
    }
  } else if (this.zone.type == 'forward') {
    this.forwarders = this.zone.forwarders;
    next = this.recurse;
  } else {
    next = this.local;
  }

  this.cfg.cache.lookup(this.question, this.cacheHit.bind(this, next));
};

ServerRequest.prototype.cacheHit = function (next, results) {
  winston.debug('cache', [arguments]);
  if (results && results.length) {
    winston.debug('cache hit', [results]);
    this._cache = true;
    this.results(null, results);
  } else {
    winston.debug('cache miss');
    next.call(this);
  }
};

ServerRequest.prototype.local = function () {
  this.zones.lookup(this.question, this.zone, this.results.bind(this));
};

ServerRequest.prototype.recurse = function () {
  var self = this;
  var server = this.forwarders.splice(0, 1)[0];

  winston.debug('Send request upstream:', [server]);

  var r = dns.Request({
    question: this.question,
    server: server,
  })
  .on('timeout', function () {
    self.failure();
  })
  .on('message', function (err, packet) {
    self.cfg.cache.store(packet);
    self.results(err, packet.answer);
  })
  .send();

  this.forwarders.push(server);
};
