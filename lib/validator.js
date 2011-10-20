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

var EventEmitter = require('events').EventEmitter;
var util = require('util');

var Hash = require('hashish');
var winston = require('winston');

var Validator = function (obj) {
  "use strict";

  var fields, self = this;

  EventEmitter.call(this);

  this._required = {};
  this._reserved = {};

  this._in_init = false;

  if (!this._fields.serial) {
    this._fields.serial = {
      propagate: false,
      default: 0,
    };
  }

  fields = new Hash(this._fields);

  fields.forEach(function (field, name) {
    var desc = {};

    field.name = name;

    if (!field.reserved) {
      if (field.required) {
        self._required[field.name] = true;
      }

      if (field.enumerable === false) {
        desc.enumerable = false;
      } else {
        desc.enumerable = true;
      }

      desc.get = function () {
        if (field.value === undefined) {
          field.value = field.default;
        }

        return field.value;
      };

      if (field.writable !== false) {
        desc.set = function (val) {
          var when;

          if (self._in_init) {
            when = 0;
          } else {
            when = new Date().getTime();
          }

          self._setField(field.name, when, val);
        };
      } else {
        desc.set = undefined;
      }
    } else {
      self._reserved[field.name] = true;
      desc = {
        value: undefined,
        writable: false,
        enumerable: false,
        configurable: false,
      };
    }

    Object.defineProperty(self, field.name, desc);
  });

  if (obj) {
    this.fromObject(obj);
  }
};
util.inherits(Validator, EventEmitter);

Validator.prototype._setField = function (property, when, value) {
  var field, old;

  field = this._fields[property];

  if (!field) {
    winston.error('Unable to setField: ' + property);
    return;
  }

  old = field.value;

  field.when = when;
  field.value = value;

  if (!this._in_init) {
    if (field.name === 'serial') {
      field.value = new Date().getTime();
      field.when = field.value;
    }

    if (field.increments) {
      this.serial += 1;
    }

    if (field.propagate !== false) {
      this.propagate(field);
    }

    this.emit('changed_' + field.name, old, value);
  } else {
    if (field.name === 'serial') {
      field.when = field.value;
    }
  }
};

Validator.prototype.propagate = function (field) {
  winston.info(['propagate', field.name, field.when, field.value].join(','));
  this.emit('propagate', field.name, field.when, field.value);
};

Validator.prototype.onPropagate = function (prop, when, val) {
  var field;

  if (this._fields[prop]) {
    field = this._fields[prop];
    if (when > field.when && val !== field.value) {
      this._setField(prop, when, val);
    } else {
      winston.info(prop + ': When (Ours: ' + field.when + ', Theirs: ' + when + '), Value: (Ours: ' + field.value + ', Theirs: ' + val + ')');
    }
  } else {
    winston.error('Trying to propagate non-existent field: ' + prop);
  }
};

Validator.prototype.isExcepted = function (k) {
  if (this._reserved[k] || k.toString().slice(0, 1) === '_'
      || EventEmitter.prototype[k]
      || Object.prototype.toString.call(this[k]) === "[object Function]"
      && k.toLowerCase() !== "handler") {
    return true;
  } else {
    return false;
  }
};

Validator.prototype.hasRequired = function (obj) {
  var r;

  for (r in this._required) {
    if (this._required.hasOwnProperty(r)) {
      if (!obj[r]) {
        throw new Error("Missing property: " + r);
      }
    }
  }
};

Validator.prototype.fromObject = function (obj) {
  var k;

  this._in_init = true;
  this.hasRequired(obj);

  for (k in obj) {
    if (obj.hasOwnProperty(k) && !this.isExcepted(k)) {
      this._setField(k, 0, obj[k]);
    }
  }

  if (!this.serial) {
    this.serial = 1;
  }

  this._in_init = false;
};

Validator.prototype.toObject = function () {
  var r, k;

  r = {};

  for (k in this) {
    if (this.hasOwnProperty(k) && !this.isExcepted(k)) {
      r[k] = this[k];
    }
  }

  return r;
};

module.exports = Validator;
