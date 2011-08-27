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

var Hash = require('hashish')
var winston = require('winston')

var ndns = require('./ndns');
var DNSZone = require('./dnszone')

addNode = function (question, resource, node) {
  node.last_used = new Date().getTime()
  for (i in node.ips) {
    this.addRR(
      ndns.ns_s.an,
      question.name,
      ndns.ns_t.a,
      ndns.ns_c.in,
      resource.ttl,
      node.ips[i]
    )
  }
}

addInfo = function(question, resource, msg) {
  this.addRR(
    ndns.ns_s.ar,
    question.name,
    ndns.ns_t.txt,
    ndns.ns_c.in,
    resource.ttl,
    msg
  )
}



var DNSBalance = function(options) {
  this.zones = {}
  this._listeners = {}

  var self = this
  if (options) {
    if (options.query) {
      options.query.forEach(function(l) {
        self.addInterface(l.ip, l.port)
      })
    }
  }
}
sys.inherits(DNSBalance, EventEmitter)

DNSBalance.prototype.formatInterface = function(ip, port) {
  return '['+ip+']:'+port
}

DNSBalance.prototype.addInterface = function(ip, port) {
  var server = ndns.createServer('udp4')
  server.bind(port, ip)
  var self = this
  server.on('request', function(req, res) {
    self.handleRequest(req, res, function(){
      res.send()
    })
  })

  this._listeners[this.formatInterface(ip, port)] = server
}

DNSBalance.prototype.removeInterface = function(ip, port) {
  var key = this.formatInterface(ip, port)
  var server = this._listeners[key]
  server.close()
  this._listeners[key] = undefined
  delete this._listeners[key]
}

DNSBalance.prototype.handleRequest = function(req, res, finish) {
  for (q in req.question) {
    var question = req.question[q]

    var original_name = question.name.toLowerCase()
    var asked_domain_name = original_name.split('.').slice(1).join('.')

    var original_domain = this.zones[original_name]
    var asked_domain = this.zones[asked_domain_name]

    if (asked_domain || original_domain) {
      var resource_name
      var domain

      if (original_domain) {
        resource_name = '@'
        domain = original_domain
      } else {
        resource_name = original_name.split('.').slice(0, 1)
        domain = asked_domain
      }

      var resource = domain.getResource(resource_name) || domain.getResource('*')

      if (resource) {
        var nodes = resource.getNodes().values
        resource.handler(req, nodes, function(results) {
          res.addNode = addNode
          for (var n in results) {
            res.addNode(question, resource, results[n])
          }
          finish()
        })
      } else {
        winston.error("Can't find " + resource_name + " in " + domain.name)
        res.header.rcode = ndns.ns_rcode.nxdomain
        finish()
        break;
      }
    } else {
      winston.error("Not a served domain " + question.name)
      res.header.rcode = ndns.ns_rcode.nxdomain
      finish()
      break;
    }
  }
}

DNSBalance.prototype._innerAddZone = function(zone) {
  winston.info('adding zone: ' + zone.name.toLowerCase() + ' (' + zone.serial + ')')
  this.zones[zone.name.toLowerCase()] = zone
}

DNSBalance.prototype.addZone = function(zone) {
  this._innerAddZone(zone)
  this.emit('zoneAdded', zone)
}

DNSBalance.prototype._innerRemoveZone = function(name) {
  name = name.toString().toLowerCase()
  this.zones[name] = null
  delete this.zones[name]
}

DNSBalance.prototype.removeZone = function(name) {
  this.emit('zoneRemoved', name)
}

DNSBalance.prototype.getZone = function(name) {
  name = name.toString().toLowerCase()
  return this.zones[name]
}

DNSBalance.prototype.getZones = function() {
  return new Hash(this.zones)
}

DNSBalance.prototype.sendZones = function() {
  var to_exchange = []
  this.getZones().forEach(function(zone) {
    to_exchange.push(zone.toObject())
  })
  return to_exchange
}

DNSBalance.prototype.replaceZone = function(zone) {
  winston.info('Replacing zone data: ' + zone.name)
	this._innerRemoveZone(zone.name)
	this._innerAddZone(zone)
  this.emit('zoneAdded', zone)
}

DNSBalance.prototype.receiveZones = function (zones) {
  var self = this

  zones.forEach(function (z) {
    var zone = new DNSZone(z)
    var our_zone = self.getZone(zone.name)

    if (!our_zone) {
      winston.info("we don't have zone: " + zone.name)
      self.addZone(zone)
    }
    else {
      if (zone.serial > our_zone.serial) {
        winston.info("Their serial ("+ zone.serial +") for " + zone.name + " is higher than ours ("+ our_zone.serial+")")
        self.replaceZone(zone)
      }
      else {
        var resources = zone.getResources().values
        for (var r in resources) {
          var resource = resources[r]
          var our_resource = our_zone.getResource(resource.name)
          if (!our_resource) {
            self.replaceZone(zone)
            break
          }
          else {
            if (resource.serial > our_resource.serial) {
              self.replaceZone(zone)
              break
            }
            else {
              var nodes = resource.getNodes().values
              for (var n in nodes) {
                var node = nodes[n]
                var our_node = our_resource.getNode(node.name)
                if (!our_node) {
                  self.replaceZone(zone)
                  break
                }
                else {
                  if (node.serial > our_node.serial) {
                    self.replaceZone(zone)
                    break
                  }
                }
              }
            }
          }
        }
      }
    }
  })
}

DNSBalance.prototype.loadZones = function(dir) {
  var fs = require('fs')
  var path = require('path')
  var self = this

  fs.readdir(path.normalize(dir), function(err, files) {
    files.forEach(function(file) {
      fs.readFile(path.join(dir, file), function(err, zonedata) {
        var z
        try {
          z = JSON.parse(zonedata)
        } catch (e) {
          winston.error("Failed to load: " + file)
          return
        }
        var zone = new DNSZone(z)
        self.addZone(zone)
      })
    })
  })
}

module.exports = DNSBalance
