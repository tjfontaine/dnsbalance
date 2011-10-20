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

var fs = require('fs');
var path = require('path');

var dnode = require('dnode');
var winston = require('winston');

winston.remove(winston.transports.Console);

winston.add(winston.transports.Console, {
  colorize: true,
  timestamp: true
});

var optimist = require('optimist');

var argv = optimist['default']('c', path.join(path.dirname(__filename), 'config.js'))
  .describe('c', 'Specify the config file')
  .alias('c', 'config')
  .argv;

var DNSBalance = require('./lib/dnsbalance');
var Delegates = require('./lib/delegates');
var Config = require('./lib/configfile');
var RPC = require('./lib/rpc');

var config = new Config(argv.c);

config.on('loaded', function () {
  "use strict";

  var srv, delegates, self = this;

  srv = new DNSBalance(this);
  delegates = new Delegates(this.delegates);

  delegates.on('validated', function (remote) {
    var to_send = srv.sendZones();
    winston.info("exchanging zones");
    remote.zone_exchange(to_send, function (remote_zones) {
      winston.info("received zones");
      srv.receiveZones(remote_zones);
    });
  });

  srv.loadZones(this.zones_directory);

  srv.on('zoneAdded', function (zone) {
    winston.info('Added Zone: ' + zone.name + ' (Serial: ' + zone.serial + ')');
    delegates.zoneAdded(zone);
  });

  srv.on('zoneAdded', function (zone) {
    zone.on('changed_serial', function (old, cur) {
      var o = this.toObject();
      winston.info('serailizing zone: ' + this.name);
      fs.writeFile(
        path.join(self.zones_directory, this.name),
        JSON.stringify(o, null, 2)
      );
    });
  });

  this.rpc.forEach(function (r) { var rpc = new RPC(srv, r); });
});

winston.info("Hello World");
