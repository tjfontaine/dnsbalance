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
var net = require('net')
var util = require('util')

var Hash = require('hashish')
var winston = require('winston')

var DNSZone = require('./dnszone')
var dns = require('./node-dns/dns')
var consts = require('./node-dns/lib/consts')

addNode = function (question, resource, node) {
  node.last_used = new Date().getTime()
  for (i in node.ips) {
    var ip = node.ips[i]
    var rr = undefined
    var type = net.isIP(ip)
    switch (type) {
      case 4:
        rr = dns.A({ address: ip })
        break;
      case 6:
        rr = dns.AAAA({ address: ip })
        break;
      default:
        throw new Error("Invalid IP Address: " + ip)
        break;
    }
    rr.name = question.name
    rr.ttl = resource.ttl
    this.answer.push(rr)
  }
}

addInfo = function(question, resource, msg) {
  this.additional.push(dns.TXT({
    name: question.name,
    ttl: resource.ttl,
    data: msg,
  }));
}

var VALID_RESOURCE_TYPES = [
  consts.NAME_TO_QTYPE.A,
  consts.NAME_TO_QTYPE.AAAA,
  consts.NAME_TO_QTYPE.CNAME,
  consts.NAME_TO_QTYPE.SOA,
  consts.NAME_TO_QTYPE.TXT,
  consts.NAME_TO_QTYPE.ANY,
]


var DNSBalance = function(options) {
  this.zones = {}
  this._listeners = {}

  this.host = options.host

  var self = this
  if (options.query) {
    options.query.forEach(function(l) {
      self.addInterface(l.ip, l.port)
    })
  }
}
util.inherits(DNSBalance, EventEmitter)

DNSBalance.prototype.formatInterface = function(ip, port) {
  return '['+ip+']:'+port
}

DNSBalance.prototype.addInterface = function(ip, port) {
  var server = dns.createServer('udp4')
  winston.info('Adding Query Interface: ' + [ip, port].join(':'))
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

    if (VALID_RESOURCE_TYPES.indexOf(question.type) == -1) {
      winston.error('Not a valid question type: ' + consts.QTYPE_TO_NAME[question.type])
      res.header.rcode = consts.NAME_TO_RCODE.NOTFOUND
      finish()
      return
    }

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

      if (question.type == consts.NAME_TO_QTYPE.SOA) {
        res.authority.push(dns.SOA({
          name: question.name,
          ttl: domain.ttl,
          primary: domain.name,
          admin: domain.email,
          serial: domain.serial % 4294967294,
          refresh: 60,
          retry: 60,
          expiration: 60,
          minimum: 60
        }))
        finish()
        return
      }

      var resource = domain.getResource(resource_name) || domain.getResource('*')
      if (resource && consts.NAME_TO_QTYPE[resource.type.toUpperCase()] == question.type) {
        var nodes = resource.getNodes().values
        resource.handler(req, nodes, function(results) {
          res.addNode = addNode
          for (var n in results) {
            res.addNode(question, resource, results[n])
          }
          finish()
        })
      } else {
        winston.error("Can't find " + resource_name + " in " + domain.name + " with type: " + consts.QTYPE_TO_NAME[question.type])
        res.header.rcode = consts.NAME_TO_RCODE.NOTFOUND
        finish()
        return;
      }
    } else {
      winston.error("Not a served domain " + question.name)
      res.header.rcode = consts.NAME_TO_RCODE.NOTFOUND
      finish()
      return;
    }
  }
}

DNSBalance.prototype._innerAddZone = function(zone) {
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
  var old_serial = this.getZone(zone.name).serial
	this._innerRemoveZone(zone.name)
	this._innerAddZone(zone)
  this.emit('zoneAdded', zone)
  zone.emit('changed_serial', old_serial, zone.serial)
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
