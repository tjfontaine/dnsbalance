Generic DNS server to dynamically distribute load among a given set of resources

WORKING (and barely tested)
---------------------------

 * loading bind style zones
 * loading zones from js files
 * responding to basic queries
 * zones stored in memory

TODO
----

 * response caching
 * recursive queries (including forwarding)
 * alternate storage backends (memcache, redis, mongo etc)
 * add/remove/change zones/resources/nodes on the fly
 * change RR policy on the fly
 * discover peer balancers
 * automatic sync with peer balancers
 * AXFR

Dependencies
------------

 * native-dns
 * winston
 * optimist
 * chainsaw
