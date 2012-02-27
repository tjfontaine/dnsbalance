var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  NodeSchema = require('./node'),
  util = require('./util'),
  consts = require('native-dns').consts;

var qtypeNames = Object.keys(consts.NAME_TO_QTYPE);

var ResourceSchema = new Schema({
  name: { type: String, unique: true, lowercase: true, required: true },
  ttl: { type: Number, min: 1, max: 4294967295, default: 3600 },
  type: { type: String, uppercase: true, enum: qtypeNames, default: 'A' },
  nodes: [ NodeSchema ],
}, {
  strict: true,
});

ResourceSchema.path('type').set(function (t) {
  if (t instanceof Number || typeof(t) === 'number')
    return consts.qtypeToName(t);
  else
    return t;
});

module.exports = ResourceSchema;
