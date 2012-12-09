{
  acl: {
    local: {
      recursion: true,
      ip: '127.0.0.1',
    },
  },
  forwarders: [
    '8.8.8.8',
    '8.8.4.4',
  ],
  query: [{
    ip: '0.0.0.0',
    port: 15353,
  }],
  serve: {
    'example.com': {
      type: 'master',
      file: './zones/example.com.zone',
    },
    'example.net': {
      type: 'master',
      file: './zones/example.net.js',
    },
  },
}
