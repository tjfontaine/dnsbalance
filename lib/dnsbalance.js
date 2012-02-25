/*
Copyright 2011 Timothy J Fontaine <tjfontaine@gmail.com>

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

var EventEmitter = require('events').EventEmitter,
  net = require('net'),
  util = require('util'),
  Hash = require('hashish'),
  winston = require('winston'),
  ServerRequest = require('./serverrequest'),
  dns = require('native-dns'),
  consts = dns.consts;

var DNSBalance = function (options) {
  var self = this;
  this._listeners = {};
  this._db = options.db;
  this.host = options.host;

  if (options.query) {
    options.query.forEach(function (l) {
      self.addInterface(l.ip, l.port);
    });
  }
};
util.inherits(DNSBalance, EventEmitter);

DNSBalance.prototype.formatInterface = function (ip, port) {
  return '[' + ip + ']:' + port;
};

DNSBalance.prototype.addInterface = function (ip, port) {
  var server, self = this;
  
  server = dns.createServer('udp4');
  winston.info('Adding Query Interface: ' + [ip, port].join(':'));
  server.bind(port, ip);

  server.on('request', function (req, res) {
    ServerRequest(self._db, req, res)
      .hasQuery()
      .isAllowed()
      //.handleNonQuery()
      .Policy(function (name, ttl, nodes) {
        winston.info('Policy', name, ttl);
        nodes.forEach(function (node) {
          node.last_used = new Date().getTime();
          res.answer.push(node.toRR(name, ttl));
        });
      })
      .fail(function (err) {
        winston.info('Failure', res.question[0].name, header.id);
        if (err) {
          winston.error(err.stack);
          res.header.rcode = consts.NAME_TO_RCODE.SERVFAIL;
          res.clearResources();
        }
      })
      .notfound(function (err) {
        winston.info('Not found', res.question[0].name, res.header.id);
        if (err) {
          winston.error(err.stack);
          res.header.rcode = consts.NAME_TO_RCODE.NOTFOUND;
          res.clearResources();
        }
      })
      .done(function () {
        winston.info("Finished request", res.header.id);
        res.send();
      });
  });

  this._listeners[this.formatInterface(ip, port)] = server;
};

DNSBalance.prototype.removeInterface = function (ip, port) {
  var key, server;

  key = this.formatInterface(ip, port);
  server = this._listeners[key];

  server.close();

  this._listeners[key] = undefined;
  delete this._listeners[key];
};

module.exports = DNSBalance;
