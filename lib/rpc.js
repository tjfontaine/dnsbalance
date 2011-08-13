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

var dnode = require('dnode')
var winston = require('winston')

var MAX_DELTA = 1000 * 10

var RPC = function(srv, bind) {
  var rpc = new dnode({
    validate: function(remote_time, cb) {
      var my_time = new Date().getTime()
      var delta = Math.abs(my_time - remote_time)
      var error = undefined
      if (delta > MAX_DELTA) {
        error = new Error("Too much time variance between end points: Ours="+my_time+" Yours="+remote_time+" Delta="+delta)
      }
      cb(error)
    },
    zone_set_property: function(domain, property, when, value) {
      winston.info('rpc zone_set_property: ' + util.inspect(arguments))
      srv.getZone(domain)
        .onPropagate(property, when, value)
    },
    resource_set_property: function(domain, resource, property, value, cb) {
      winston.info('rpc resource_set_property: ' + util.inspect(arguments))
      srv.getZone(domain)
        .getResource(resource)
        .onPropagate(property, when, value)
    },
    node_set_property: function(domain, resource, node, property, value, cb) {
      winston.info('rpc node_set_property: ' + util.inspect(arguments))
      srv.getZone(domain)
        .getResource(resource)
        .getNode(node)
        .onPropagate(property, when, value)
    },
  })
  rpc.listen(bind.port, bind.ip)
}

module.exports = RPC
