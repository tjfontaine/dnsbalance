/*
Copyright 2012 Timothy J Fontaine <tjfontaine@gmail.com>

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

var Chainsaw = require('chainsaw');

var ServerRequest = module.exports = function (db, req, res) {
  var question,
    original_name;

  question = req.question[0];
  original_name = question.name;

  return Chainsaw(function (saw) {
    this.fail = function (cb) { cb(this.err); saw.next(); };
    this.notfound = function (cb) { cb(this.err); saw.next(); };
    this.done = function (cb) { cb(); };

    this.hasQuery = function () {
      var asked_domain_name, resource_name;

      asked_domain_name = original_name.split('.').slice(1).join('.');
      resource_name = original_name.split('.').slice(0, 1);

      db.Zone.findOne()
        .where('name', asked_domain_name)
        .where('resource.name', resource_name)
        .where('resource.type', question.type)
        .run(function (err, data) {
          if (err) {
            this.err = err;
            saw.down('fail');
          } else if (data) {
            this.resource = data.resources[0];
          } else {
            this.err = new Error("Not found");
            saw.down('notfound');
          }
          saw.next();
        });
    };

    this.isAllowed = function () {
      saw.next();
    };

    this.Policy = function (cb) {
      var nodes = this.resource.nodes;

      //this.resource.handler(req, nodes, function (results) {
        cb(original_name, this.resource.ttl, nodes);
      //});

      saw.next();
    };

    this.handleNonQuery = function () {
      switch (question.type) {
        case consts.NAME_TO_QTYPE.AXFR:
          saw.down('done');
          break;
        default:
          break;
      }
      saw.next();
    };
  });
};
