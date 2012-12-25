var config = require('easy-config');
var test = require('tap').test;
var Client = require('../lib/client');

// Globals
var client = null;

test('create a new client', function(t) {
  client = new Client(config);

  t.ok(client, 'client created');
  t.end();
});