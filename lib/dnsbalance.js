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

var sys = require('sys')
var vm = require('vm')

var ndns = require ('./ndns');

var Validator = function() {}

Validator.prototype.isExcepted = function(k) {
  return this.excepted.concat(['required', 'excepted']).indexOf(k) > -1
}

Validator.prototype.hasRequired = function(obj) {
  for (var r in this.required) {
    if (!obj[r]) {
      throw new Error("Missing property: " + r)
    }
  }
}

Validator.prototype.fromObject = function(obj) {
  this.hasRequired(obj)

  for (var k in obj) {
    if (!this.isExcepted(k)) {
      this[k] = obj[k]
    }
  }
}

var DNSZone = exports.DNSZone = function(obj) {
  this.resources = {}

  this.excepted = ['resources']

  this.required = {
    'name': true,
    'soa': true,
    'ttl': true,
  }

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
  console.log('adding resource: ' + resource.name.toLowerCase())
  this.resources[resource.name.toLowerCase()] = resource
}

DNSZone.prototype.removeResource = function(name) {
  name = name.toString().toLowerCase()
  this.resources[name] = null
  delete this.resources[name]
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


var DNSResource = exports.DNSResource = function(obj) {
  this.nodes = {}

  this.excepted = ['nodes', 'handler']

  this.required = {
    'name': true,
    'ttl': true,
    'handler': true,
  }

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
  console.log('adding node: ' + node.name.toLowerCase())
  this.nodes[node.name.toLowerCase()] = node
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



var DNSBalance = exports.DNSBalance = function(port, zones) {
  this.zones = {}

  if (zones) {
    this.loadZones(zones)
  }

  this.server = ndns.createServer('udp4')
  this.server.bind(port, '0.0.0.0')
  var self = this
  this.server.on('request', function(req, res) {
    //try {
      self.handleRequest(req, res, function(){
        res.send()
      })
    //} catch(e) {
    //  console.log(e)
    //  res.header.rcode = ndns.ns_rcode.servfail
    //} finally {
    //  res.send()
    //}
  })
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
        var nodes = resource.nodes
        resource.handler(req, nodes, function(results) {
          res.addNode = addNode
          for (var n in results) {
            res.addNode(question, resource, results[n])
          }
          finish()
        })
      } else {
        console.log("Can't find", resource_name, "in", domain.name)
        res.header.rcode = ndns.ns_rcode.nxdomain
        finish()
        break;
      }
    } else {
      console.log(question.name, "Not a served domain")
      res.header.rcode = ndns.ns_rcode.nxdomain
      finish()
      break;
    }
  }
}

DNSBalance.prototype.addZone = function(zone) {
  console.log('adding zone: ' + zone.name.toLowerCase())
  this.zones[zone.name.toLowerCase()] = zone
}

DNSBalance.prototype.removeZone = function(name) {
  name = name.toString().toLowerCase()
  this.zones[name] = null
  delete this.zones[name]
}

DNSBalance.prototype.getZone = function(name) {
  name = name.toString().toLowerCase()
  return this.zones[name]
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
          console.log("Failed to load:", file)
          return
        }
        var zone = new DNSZone(z)
        self.addZone(zone)
      })
    })
  })
}
