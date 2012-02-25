var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  NodeSchema = require('./node'),
  util = require('./util');

var ResourceSchema = new Schema({
  name: { type: String, unique: true, set: util.lower, required: true },
  ttl: { type: Number, min: 1, max: 4294967295, default: 3600 },
  type: { type: Number, min: 1, max: 255, default: 1 },
  nodes: [ NodeSchema ],
}, {
  strict: true,
});

module.exports = ResourceSchema;
