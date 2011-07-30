
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

var PriorityQueue = require('./priority_queue').PriorityQueue

var LeastLoad = exports.LeastLoad = function(count) {
  if (!count || count <= 0) {
    count = 3
  }
  return function (request, nodes) {
    var q = new PriorityQueue({ low: true })
    for (n in nodes) {
      var node = nodes[n]
      q.push(node, node.load)
    }
    var results = []
    for (var i = 0; i < count; i++) {
      results.push(q.pop())
    }
    return results
  }
}

var LeastRecentlyUsed = exports.LeastRecentlyUsed = function(count) {
  if (!count || count <= 0) {
    count = 1
  }
  return function (request, nodes) {
    var q = new PriorityQueue({ low: true })
    for (n in nodes) {
      var node = nodes[n]
      if (!node.last_used) {
        node.last_used = new Date().getTime()
      }
      q.push(node, node.last_used)
    }
    var results = []
    for (var i = 0; i < count; i++) {
      results.push(q.pop())
    }
    return results
  }
}
