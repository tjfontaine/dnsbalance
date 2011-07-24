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

var dnsbalance = require('./lib/dnsbalance')
var PriorityQueue = require('./lib/priority_queue').PriorityQueue

var LeastLoad = function(count, request, response, resource) {
  var q = new PriorityQueue({ low: true })
  for (n in resource.nodes) {
    var node = resource.nodes[n]
    q.push(node, node.load)
  }
  for (var i = 0; i < count; i++) {
    var node = q.pop()
    response.addNode(node)
    response.addInfo('Added: ' + node.name + ' (' + node.load + ')')
  }
}


var resource = new dnsbalance.DNSResource('www', 60, function(request, response, resource) {
  LeastLoad(3, request, response, resource)
})

resource.addNode(new dnsbalance.DNSNode('node1', ['127.0.0.1', '127.0.1.1'], 123))
resource.addNode(new dnsbalance.DNSNode('node2', ['127.0.0.2'], 128))
resource.addNode(new dnsbalance.DNSNode('node3', ['127.0.0.3'], 5))
resource.addNode(new dnsbalance.DNSNode('node4', ['127.0.0.4'], 15))

var zone = new dnsbalance.DNSZone(
  'fake.atxconsulting.com',
  'tjfontaine.atxconsulting.com',
  60,
  ['ns1.atxconsulting.com']
)
zone.addResource(resource)

var srv = new dnsbalance.DNSBalance(5353)
srv.addZone(zone)
