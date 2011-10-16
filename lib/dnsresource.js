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

"use strict";

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var vm = require('vm');

var Hash = require('hashish');
var winston = require('winston');

var Validator = require('./validator');
var DNSNode = require('./dnsnode');

var DNSResource = function(obj) {
  var n, node;

  this._fields = {
    name: {
      propagate: false,
    },
    parent: {
      enumerable: false,
      propagate: false,
    },
    ttl: {
      required: true,
      increments: true,
    },
    handler: {
      required: true,
      increments: true,
      enumerable: false,
    },
    nodes: {
      reserved: true,
    },
    type: {
      default: 'a',
      required: true,
      increments: true,
    },
  };

  Validator.call(this, obj);

  this._nodes = {};

  if (obj) {
    this._fields.handler.value = vm.runInNewContext(obj.handler, { Policy: require('./policy').Policy });

    for (n in obj.nodes) {
      if (obj.nodes.hasOwnProperty(n)) {
        node = new DNSNode(obj.nodes[n]);
        this.addNode(node);
      }
    }
  }
};
util.inherits(DNSResource, Validator);

DNSResource.prototype.addNode = function(node) {
  this._nodes[node.name.toLowerCase()] = node;
  node.parent = this;

  if (this.parent) {
    this.serial += 1;
  }

  this.emit('nodeAdded', node);
};

DNSResource.prototype.removeNode = function(name) {
  name = name.toString().toLowerCase();
  this._nodes[name] = null;
  delete this._nodes[name];

  if (!this._in_init) {
    this.serial += 1;
  }

  this.emit('nodeRemoved', name);
};

DNSResource.prototype.getNode = function(name) {
  name = name.toString().toLowerCase();
  return this._nodes[name];
};

DNSResource.prototype.getNodes = function() {
  return new Hash(this._nodes);
};

DNSResource.prototype.toObject = function() {
  var r, n;

  r = Validator.prototype.toObject.call(this);
  r.handler = 'handler = ' + this.handler.toString();
  r.nodes = {};

  for (n in this._nodes) {
    if (this._nodes.hasOwnProperty(n)) {
      r.nodes[n] = this._nodes[n].toObject();
    }
  }

  return r;
};

module.exports = DNSResource;
