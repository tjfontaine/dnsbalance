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

var dnode = require('dnode')
var Hash = require('hashish')

var Delegates = function(port) {
  this._delegates = {}
  this._port = port
}
sys.inherits(Delegates, EventEmitter)

Delegates.prototype.add = function(ip) {
  dnode.connect(this._port, ip, {reconnect: 10 * 1000}, function(remote, connection) {
    this._delegates[connection.id] = remote
    connection.on('end', function() {
      this._delegates[connection.id] = undefined
      delete this._delegates[connection.id]
    })
  })
}

Delegates.prototype.zone_set_property = function(domain, property, when, value) {
  var d = new Hash(this._delegates)
  d.forEach(function(delegate) {
    delegate.zone_set_propety(domain, property, when, value)
  })
}

Delegates.prototype.resource_set_property = function(domain, resource, property, when, value) {
  var d = new Hash(this._delegates)
  d.forEach(function(delegate) {
    delegate.resource_set_propety(domain, resource, property, when, value)
  })
}

Delegates.prototype.node_set_property = function(domain, resource, node, property, when, value)
{
  var d = new Hash(this._delegates)
  d.forEach(function(delegate) {
    delegate.node_set_propety(domain, resource, node, property, when, value)
  })
}

module.exports = Delegates
