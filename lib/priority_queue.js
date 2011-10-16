/*
https://raw.github.com/STRd6/PriorityQueue.js/master/src/priority_queue.js

Copyright 2009 Daniel X Moore

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

var prioritySortLow = function(a, b) {
  return b.priority - a.priority;
};

var prioritySortHigh = function(a, b) {
  return a.priority - b.priority;
};

var PriorityQueue = function(options) {
  var contents, sorted, sortStyle, sort, self;

  contents = [];

  sorted = false;

  if(options && options.low) {
    sortStyle = prioritySortLow;
  } else {
    sortStyle = prioritySortHigh;
  }

  sort = function() {
    contents.sort(sortStyle);
    sorted = true;
  };

  self = {
    pop: function() {
      var element;

      if(!sorted) {
        sort();
      }

      element = contents.pop();

      if(element) {
        return element.object;
      } else {
        return undefined;
      }
    },
    top: function() {
      var element;

      if(!sorted) {
        sort();
      }

      element = contents[contents.length - 1];

      if(element) {
        return element.object;
      } else {
        return undefined;
      }
    },
    includes: function(object) {
      var i;

      for(i = contents.length - 1; i >= 0; i--) {
        if(contents[i].object === object) {
          return true;
        }
      }

      return false;
    },
    size: function() {
      return contents.length;
    },
    empty: function() {
      return contents.length === 0;
    },
    push: function(object, priority) {
      contents.push({object: object, priority: priority});
      sorted = false;
    }
  };

  return self;
};
exports.PriorityQueue = PriorityQueue;
