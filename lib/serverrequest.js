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

"use strict";

var Chainsaw = require('chainsaw'),
  util = require('util'),
  winston = require('winston'),
  NAME_TO_RCODE = require('native-dns').consts.NAME_TO_RCODE;

var ServerRequest = module.exports = function (zones, req, res) {
  var err, question;

  question = req.question[0];

  return Chainsaw(function (saw) {
    this.Failure = function (cb) {
      res.header.rcode = NAME_TO_RCODE.SERVFAIL;
      cb(err);
      saw.down('Done');
      saw.next();
    };

    this.NotFound = function (cb) {
      cb(err);
      res.header.rcode = NAME_TO_RCODE.NOTFOUND;
      saw.down('Done');
      saw.next();
    };

    this.Done = function (cb) {
      cb();
      res.send();
    };

    this.inCache = function (cb) {
      cb(false);
      saw.next();
    };

    this.Lookup = function (cb) {
      zones.lookup(question, function (error, results) {
        if (error) {
          err = error;
          saw.down('Failure');
        } else if (!results) {
          saw.down('NotFound');
        } else {
          res.answer = results.slice();
        }
        cb(results);
        saw.next();
      });
    };

    this.isAllowed = function (cb) {
      cb(true);
      saw.next();
    };

    this.Policy = function (cb) {
      saw.next();
    };

    this.NonQuery = function () {
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
