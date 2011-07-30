var Policy = require('./lib/policy').Policy

var zones = {
  'fake.atxconsulting.com': {
    ttl: 300,
    email: 'tjfontaine.atxconsulting.com',
    delegates: {
      'ns1.fake.atxconsulting.com': {
        ips: [ '127.0.0.1'],
        ttl: 60,
      },
    },
    resources: {
      'www': {
        type: 'a',
        ttl: 60,
        handler: function(req, nodes, end) {
          Policy(req, nodes)
            .LeastLoad(3)
            .LeastRecentlyUsed(1)
            .done(end)
        },
        nodes: {
          node1: {
            ips: [ '127.0.0.1', '127.0.1.1' ],
            load: 123,
          },
          node2: {
            ips: [ '127.0.0.2' ],
            load: 128,
          },
          node3: {
            ips: [ '127.0.0.3' ],
            load: 5,
          },
          node4: {
            ips: [ '127.0.0.4' ],
            load: 15,
          },
        },
      },
    },
  }
}
exports.zones = zones
