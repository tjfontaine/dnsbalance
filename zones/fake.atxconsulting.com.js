{
  "name": "fake.atxconsulting.com",
  "email": "tjfontaine.atxconsulting.com",
  "ttl": 300,
  "resources": [
    {
      "name": "www",
      "type": "a",
      "ttl": 60,
      "handler": "LeastLoad(3).LeastRecentlyUsed(1)",
      "nodes": [
        {
          "address": [
            "127.0.0.1",
            "127.0.1.1"
          ],
          "load": 123,
          "name": "node1"
        },
        {
          "address": [
            "127.0.0.2"
          ],
          "load": 128,
          "name": "node2"
        },
        {
          "address": [
            "127.0.0.3"
          ],
          "load": 5,
          "name": "node3"
        },
        {
          "address": [
            "127.0.0.4"
          ],
          "load": 15,
          "name": "node4"
        }
      ]
    }
  ]
}
