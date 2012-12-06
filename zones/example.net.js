a = {
  name: 'example.net',
  records: [{
    name: 'www',
    type: 'a',
    ttl: 60,
    address: '127.0.0.1',
  }, {
    name: 'www',
    type: 'a',
    ttl: 60,
    address: '127.0.0.2',
  }, {
    name: 'test',
    type: 'cname',
    ttl: 600,
    data: 'www.example.com',
  }],
}
