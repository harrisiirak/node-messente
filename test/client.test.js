var config = require('easy-config');
var test = require('tap').test;
var messente = require('../lib/client');

// Globals
var client = null;

test('create a new client', function(t) {
  messente.createClient(config, function(err, cli) {
    t.ifError(err, 'Messente client creation error');
    t.ok(cli, 'Messente client created');

    client = cli;
    t.end();
  });
});

test('sending a message', function(t) {
  var opts = {
    to: config.phones,
    text: 'Hello!'
  };

  client.sendMessage(opts, function(err, result) {
    console.log(arguments);
    t.end();
  });
});