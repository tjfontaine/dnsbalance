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
/*jshint debug:true */

"use strict";

var fs = require('fs'),
  path = require('path'),
  util = require('util'),
  winston = require('winston'),
  optimist = require('optimist'),
  Config = require('./lib/configfile'),
  DB = require('./lib/db'),
  DNSBalance = require('./lib/dnsbalance');

//require('long-stack-traces');

winston.remove(winston.transports.Console);

winston.add(winston.transports.Console, {
  colorize: true,
  timestamp: true
});

var argv = optimist['default']('c', path.join(path.dirname(__filename), 'config.js'))
  .describe('c', 'Specify the config file')
  .alias('c', 'config')
  .argv;

var config = new Config(argv.c);

config.on('loaded', function () {
  var srv, self = this;

  this.db = new DB(this.database);
  this.zones = {};

  fs.readdir(this.zones_directory, function (err, files) {
    files.forEach(function (file) {
      var p;
      if (file.match(/.js$/i)) {
        p = path.resolve(self.zones_directory, file);
        winston.info(p);
        fs.readFile(p, function (err, data) {
          var zone = JSON.parse(data);
          self.db.Zone.find()
            .where('name', zone.name)
            .remove(function (err, affected) {
              winston.info(affected, 'removed');
              var z = new self.db.Zone(zone);
              z.save();
              self.zones[z.name] = z.id;
              winston.info('adding: ' + z.name + ' (' + z.id + ')');
            });
        });
      }
    });
  });

  srv = new DNSBalance(self);

  setInterval(function () {
    self.db.Zone.find()
      .where('name').nin(Object.keys(self.zones))
      .only('name')
      .run(function (err, data) {
        data.forEach(function (z) {
          self.zones[z.name] = z.id;
          winston.info('adding: ' + z.name + ' (' + z.id + ')');
        });
      });
  }, 30000);
});
