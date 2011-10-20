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

var util = require('util');

var Hash = require('hashish');
var winston = require('winston');

var DNSResource = require('./dnsresource');
var Validator = require('./validator');

var DNSZone = function (obj) {
  "use strict";

  var r, resource;

  this._fields = {
    name: {
      propagate: false,
    },
    parent: {
      enumerable: false,
      propagate: false,
    },
    email: {
      required: true,
      increments: true,
    },
    ttl: {
      required: true,
      increments: true,
    },
    resources: {
      reserved: true,
    },
  };

  Validator.call(this, obj);

  this._resources = {};

  if (obj) {
    for (r in obj.resources) {
      if (obj.resources.hasOwnProperty(r)) {
        resource = new DNSResource(obj.resources[r]);
        this.addResource(resource);
      }
    }
  }
};
util.inherits(DNSZone, Validator);

DNSZone.prototype.addResource = function (resource) {
  var self = this;

  this._resources[resource.name.toLowerCase()] = resource;
  resource.parent = this;

  resource.on('changed_serial', function (old, cur) {
    self.serial += 1;
  });

  if (this.parent) {
    this.serial += 1;
  }

  this.emit('resourceAdded', resource);
};

DNSZone.prototype.removeResource = function (name) {
  name = name.toString().toLowerCase();
  this._resources[name] = null;
  delete this._resources[name];

  if (!this._in_init) {
    this.serial += 1;
  }

  this.emit('resourceRemoved', name);
};

DNSZone.prototype.getResource = function (name) {
  name = name.toString().toLowerCase();
  return this._resources[name];
};

DNSZone.prototype.getResources = function () {
  return new Hash(this._resources);
};

DNSZone.prototype.toObject = function () {
  var r, i;

  r = Validator.prototype.toObject.call(this);
  r.resources = {};

  for (i in this._resources) {
    if (this._resources.hasOwnProperty(i)) {
      r.resources[i] = this._resources[i].toObject();
    }
  }

  return r;
};

module.exports = DNSZone;
