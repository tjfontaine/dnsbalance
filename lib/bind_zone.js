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

'use strict';

var utils = require('./utils');

var NAME_TO_QTYPE = require('native-dns').consts.NAME_TO_QTYPE;

var EOL = require('os').EOL;

var LEADING_SPACE = /^\s+/;
var TRAILING_SPACE = /\s+$/;
var DIRECTIVE = /^\$(\w+)\s+/;
var COMMENT = /\s*;.*$/;
var TTL = /(\d+)([wdhm])?/i;
var RR  = /^((?:\.|\w|\*|-|@)+)?\s+(?:(?:(in)\s+)?(?:(\d+(?:[wdhm])?)\s+)?)?(\w+)\s+(.*)$/i;
var RR2 = /^((?:\.|\w|\*|-|@)+)?\s+(?:(?:(\d+(?:[wdhm])?)\s+)?(?:(in)\s+)?)?(\w+)\s+(.*)$/i;

var SOA = /((?:\w|\.|-)+)\s+((?:\w|\.|-)+)\s+(?:\(\s*)?(\d+)\s+(\d+(?:[wdhm])?)\s+(\d+(?:[wdhm])?)\s+(\d+(?:[wdhm])?)\s+(\d+(?:[wdhm])?)/i;
var SRV = /(\d+)\s+(\d+)\s+(\d+)\s((?:\w|\.|-)+)/;
var MX  = /\s*(\d+)\s+((?:\w|\.|-)+)\s*/;

function ttl_to_seconds(ttl) {
  var m = 1;

  if (ttl) {
    if (!(ttl instanceof Array))
      ttl = ttl.match(TTL);

    switch (ttl[2]) {
      case 'w':
      case 'W':
        m = m * 7;
      case 'd':
      case 'D':
        m = m * 24;
      case 'h':
      case 'H':
        m = m * 60;
      case 'm':
      case 'M':
        m = m * 60;
        break;
    }

    ttl = parseInt(ttl[1]) * m;
  }

  return ttl;
}

var BindParser = module.exports = function (zonename, data) {
  var zone = {
    name: zonename,
    records: [],
  };

  var lines = data.split(EOL);

  var state = 'START';

  var origin = utils.ensure_absolute(zonename);

  var line, owner, ttl, rr, directive, tmp, rdata;

  while (lines.length) {
    line = lines[0];
    lines.splice(0, 1);

    line = line.replace(COMMENT, '');

    if (!line.length)
      continue;

    switch (state) {
      case 'START':
        rr = {
          name: undefined,
          type: undefined,
          class: undefined,
        };

        directive = line.match(DIRECTIVE);

        if (directive) {
          line = line.replace(DIRECTIVE, '');
          switch (directive[1]) {
            case 'ORIGIN':
              origin = line.replace(TRAILING_SPACE, '');
              origin = utils.ensure_absolute(origin);
              break;
            case 'INCLUDE':
              state = 'START';
              // TODO XXX FIXME implement
              break;
            case 'TTL':
              ttl = ttl_to_seconds(line);
              break;
          }
        } else {
          tmp = line.match(RR);

          if (!tmp)
            tmp = line.match(RR2);

          if (tmp) {
            if (tmp[1])
              owner = tmp[1];

            rr.name = make_absolute(owner);

            if (tmp[2]) {
              if (tmp[2].toLowerCase() == 'in')
                rr.class = 1;
              else
                rr.ttl = ttl_to_seconds(tmp[2]);
            }

            if (tmp[3]) {
              if (tmp[3].toLowerCase() == 'in')
                rr.class = 1;
              else
                rr.ttl = ttl_to_seconds(tmp[3]);
            }

            rr.type = tmp[4].toUpperCase();
            rdata = tmp[5];

            rr.ttl = rr.ttl || ttl;
            rr.class = rr.class || 1;

            if (/\(/.test(rdata))
              state = 'PAREN';
            else
              state = rr.type.toUpperCase();
          }
        }
        break;
      case 'PAREN':
        rdata += line.replace(TRAILING_SPACE, '');
        if (/\)/.test(line))
          state = rr.type.toUpperCase();
        break;
    }

    var make_absolute = function (field) {
      if (!utils.is_absolute(field) && origin && origin != '.')
        if (field == '@')
          field = origin;
        else
          field += '.' + origin;
      return utils.ensure_absolute(field);
    }

    switch (state) {
      case 'A':
      case 'AAAA':
        rr.address = rdata.replace(/\s+/g, '');
        state = 'DONE';
        break;
      case 'SOA':
        tmp = rdata.match(SOA);

        rr.primary = tmp[1];
        rr.admin = tmp[2];
        rr.serial = parseInt(tmp[3]);
        rr.refresh = ttl_to_seconds(tmp[4]);
        rr.retry = ttl_to_seconds(tmp[5]);
        rr.expiration = ttl_to_seconds(tmp[6]);
        rr.minimum = ttl_to_seconds(tmp[7]);
        state = 'DONE';
        break;
      case 'MX':
        tmp = rdata.match(MX);
        rr.priority = parseInt(tmp[1]);
        rr.exchange = make_absolute(tmp[2]);
        state = 'DONE';
        break;
      case 'TXT':
        rdata = rdata.replace(LEADING_SPACE, '').replace(TRAILING_SPACE, '');
        rr.data = rdata.replace(/^"(.*)"$/, '$1');
        state = 'DONE';
        break;
      case 'NS':
      case 'PTR':
      case 'CNAME':
        rdata = rdata.replace(TRAILING_SPACE, '')
        rr.data = make_absolute(rdata);
        state = 'DONE';
        break;
      case 'SRV':
        tmp = rdata.match(SRV);
        rr.priority = parseInt(tmp[1]);
        rr.weight = parseInt(tmp[2]);
        rr.port = parseInt(tmp[3]);
        rr.target = make_absolute(tmp[4]);
        state = 'DONE';
        break;
    }

    if (state == 'DONE') {
      rr.type = NAME_TO_QTYPE[rr.type];
      zone.records.push(rr);
      state = 'START';
    }
  }

  return zone;
};
