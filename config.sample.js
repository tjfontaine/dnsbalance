{
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
