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
var util = require('util');

var dnode = require('dnode');
var Hash = require('hashish');
var winston = require('winston');

var Delegates = function (delegates) {
  var self = this;

  this._delegates = {};

  if (delegates) {
    delegates.forEach(function (d) {
      self.add(d.ip, d.port);
    });
  }
};
util.inherits(Delegates, EventEmitter);

Delegates.prototype.add = function (ip, port) {
  var d, self = this;

  winston.info('Adding delegate: ' + [ip, port].join(', '));

  d = dnode.connect(port, ip, {reconnect: 10 * 1000}, function (remote, connection) {
    remote.validate(new Date().getTime(), function (err) {
      if (!err) {
        winston.info('Delegate connected: ' + [ip, port].join(', '));
        self._delegates[connection.id] = remote;
        self.emit('validated', remote);
      } else {
        connection.end();
        winston.error(err);
        self.emit('error', err, ip, port);
      }
    });

    connection.on('end', function () {
      winston.info('Delegate closed: ' + [ip, port].join(', '));
      self._delegates[connection.id] = undefined;
      delete self._delegates[connection.id];
    });

    connection.on('reconnect', function () {
      winston.info('Delegate reconnecting: ' + [ip, port].join(', '));
    });
  });
};

Delegates.prototype.delegateHash = function () {
  return new Hash(this._delegates);
};

Delegates.prototype.each = function (func) {
  return this.delegateHash().forEach(func);
};

Delegates.prototype.zone_set_property = function (domain, property, when, value) {
  this.each(function (delegate) {
    delegate.zone_set_property(domain, property, when, value);
  });
};

Delegates.prototype.zone_add = function (zone) {
  this.each(function (delegate) {
    delegate.zone_add(zone.toObject());
  });
};

Delegates.prototype.zone_del = function (zone) {
  this.each(function (delegate) {
    delegate.zone_del(zone);
  });
};

Delegates.prototype.resource_set_property = function (domain, resource, property, when, value) {
  this.each(function (delegate) {
    delegate.resource_set_property(domain, resource, property, when, value);
  });
};

Delegates.prototype.resource_add = function (zone, resource) {
  this.each(function (delegate) {
    delegate.resource_add(zone, resource.toObject());
  });
};

Delegates.prototype.resource_del = function (zone, resource) {
  this.each(function (delegate) {
    delegate.resource_del(zone, resource);
  });
};

Delegates.prototype.node_set_property = function (domain, resource, node, property, when, value) {
  this.each(function (delegate) {
    delegate.node_set_property(domain, resource, node, property, when, value);
  });
};


Delegates.prototype.node_add = function (zone, resource, node) {
  this.each(function (delegate) {
    delegate.node_add(zone, resource, node.toObject());
  });
};

Delegates.prototype.node_del = function (zone, resource, node) {
  this.each(function (delegate) {
    delegate.node_del(zone, resource, node);
  });
};

Delegates.prototype.nodeAdded = function (node) {
  var self = this;

  winston.info('node.wireup: ' + node.name);

  node.on('propagate', function (field, when, value) {
    self.node_set_property(
      this.parent.parent.name,
      this.parent.name,
      this.name,
      field,
      when,
      value
    );
  });

  self.node_add(node.parent.parent.name, node.parent.name, node);
};

Delegates.prototype.resourceAdded = function (resource) {
  var self = this;

  winston.info('resource.wireup: ' + resource.name);

  resource.getNodes().forEach(function (node) {
    self.nodeAdded(node);
  });

  resource.on('nodeAdded', function (n) {
    self.nodeAdded(n);
  });

  resource.on('nodeRemoved', function (node) {
    self.node_del(this.parent.name, this.name, node);
  });

  resource.on('propagate', function (field, when, value) {
    self.resource_set_property(
      this.parent.name,
      this.name,
      field,
      when,
      value
    );
  });

  self.resource_add(resource.parent.name, resource);
};

Delegates.prototype.zoneAdded = function (zone) {
  var self = this;

  winston.info('zone.wireup: ' + zone.name);

  zone.getResources().forEach(function (resource) {
    self.resourceAdded(resource);
  });

  zone.on('resourceAdded', function (r) {
    self.resourceAdded(r);
  });

  zone.on('resourceRemoved', function (resource) {
    self.resource_del(this.name, resource);
  });

  zone.on('propagate', function (field, when, value) {
    self.zone_set_property(
      this.name,
      field,
      when,
      value
    );
  });

  self.zone_add(zone);
};

module.exports = Delegates;
