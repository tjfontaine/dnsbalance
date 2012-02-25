var net = require('net');

exports.lower = function (v) { return v.toLowerCase(); }

exports.validAddress = function (v) {
  return net.isIP(v);
};
