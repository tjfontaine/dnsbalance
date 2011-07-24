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
  console.log('adding resource: ' + resource.name)
  this.resources[resource.name] = resource
}

DNSZone.prototype.removeResource = function(name) {
  this.resources[name] = null
  delete this.resources[name]
}

DNSZone.prototype.getResource = function(name) {
  return this.resources[name]
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
  console.log('adding node: ' + node.name)
  this.nodes[node.name] = node
}

DNSResource.prototype.removeNode = function(name) {
  this.nodes[name] = null
  delete this.nodes[name]
}

DNSResource.prototype.getNode = function(name) {
  return this.nodes[name]
}



var DNSNode = exports.DNSNode = function(name, ips, load) {
  this.name = name
  this.ips  = ips
  this.load = load
}



DNSResponse = function(res, question, resource) {
  this.res = res
  this.question = question
  this.resource = resource
}

DNSResponse.prototype.addNode = function(node) {
  for (i in node.ips) {
    this.res.addRR(ndns.ns_s.an, this.question.name, ndns.ns_t.a, ndns.ns_c.in, this.resource.ttl, node.ips[i])
  }
}

DNSResponse.prototype.addInfo = function(msg) {
  this.res.addRR(ndns.ns_s.ar, this.question.name, ndns.ns_t.txt, ndns.ns_c.in, this.resource.ttl, msg)
}



var DNSBalance = exports.DNSBalance = function(port) {
  this.zones = {}
  this.server = ndns.createServer('udp4')
  this.server.bind(port, '0.0.0.0')
  var self = this
  this.server.on('request', function(req, res) {
    for (q in req.question) {
      var question = req.question[q]
      var asked_domain = question.name.split('.').slice(1).join('.')
      if (self.zones[asked_domain]) {
        var domain = self.zones[asked_domain]
        var resource = domain.getResource(question.name.split('.').slice(0, 1))
        if (resource) {
          resource.handler(req, new DNSResponse(res, question, resource), resource)
        } else {
          res.header.rcode = ndns.ns_rcode.nxdomain
          break;
        }
      } else {
        res.header.rcode = ndns.ns_rcode.nxdomain
        break;
      }
    }
    res.send()
  })
}

DNSBalance.prototype.addZone = function(zone) {
  console.log('adding zone: ' + zone.name)
  this.zones[zone.name] = zone
}

DNSBalance.prototype.removeZone = function(name) {
  this.zones[name] = null
  delete this.zones[name]
}

DNSBalance.prototype.getZone = function(name) {
  return this.zones[name]
}
