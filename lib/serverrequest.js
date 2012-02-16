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

var ServerRequest = module.exports = function (zones, req, res) {
  var question,
    original_name,
    asked_domain_name;

  question = req.question[0];
  original_name = question.name;
  asked_domain_name = original_name.split('.').slice(1).join('.');

  return Chainsaw(function (saw) {
    this.fail = function (cb) { cb(this.err); saw.next(); };
    this.notfound = function (cb) { cb(this.err); saw.next(); };
    this.done = function (cb) { cb(); };

    this.hasDomain = function () {
      var original_domain, asked_domain;

      original_domain = zones[original_name];
      asked_domain = zones[asked_domain_name];

      if (!asked_domain && !original_domain) {
        this.err = true;
        saw.down('notfound');
      }

      if (original_domain) {
        this.resouce_name = '@';
        this.domain = original_domain;
      } else {
        this.resource_name = original_name.splice('.').slice(0, 1);
        this.domain = asked_domain;
      }

      saw.next();
    };

    this.hasResource = function () {
      if (question.type === consts.NAME_TO_QTYPE.SOA) {
        this.resource = 'SOA';
      } else {
        this.resource = this.domain.getResource(this.resource_name, question.type) || this.domain.getResource('*', question.type);
      }

      if (!this.resource) {
        this.err = true;
        saw.down('notfound');
      }

      saw.next();
    };

    this.isAllowed = function () {
      saw.next();
    };

    this.Policy = function (cb) {
      var nodes = this.resource.getNodes().values;

      this.resource.handler(req, nodes, function (results) {
        cb(original_name, this.resource.ttl, results);
      });

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
