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
var fs = require('fs')
var path = require('path')
var util = require('util')

var winston = require('winston')

winston.remove(winston.transports.Console)
winston.add(winston.transports.Console, {
  colorize: true,
  timestamp: true,
})

var argv = require('optimist')
  .default('c', path.join(path.dirname(__filename), 'config.js'))
  .describe('c', 'Specify the config file')
  .alias('c', 'config')
  .argv

var DNSBalance = require('./lib/dnsbalance')
var Delegates = require('./lib/delegates')
var Config = require('./lib/configfile')

var config = new Config(argv.c)
config.on('loaded', function() {
  var srv = new DNSBalance(this.query)
  var delegates = new Delegates(this.delegates)

  function nodeAdded(node) {
    winston.info('node.wireup: ' + node.name)

    node.on('propagate', function(field, when, value) {
      delegates.node_set_property(
        this.parent.parent.name,
        this.parent.name,
        this.name,
        field,
        when,
        value
      )
    });
  }

  function resourceAdded(resource) {
    winston.info('resource.wireup: ' + resource.name)
    resource.on('nodeAdded', nodeAdded)
    resource.on('propagate', function(field, when, value) {
      delegates.resource_set_property(
        this.parent.name,
        this.name,
        field,
        when,
        value
      )
    });
  }

  function zoneAdded(zone) {
    winston.info('zone.wireup: ' + zone.name)
    zone.on('resourceAdded', resourceAdded)

    zone.on('changed_serial', function(old, cur) {
      winston.info('serailizing zone: ' + this.name)
      var o = this.toObject()
      fs.writeFile(
        path.join('./zones', this.name),
        JSON.stringify(o, null, 2)
      )
    });

    zone.on('propagate', function(field, when, value) {
      delegates.zone_set_property(
        this.name,
        field,
        when,
        value
      )
    });
  }

  srv.loadZones("./zones", function(zone) {
    zone.getResources().forEach(function(resource) {
      resourceAdded(resource)
      resource.getNodes().forEach(function(node) {
        nodeAdded(node)
      })
    })
  })

  srv.on('zoneAdded', zoneAdded)

  var Hash = require('hashish')

  this.rpc.forEach(function(r) {
    var rpc = new dnode({
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
    rpc.listen(r.port, r.ip)
  })
})
