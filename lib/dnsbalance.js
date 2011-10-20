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

var EventEmitter = require('events').EventEmitter;
var net = require('net');
var util = require('util');

var Hash = require('hashish');
var winston = require('winston');

var DNSZone = require('./dnszone');
var dns = require('./node-dns/dns');
var consts = require('./node-dns/lib/consts');

var addNode = function (question, resource, node) {
  var i, ip, rr, type;

  node.last_used = new Date().getTime();

  for (i in node.ips) {
    if (node.ips.hasOwnProperty(i)) {
      ip = node.ips[i];
      rr = undefined;
      type = net.isIP(ip);

      switch (type) {
      case 4:
        rr = dns.A({ address: ip });
        break;
      case 6:
        rr = dns.AAAA({ address: ip });
        break;
      default:
        throw new Error("Invalid IP Address: " + ip);
        break;
      }

      rr.name = question.name;
      rr.ttl = resource.ttl;
      this.answer.push(rr);
    }
  }
};

var addInfo = function (question, resource, msg) {
  this.additional.push(dns.TXT({
    name: question.name,
    ttl: resource.ttl,
    data: msg,
  }));
};

var VALID_RESOURCE_TYPES = [
  consts.NAME_TO_QTYPE.A,
  consts.NAME_TO_QTYPE.AAAA,
  consts.NAME_TO_QTYPE.CNAME,
  consts.NAME_TO_QTYPE.SOA,
  consts.NAME_TO_QTYPE.TXT,
  consts.NAME_TO_QTYPE.ANY,
];


var DNSBalance = function (options) {
  var self = this;

  this.zones = {};
  this._listeners = {};

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
    self.handleRequest(req, res, function () {
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

DNSBalance.prototype.handleRequest = function (req, res, finish) {
  var question,
    original_name,
    asked_domain_name,
    original_domain,
    asked_domain,
    resource_name,
    domain,
    resource,
    nodes;

  /* Despite DNS supporting multiple questions, nothing in practice uses it */
  question = req.question[0];

  if (VALID_RESOURCE_TYPES.indexOf(question.type) === -1) {
    winston.error('Not a valid question type: ' + consts.QTYPE_TO_NAME[question.type]);
    res.header.rcode = consts.NAME_TO_RCODE.NOTFOUND;
    return finish();
  }

  original_name = question.name.toLowerCase();
  asked_domain_name = original_name.split('.').slice(1).join('.');

  original_domain = this.zones[original_name];
  asked_domain = this.zones[asked_domain_name];

  if (!asked_domain && !original_domain) {
    winston.error("Not a served domain " + question.name);
    res.header.rcode = consts.NAME_TO_RCODE.NOTFOUND;
    return finish();
  }

  if (original_domain) {
    resource_name = '@';
    domain = original_domain;
  } else {
    resource_name = original_name.split('.').slice(0, 1);
    domain = asked_domain;
  }

  if (question.type === consts.NAME_TO_QTYPE.SOA) {
    res.authority.push(dns.SOA({
      name: question.name,
      ttl: domain.ttl,
      primary: domain.name,
      admin: domain.email,
      serial: domain.serial % 4294967294,
      refresh: 60,
      retry: 60,
      expiration: 60,
      minimum: 60
    }));

    return finish();
  }

  resource = domain.getResource(resource_name) || domain.getResource('*');

  if (!resource || consts.NAME_TO_QTYPE[resource.type.toUpperCase()] !== question.type) {
    winston.error("Can't find " + resource_name + " in " + domain.name + " with type: " + consts.QTYPE_TO_NAME[question.type]);
    res.header.rcode = consts.NAME_TO_RCODE.NOTFOUND;
    return finish();
  }

  nodes = resource.getNodes().values;
  resource.handler(req, nodes, function (results) {
    var n;

    res.addNode = addNode;

    for (n in results) {
      if (results.hasOwnProperty(n)) {
        res.addNode(question, resource, results[n]);
      }
    }

    finish();
  });
};

DNSBalance.prototype._innerAddZone = function (zone) {
  this.zones[zone.name.toLowerCase()] = zone;
};

DNSBalance.prototype.addZone = function (zone) {
  this._innerAddZone(zone);
  this.emit('zoneAdded', zone);
};

DNSBalance.prototype._innerRemoveZone = function (name) {
  name = name.toString().toLowerCase();
  this.zones[name] = null;
  delete this.zones[name];
};

DNSBalance.prototype.removeZone = function (name) {
  this._innerRemoveZone(name);
  this.emit('zoneRemoved', name);
};

DNSBalance.prototype.getZone = function (name) {
  name = name.toString().toLowerCase();
  return this.zones[name];
};

DNSBalance.prototype.getZones = function () {
  return new Hash(this.zones);
};

DNSBalance.prototype.sendZones = function () {
  var to_exchange = [];
  this.getZones().forEach(function (zone) {
    to_exchange.push(zone.toObject());
  });
  return to_exchange;
};

DNSBalance.prototype.replaceZone = function (zone) {
  var old_serial;

  winston.info('Replacing zone data: ' + zone.name);

  old_serial = this.getZone(zone.name).serial;
	this._innerRemoveZone(zone.name);
	this._innerAddZone(zone);
  this.emit('zoneAdded', zone);
  zone.emit('changed_serial', old_serial, zone.serial);
};

DNSBalance.prototype.receiveZones = function (zones) {
  var self = this;

  zones.forEach(function (z) {
    var zone, our_zone;

    zone = new DNSZone(z);
    our_zone = self.getZone(zone.name);

    if (!our_zone) {
      winston.info("we don't have zone: " + zone.name);
      self.addZone(zone);
    } else {
      if (our_zone.newestSerial() < zone.newestSerial()) {
        self.replaceZone(zone);
      }
    }
  });
};

DNSBalance.prototype.loadZones = function (dir) {
  var fs, path, self = this;

  fs = require('fs');
  path = require('path');

  fs.readdir(path.normalize(dir), function (err, files) {
    files.forEach(function (file) {
      fs.readFile(path.join(dir, file), function (err, zonedata) {
        var z, zone;
        try {
          z = JSON.parse(zonedata);
        } catch (e) {
          winston.error("Failed to load: " + file);
          return;
        }
        zone = new DNSZone(z);
        self.addZone(zone);
      });
    });
  });
};

module.exports = DNSBalance;
