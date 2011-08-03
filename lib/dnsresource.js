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

var EventEmitter = require('events').EventEmitter
var sys = require('sys')
var vm = require('vm')

var winston = require('winston')

var Validator = require('./validator').Validator

var DNSResource = exports.DNSResource = function(obj) {
  Validator.call(this)

  this.nodes = {}

  this.excepted = ['nodes', 'handler']

  this.required = {
    'name': true,
    'ttl': true,
    'handler': true,
  }

  this.increments_serial = [
    'ttl',
    'handler',
  ]

  if (obj) {
    this.fromObject(obj)

    this.handler = vm.runInNewContext(obj.handler, { Policy: require('./policy').Policy })

    for (var n in obj.nodes) {
      this.addNode(obj.nodes[n])
    }
  }
}
sys.inherits(DNSResource, Validator)

DNSResource.prototype.addNode = function(node) {
  winston.info('adding node: ' + node.name.toLowerCase())
  this.nodes[node.name.toLowerCase()] = node
  node.parent = this
}

DNSResource.prototype.removeNode = function(name) {
  name = name.toString().toLowerCase()
  this.nodes[name] = null
  delete this.nodes[name]
}

DNSResource.prototype.getNode = function(name) {
  name = name.toString().toLowerCase()
  return this.nodes[name]
}

DNSResource.prototype.toObject = function() {
  var r = {}
  for (var k in this) {
    if (!this.isExcepted(k)) {
      r[k] = this[k]
    }
  }
  r.handler = 'handler = ' + this.handler.toString()
  r.nodes = this.nodes
  return r
}

exports.DNSResource = DNSResource
