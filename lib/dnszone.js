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

var Validator = require('./validator').Validator
var sys = require('sys')
var util = require('util')
var winston = require('winston')

var DNSResource = require('./dnsresource').DNSResource

var DNSZone = exports.DNSZone = function(obj) {
  this._fields = {
    name: {
    },
    parent: {
      enumerable: false,
    },
    soa: {
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
  }

  Validator.call(this, obj)

  this._resources = {}

  if (obj) {
    for (var r in obj.resources) {
      var resource = new DNSResource(obj.resources[r])
      this.addResource(resource)
    }
  }
}
sys.inherits(DNSZone, Validator)

DNSZone.prototype.addResource = function(resource) {
  winston.info('adding resource: ' + resource.name.toLowerCase())
  this._resources[resource.name.toLowerCase()] = resource
  resource.parent = this

  var self = this
  resource.on('changed_serial', function(old, cur) {
    self.serial += 1
  })

  this.emit('resourceAdded', resource)
}

DNSZone.prototype.removeResource = function(name) {
  name = name.toString().toLowerCase()
  this._resources[name] = null
  delete this._resources[name]

  this.emit('resourceRemoved', name)
}

DNSZone.prototype.getResource = function(name) {
  name = name.toString().toLowerCase()
  return this._resources[name]
}

DNSZone.prototype.toObject = function() {
  var r = Validator.prototype.toObject.call(this)
  r.resources = {}
  for (var i in this._resources) {
    r.resources[i] = this._resources[i].toObject()
  }
  return r
}
