var config = require('easy-config');
var test = require('tap').test;
var messente = require('../lib/client');

// Globals
var client = null;
var ids = null;

test('create a new client', function(t) {
  messente.createClient(config, function(err, _client) {
    t.ifError(err, 'Messente client creation error');
    t.ok(_client, 'Messente client created');

    client = _client;
    t.end();
  });
});

test('sending a message', function(t) {
  var opts = {
    to: config.phones,
    text: 'Hello!',
    timeToSend: new Date('Fri, 31 Dec 2012 22:10:00 GMT')
  };

  client.sendMessage(opts, function(err, result, _ids) {
    console.log(result);
    ids = _ids;
    t.end();
  });
});

test('get reports', function(t) {
  client.getReport(ids, function(err, result) {
    console.log(result);
    t.end();
  });
});

test('get account balance', function(t) {
  client.getAccountBalance(function(err, result) {
    console.log(result);
    t.end();
  });
});