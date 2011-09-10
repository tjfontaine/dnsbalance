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

var dgram = require('dgram')
var EventEmitter = require('events').EventEmitter
var util = require('util')

var struct = require('struct')
var winston = require('winston')

require('bufferjs/concat')

Object.defineProperty(Object.prototype, "extend", {
    enumerable: false,
    value: function(from) {
        var props = Object.getOwnPropertyNames(from);
        var dest = this;
        props.forEach(function(name) {
            if (name in dest) {
                var destination = Object.getOwnPropertyDescriptor(from, name);
                Object.defineProperty(dest, name, destination);
            }
        });
        return this;
    }
});

var Server = function(type) {
  this.socket = dgram.createSocket(type)
  var self = this
  this.socket.on('message', function(msg, remote) {
    self.handleMessage(msg, remote)
  })
  this.socket.on('listen', function() { self.emit('listen') })
  this.socket.on('close', function() { self.emit('close') })
}
util.inherits(Server, EventEmitter)

Server.prototype.bind = function(port, ip) {
  this.socket.bind(port, ip)
}

Server.prototype.close = function() {
  this.socket.close()
}

Server.prototype.address = function() {
  return this.socket.address()
}

var Message = function() {
  this.size = struct.calcsize(this._format)
}

Message.prototype.unpack = function(buff) {
  var unpacked = struct.unpack(this._format, buff)
  if (unpacked.length != this._fields.length) {
    throw new Error("Invalid message unpack, expected " + this._fields.length + " fields, got " + unpacked.length)
  }
  for (var i=0; i<unpacked.length; i++) {
    var field = this._fields[i]
    var value = unpacked[i]
    this[field.name] = value
    if (field.subfields) {
      for (var j=0; j<field.subfields.length; j++) {
        var sfield = field.subfields[j]
        this[sfield.name] = (value & sfield.mask) >> sfield.shift
      }
    }
  }
}

Message.prototype.pack = function() {
  var args = [this._format]
  for (var i=0; i<this._fields.length; i++) {
    var field = this._fields[i]
    if (field.subfields) {
      var f = 0
      for (var j=0; j<field.subfields.length; j++) {
        var sfield = field.subfields[j]
        var value = this[sfield.name] || 0
        var v = value << sfield.shift
        v = v & sfield.mask
        f += v
      }
      this[field.name] = f
    }
    args.push(this[field.name])
  }
  return struct.pack.apply(null, args)
}

var Header = function() {
  this._format = '>6H'
  this._fields = [
    {
      name: 'id',
    },
    {
      name: 'bitfields',
      subfields: [
        {
          name: 'qr',
          mask: 0x8000,
          shift: 15,
        },
        {
          name: 'opcode',
          mask: 0x7800,
          shift: 11,
        },
        {
          name: 'aa',
          mask: 0x0400,
          shift: 10,
        },
        {
          name: 'tc',
          mask: 0x0200,
          shift: 9,
        },
        {
          name: 'rd',
          mask: 0x0100,
          shift: 8,
        },
        {
          name: 'ra',
          mask: 0x0080,
          shift: 7,
        },
        {
          name: 'res1',
          mask: 0x0040,
          shift: 6,
        },
        {
          name: 'res2',
          mask: 0x0020,
          shift: 5,
        },
        {
          name: 'res3',
          mask: 0x0010,
          shift: 4,
        },
        {
          name: 'rcode',
          mask: 0x000f,
          shift: 0,
        },
      ],
    },
    {
      name: 'qdcount',
    },
    {
      name: 'ancount',
    },
    {
      name: 'nscount',
    },
    {
      name: 'arcount',
    },
  ]
  Message.call(this)
}
util.inherits(Header, Message)

var unpack_name = function(buff) {
  var pos = 0
  var len = buff.readUInt8(pos)
  var parts = []
  while (len != 0) {
    if (len & 0xC0) { throw new Error("Invalid packed name, not using label format: " + len) }
    pos++
    var end = pos + len
    if (end > buff.length) { end = buff.length }
    parts.push(buff.toString('ascii', pos, end))
    pos += len
    len = buff.readUInt8(pos)
  }
  return {
    value: parts.join('.'),
    position: pos+1,
  }
}

