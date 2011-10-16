
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

"use strict";

var PriorityQueue = require('./priority_queue').PriorityQueue;
var Chainsaw = require('chainsaw');

var Policy = function(req, nodes) {
  return Chainsaw(function(saw) {
    this.LeastLoad = function(count) {
      var q, n, i, results, node;

      if (!count || count <= 0) {
        count = 3;
      }

      q = new PriorityQueue({ low: true });

      for (n in nodes) {
        if (nodes.hasOwnProperty(n)) {
          node = nodes[n];
          q.push(node, node.load);
        }
      }

      results = [];

      for (i = 0; i < count; i++) {
        results.push(q.pop());
      }

      nodes = results;
      saw.next();
    };

    this.LeastRecentlyUsed = function(count) {
      var q, n, i, results, node;

      if (!count || count <= 0) {
        count = 1;
      }

      q = new PriorityQueue({ low: true });

      for (n in nodes) {
        if (nodes.hasOwnProperty(n)) {
          node = nodes[n];

          if (!node.last_used) {
            node.last_used = new Date().getTime();
          }

          q.push(node, node.last_used);
        }
      }

      results = [];

      for (i = 0; i < count; i++) {
        results.push(q.pop());
      }

      nodes = results;
      saw.next();
    };

    this.done = function(cb) {
      cb(nodes);
    };
  });
};

exports.Policy = Policy;
