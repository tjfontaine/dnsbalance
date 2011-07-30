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

var ndns = require ('./ndns');

var DNSZone = exports.DNSZone = function(name, soa, ttl, delegates) {
  this.name = name
  this.soa = soa
  this.ttl = ttl
  this.delegates = delegates
  this.resources = {}
}

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
  r.name = this.name
  r.soa = this.soa
  r.ttl = this.ttl
  r.delegates = this.delegates
  r.resources = {}
  for (var i in this.resources) {
    r.resources[i] = this.resources[i].toObject()
  }
  return r
}



var DNSResource = exports.DNSResource = function(name, ttl, handler, nodes) {
  this.name = name
  this.ttl = ttl
  this.handler = handler
  this.nodes = {}
  for (n in nodes) {
    var node = nodes[n]
    this.addNode(node)
  }
}

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
  return {
    name: this.name,
    ttl: this.ttl,
    handler: this.handler.toString(),
    nodes: this.nodes,
  }
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

  this.loadZones(zones)

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

DNSBalance.prototype.loadZones = function(zones) {
  for (d in zones) {
    var domain = zones[d]
    var zone = new DNSZone(d, domain.email, domain.ttl, domain.delegates)
    for (r in domain.resources) {
      var rsc = domain.resources[r]
      var resource = new DNSResource(r, rsc.ttl, rsc.handler)
      for (n in rsc.nodes) {
        var node = rsc.nodes[n]
        node.name = n
        resource.addNode(node)
      }
      zone.addResource(resource)
    }
    this.addZone(zone)
  }
}
