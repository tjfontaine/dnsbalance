var net = require('net');

exports.validAddress = function (v) {
  return net.isIP(v);
};
