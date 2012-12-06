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
  vm = require('vm'),
  winston = require('winston'),
  optimist = require('optimist'),
  Config = require('./lib/configfile'),
  Zones = require('./lib/zones').Zones,
  BindParser = require('./lib/bind_zone'),
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

  this.zones = new Zones();

  Object.keys(this.serve).forEach(function (zonename) {
    var cfg = self.serve[zonename];
    var zone, zonedata, p;

    p = path.resolve(cfg.file);

    winston.debug('Loading zone: ' + zonename + ' ' + p);

    if (/.js$/i.test(p)) {
      zonedata = fs.readFileSync(p);
      zone = vm.runInThisContext('a = ' + zonedata.toString());
      zone.name = zonename;
    } else if (/.zone$/i.test(p)) {
      zonedata = fs.readFileSync(p);
      zone = BindParser(zonename, zonedata.toString());
    } else {
      winston.info('Invalid file type: ' + p);
    }

    if (zone) {
      self.zones.add(zone, function (err, result) {
        winston.info('zone: ' + zonename + ' loaded');
      });
    }
  });

  srv = new DNSBalance(self);
});
