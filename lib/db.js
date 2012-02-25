var mongoose = require('mongoose');

var winston = require('winston');
var util = require('util');

module.exports = function (str, opts) {
  var ZoneSchema, ResourceSchema, NodeSchema;

  mongoose.connect(str);

  ZoneSchema = require('./schema/zone'),
  ResourceSchema = require('./schema/resource'),
  NodeSchema = require('./schema/node');

  this.Zone = mongoose.model('Zone', ZoneSchema);
  this.Resource = mongoose.model('Resource', ResourceSchema);
  this.Node = mongoose.model('Node', NodeSchema);
};
