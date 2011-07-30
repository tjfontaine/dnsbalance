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
        handlers: [
          require('./lib/policy').LeastLoad(3),
          require('./lib/policy').LeastRecentlyUsed(1),
        ],
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
