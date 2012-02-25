var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  ResourceSchema = require('./resource'),
  util = require('./util');

var ZoneSchema = new Schema({
  name: { type: String, unique: true, set: util.lower, required: true },
  email: { type: String, required: true },
  serial: { type: Number, min: 1, max: 4294967295, default: 1 },
  refresh: { type: Number, min: 1, max: 2147483647, default: 3600 },
  retry: { type: Number, min: 1, max: 2147483647, default: 1200 },
  expiration: { type: Number, min: 1, max: 2147483647, default: 1209600 },
  minimum: { type: Number, min: 1, max: 10800, default: 3600 },
}, {
  strict: true,
});

module.exports = ZoneSchema;
