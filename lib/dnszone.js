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
var winston = require('winston')

var DNSResource = require('./dnsresource').DNSResource

var DNSZone = exports.DNSZone = function(obj) {
  Validator.call(this)

  this.resources = {}

  this.excepted = ['resources']

  this.required = {
    'name': true,
    'soa': true,
    'ttl': true,
  }

  this.increments_serial = [
    'soa',
    'ttl',
  ]

  if (obj) {
    this.fromObject(obj)

    for (var r in obj.resources) {
      var resource = new DNSResource(obj.resources[r])
      this.addResource(resource)
    }
  }
}
sys.inherits(DNSZone, Validator)

DNSZone.prototype.addResource = function(resource) {
  winston.info('adding resource: ' + resource.name.toLowerCase())
  this.resources[resource.name.toLowerCase()] = resource
  resource.parent = this

  var self = this
  resource.on('changed_serial', function(old, cur) {
    self.serialNext()
  })
}

DNSZone.prototype.removeResource = function(name) {
  name = name.toString().toLowerCase()
  this.resources[name] = null
  delete this.resources[name]

  this.emit('resourceRemoved', name)
}

DNSZone.prototype.getResource = function(name) {
  name = name.toString().toLowerCase()
  return this.resources[name]
}

DNSZone.prototype.toObject = function() {
  var r = {}
  for (var k in this) {
    if (!this.isExcepted(k)) {
      r[k] = this[k]
    }
  }
  r.resources = {}
  for (var i in this.resources) {
    r.resources[i] = this.resources[i].toObject()
  }
  return r
}

exports.DNSZone = DNSZone
