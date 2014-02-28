'use strict';

var demand = require('must');
var messente = require('../lib/client');

describe('Messente API client', function () {
  var client = null;
  var ids = [];

  var numbers = process.env.MSNTE_NUMBERS.split(',') || [];
  var opts = {
    secure: process.env.MSNTE_SECURE ? process.env.MSNTE_SECURE : true,
    username: process.env.MSNTE_USER || null,
    password: process.env.MSNTE_PWD || null
  };

  it('should create a new client', function (done) {
    messente.createClient(opts, function(err, _client) {
      demand(err).be.null();
      demand(_client).be.object();

      client = _client;
      done();
    });
  });

  it('should send a message', function (done) {
    client.sendMessage({ text: 'Hello!', to: numbers }, function onFinish (err, result, _ids) {
      demand(err).be.null();
      demand(result).be.object();
      demand(_ids).be.array();
      demand(_ids).length(1);

      ids = _ids;
      done();
    });
  });

  // NOTE: Messente 'get_dlr_response' API call seems to be broken
  it('should get message report', function (done) {
    client.getReport(ids, function onFinish (err, result) {
      demand(err).be.null();
      demand(result).be.object();

      done();
    });
  });

  it('should get account balance', function (done) {
    client.getAccountBalance(function onFinish (err, balance) {
      demand(err).be.null();
      demand(balance).be.number();

      done();
    });
  });

  it('should get pricelist list for country', function (done) {
    client.getPricesForCountry('EE', function onFinish (err, prices) {
      demand(err).be.null();
      demand(prices).be.object();

      done();
    });
  });

  it('should get all prices', function (done) {
    client.getPrices(function onFinish (err, prices) {
      demand(err).be.null();
      demand(prices).be.object();

      done();
    });
  });
});