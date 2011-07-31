{
  "name": "fake.atxconsulting.com",
  "soa": "tjfontaine.atxconsulting.com",
  "ttl": 300,
  "delegates": {
    "ns1.fake.atxconsulting.com": {
      "ips": [
        "127.0.0.1"
      ],
      "ttl": 60
    }
  },
  "resources": {
    "www": {
      "name": "www",
      "ttl": 60,
      "handler": "handler = function (req, nodes, end) {\n          Policy(req, nodes)\n            .LeastLoad(3)\n            .LeastRecentlyUsed(1)\n            .done(end)\n        }",
      "nodes": {
        "node1": {
          "ips": [
            "127.0.0.1",
            "127.0.1.1"
          ],
          "load": 123,
          "name": "node1"
        },
        "node2": {
          "ips": [
            "127.0.0.2"
          ],
          "load": 128,
          "name": "node2"
        },
        "node3": {
          "ips": [
            "127.0.0.3"
          ],
          "load": 5,
          "name": "node3"
        },
        "node4": {
          "ips": [
            "127.0.0.4"
          ],
          "load": 15,
          "name": "node4"
        }
      }
    }
  }
}