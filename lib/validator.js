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

var EventEmitter = require('events').EventEmitter
var sys = require('sys')
var winston = require('winston')

var Validator = function() {
  EventEmitter.call(this)
}
sys.inherits(Validator, EventEmitter)

Validator.prototype.setSerial = function(s) {
  var old = this.serial
  if (s) {
    this.serial = {
      serial: s,
      when: new Date().getTime(),
    }
  }

  if (!old || old.serial != this.serial.serial) {
    this.emit('changed_serial', old, this.serial)
  }
}

Validator.prototype.serialNext = function() {
  winston.info(typeof(this) + ': incrementing serial')
  this.setSerial(this.serial.serial + 1)
}

Validator.prototype.isExcepted = function(k) {
  var excluded = [
    'required',
    'excepted',
    'increments_serial',
    'parent',
    '_events',
  ]
  return this.excepted.concat(excluded).indexOf(k) > -1
}

Validator.prototype.hasRequired = function(obj) {
  for (var r in this.required) {
    if (!obj[r]) {
      throw new Error("Missing property: " + r)
    }
  }
}

Validator.prototype.set = function(name, value) {
  winston.info('set: ' + [name, value].join(', '))
  if (name != 'serial') {
    var old = this[name]
    if (old != value) {
      this[name] = value
      winston.info('emit changed_'+name + ' params: ' +[old, value].join(', '))
      this.emit('changed_'+name, old, value)

      if(this.increments_serial.indexOf(name) > -1) {
        this.serialNext()
      }
    }
  }
}

Validator.prototype.fromObject = function(obj) {
  this.hasRequired(obj)

  for (var k in obj) {
    if (!this.isExcepted(k)) {
      this[k] = obj[k]
    }
  }

  if (!this.serial) {
    this.setSerial(1)
  }
}

exports.Validator = Validator
