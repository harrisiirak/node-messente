'use strict';

var request = require('request');
var when = require('when');

function Client(opts) {
  this._username = opts.username;
  this._password = opts.password;
  this._url = (opts.secure ? 'http' : 'https') + '://api2.messente.com/';
}

Client._ERRORS = {
  101: 'Access is restricted, wrong credentials.',
  102: 'Parameters are wrong or missing.',
  103: 'Invalid IP address.',
  105: 'No such country or area code.',
  106: 'Destination country is not supported.',
  107: 'Not enough credit on account.',
  111: 'Sender parameter from is invalid.',
  208: 'Account credit balance undetermined, try again.',
  209: 'Server failure, try again.'
};

Client.prototype.sendMessage = function(opts, callback) {
  var self = this;

  if (!opts.text || !opts.to) {
    return callback(new Error('Missing message content or target phone number(s)'));
  }

  if (opts.timeToSend && !(opts.timeToSend instanceof Date)) {
    return callback(new Error('Date object is required'));
  }

  // Buld message
  var message = {
    username: this._username,
    password: this._password
  };

  message.text = opts.text;
  message.autoconvert = opts.autoconvert ? true : false;
  message.charset = opts.chartset ? opts.charset : 'UTF8';

  if (opts.timeToSend) {
    message.time_to_send = opts.timeToSend.getTime() + (opts.timeToSend.getTimezoneOffset() * 60 * 1000);
  }

  if (opts.from) {
    message.from = opts.from;
  }

  if (opts.reportURL) {
    message['dlr-url'] = opts.reportURL;
  }

  // Promise wrapper function
  function send(phone) {
    var deffered = when.defer();
    message.to = phone; // Set recipient

    request.post(self._url + 'send_sms/', function(err, res, body) {
      if (err) {
        // Error is acceptable, do not reject promise
        return deffered.resolver.resolve({ error: err, code: null, phone: phone });
      }

      // Parse response body
      var tokens = body.split(' ');
      var response = {
        type: tokens[0],
        code: tokens[1]
      };

      if (response.type === 'OK') {
        return deffered.resolver.resolve({ error: null, code: code, phone: phone });
      } else {
        var error = Client._ERRORS[response.code] || 'Unknown error';
        return deffered.resolver.resolve({ error: new Error(error), code: null, phone: phone });
      }
    }).form(message);

    return deffered.promise;
  }

  // Create promises
  var promises = [];
  for (var i = 0, c = opts.to.length; i < c; i++) {
    promises.push(send(opts.to[i]));
  }

  when.all(promises).then(
    function(results) {
      callback(null, results);
    },

    function(err) {
      callback(err);
    }
  );
};

Client.prototype.getMessageReport = function() {

};

Client.prototype.getAccountBalance = function() {

};

Client.createClient = function(opts, callback) {
  if (!opts.username || !opts.password) {
    return callback(new Error('Missing credentials'));
  }

  if (opts.secure === undefined) {
    opts.secure = true;
  }

  callback(null, new Client(opts));
};

module.exports = Client;