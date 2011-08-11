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
var util = require('util')
var winston = require('winston')

var Validator = function(obj) {
  EventEmitter.call(this)

  this._required = {}
  this._reserved = {}

  this._in_init = false

  var serial, serial_when

  Object.defineProperty(this, 'serial', {
    enumerable: true,
    get: function() {
      return serial
    },
    set: function(val) {
      var old = serial
      serial = val
      serial_when = new Date().getTime()

      if (old || old != serial) {
        this.emit('changed_serial', old, serial)
      }
    },
  })

  var self = this

  var fields = []
  for (var f in this._fields) {
    var field = this._fields[f]
    field.name = f
    fields.push(field)
  }

  fields.forEach(function(field, i) {
    var desc = {}

    if (!field.reserved) {
      if (field.required) {
        self._required[field.name] = true
      }

      if (field.enumerable === false) {
        desc.enumerable = false
      } else {
        desc.enumerable = true
      }

      desc.get = function() {
        if (field.value === undefined) {
          field.value = field.default
        }
        return field.value
      }

      if (field.writable !== false) {
        desc.set = function(val) {
          var old = field.value
          field.value = val

          if (self._in_init) {
            field.when = 0
          } else {
            field.when = new Date().getTime()

            if (field.increments) {
              self.serial += 1
            }

            if (field.propagate !== false) {
              self.propagate(field)
            }
          }
        }
      } else {
        desc.set = undefined
      }
    } else {
      self._reserved[field.name] = true
      desc = {
        value: undefined,
        writable: false,
        enumerable: false,
        configurable: false,
      }
    }

    Object.defineProperty(self, field.name, desc)
  })

  if (obj) {
    this.fromObject(obj)
  }
}
sys.inherits(Validator, EventEmitter)

Validator.prototype.propagate = function(field) {
  this.emit('propagate', field.name, field.when, field.value)
}

Validator.prototype.onPropagate = function(prop, when, val) {
  if (this._fields[prop]) {
    var field = this._fields[prop]
    if (when > field.when && val != field.value) {
      field.when = when
      field.value = val
      this.propagate(field)
    }
  }
}

Validator.prototype.isExcepted = function(k) {
  if (this._reserved[k] || k.toString().slice(0, 1) == '_') {
    return true
  } else {
    return false
  }
}

Validator.prototype.hasRequired = function(obj) {
  for (var r in this._required) {
    if (!obj[r]) {
      throw new Error("Missing property: " + r)
    }
  }
}

Validator.prototype.fromObject = function(obj) {
  this._in_init = true
  this.hasRequired(obj)

  for (var k in obj) {
    if (!this.isExcepted(k)) {
      this[k] = obj[k]
    }
  }

  if (!this.serial) {
    this.serial = 1
  }
  this._in_init = false
}

Validator.prototype.toObject = function() {
  var r = {}
  for (var k in this) {
    if (!this.isExcepted(k)) {
      r[k] = this[k]
    }
  }
  return r
}

exports.Validator = Validator