var pack_name = function(str) {
  var a = str.split('.')
  var buff = new Buffer(str.length + 2)
  var pos = 0
  for (var i=0; i<a.length; i++) {
    var b = a[i]
    if (b.length) {
      buff.writeUInt8(b.length, pos)
      pos++
      buff.write(b, pos, b.length)
      pos += b.length
    }
  }
  buff.writeUInt8(0, pos)
  return buff
}

var Question = function() {
}

Question.prototype.unpack = function(buff) {
  var a = unpack_name(buff)
  this.name = a.value
  var b = struct.unpack('>2H', buff.slice(a.position))
  this.type = b[0]
  this.qclass = b[1]
  this.size = 4 + a.position
}

Question.prototype.pack = function() {
  var name = pack_name(this.name)
  var a = struct.pack('>2H', this.type, this.qclass)
  return Buffer.concat(name, a)
}

var ResourceRecord = function(vals) {
  this._base_fields = [
    {
      name: 'name',
      string: true,
    },
    {
      name: 'type',
      format: 'H',
    },
    {
      name: 'class',
      format: 'H',
    },
    {
      name: 'ttl',
      format: 'I',
    },
  ]
  
  if (vals) {
    for (var k in vals) {
      this[k] = vals[k]
    }
  }
}
util.inherits(ResourceRecord, Message)

ResourceRecord.prototype.pack = function() {
  var self = this
  function iterFields(fields) {
    var ret = new Buffer(0)
    for (var i=0; i<fields.length; i++) {
      var arg = fields[i]
      if (arg.string === true) {
        var t = pack_name(self[arg.name])
        ret = Buffer.concat(ret, t)
      } else {
        var t = struct.pack('>'+arg.format, self[arg.name])
        ret = Buffer.concat(ret, t)
      }
    }
    return ret
  }

  var ret = iterFields(this._base_fields)
  var rdata = iterFields(this._rdata_fields)

  return Buffer.concat(ret, struct.pack('>H', rdata.length), rdata)
}

var SOA = exports.SOA = function(vals) {
  this._rdata_fields = [
    {
      name: 'primary',
      string: true,
    },
    {
      name: 'admin',
      string: true,
    },
    {
      name: 'serial',
      format: 'I',
    },
    {
      name: 'refresh',
      format: 'I',
    },
    {
      name: 'retry',
      format: 'I',
    },
    {
      name: 'expiration',
      format: 'I',
    },
    {
      name: 'minimum',
      format: 'I',
    },
  ]
  ResourceRecord.call(this, vals)
}
util.inherits(SOA, ResourceRecord)

var Response = exports.Response = function(socket, rinfo, header) {
  this._socket = socket
  this._rinfo = rinfo

  this.header = new Header()
  this.header.qr = 1
  this.header.id = header.id

  this.question = []
  this.answer = []
  this.authority = []
  this.additional = []
}

Response.prototype.send = function() {
  this.header.qdcount = this.question.length
  this.header.ancount = this.answer.length
  this.header.nscount = this.authority.length
  this.header.arcount = this.additional.length

  var message = this.header.pack()

  function append(arrs) {
    for (var i=0; i<arrs.length; i++) {
      var a = arrs[i]
      message = Buffer.concat(message, a.pack())
    }
  }

  append(this.question)
  append(this.answer)
  append(this.authority)
  append(this.additional)

  this._socket.send(message, 0, message.length, this._rinfo.port, this._rinfo.address)
}

Server.prototype.handleMessage = function(msg, remote) {
  var h = new Header()
  var t = msg.slice(0, h.size)
  h.unpack(t)
  var pos = h.size

  var request = {
    header: h,
    rinfo: remote,
    questions: [],
  }

  for (var i=0; i<h.qdcount; i++) {
    var q = new Question()
    q.unpack(msg.slice(pos))
    pos += q.size
    request.questions.push(q)
  }

  var response = new Response(this.socket, remote, h)

  this.emit('request', request, response)
}

exports.createServer = function(type) {
  return new Server(type)
}
