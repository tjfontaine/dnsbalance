var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  util = require('./util');

var NodeSchema = new Schema({
  name: { type: String, unique: true, set: util.lower, required: true },
  address: [ { type: String, validate: [util.validAddress, 'invalid address format'] } ],
  region: { type: String, default: 'global' },
}, {
  strict: true,
});


module.exports = NodeSchema;
