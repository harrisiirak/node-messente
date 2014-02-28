'use strict';

var request = require('request');
var when = require('when');

/**
 * Constructs a new Messente API client
 *
 * Options:
 *   username: API username
 *   password: API secret key
 *   secure: Use secure or non-secure communation channel
 *
 * @constructor
 * @private
 * @param {Object} opts Options
 */
function Client(opts) {
  this._username = opts.username;
  this._password = opts.password;
  this._url = (opts.secure ? 'https' : 'http') + '://api2.messente.com/';
}

/**
 * Messente internal errors map
 * @type {Object}
 */
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

/**
 * Send a new message via Messente API
 *
 * Messente API v2 doesn't seem support multiple
 * recipients, so we need to emulate it. The message
 * will be sent separately to all the recipients.
 *
 * Options:
 *   text: Message content
 *   to: List of the recipients phone numbers
 *   from: Messente registred sender ID
 *   timeToSend: Date when the message will be sent
 *   charset: Message charset, defaults to UTF8
 *   autoconvert: Compress the message
 *   reportURL: URL where automatic DLR request is made
 *
 * @public
 * @param  {Object}   opts     Message options
 * @param  {Function} callback
 */
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

  // Convert recipients input to an array
  if (typeof opts.to === 'string') {
    opts.to = [ opts.to ]
  }

  if (opts.timeToSend) {
    message.time_to_send = Math.round((opts.timeToSend.getTime() + opts.timeToSend.getTimezoneOffset()) / 1000);
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
        return deffered.resolver.resolve({ error: null, code: response.code, phone: phone });
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
      var ids = [];

      // Extract sent messages UID's
      for (var i = 0, c = results.length; i < c; i++) {
        if (!results[i].error && results[i].code) {
          ids.push(results[i].code);
        }
      }

      callback(null, results, ids);
    },

    function(err) {
      callback(err);
    }
  );
};

/**
 * Get sent messages status reports
 *
 * Callback will fire when all the reports are collected
 * and parsed
 *
 * @public
 * @param  {Array}   ids      Message identifiers
 * @param  {Function} callback
 */
Client.prototype.getReport = function(ids, callback) {
  var self = this;
  var message = {
    username: this._username,
    password: this._password
  };

  // Promise wrapper function
  function getReport(id) {
    var deffered = when.defer();

    message.sms_unique_id = id; // Set message identifier
    request.post(self._url + 'get_dlr_response/', function(err, res, body) {
      if (err) {
        // Error is acceptable, do not reject promise
        return deffered.resolver.resolve({ error: err, code: null, report: id });
      }

      // Parse response body
      var tokens = body.split(' ');
      var response = {
        type: tokens[0],
        code: tokens[1]
      };

      if (response.type === 'OK') {
        return deffered.resolver.resolve({ error: null, code: response.code, report: id });
      } else {
        var error = Client._ERRORS[response.code] || 'Unknown error';
        return deffered.resolver.resolve({ error: new Error(error), code: null, report: id });
      }
    }).form(message);

    return deffered.promise;
  }

  // Create promises
  var promises = [];
  for (var i = 0, c = ids.length; i < c; i++) {
    promises.push(getReport(ids[i]));
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

/**
 * Return Messente account balance (in EUR)
 *
 * @public
 * @param  {Function} callback
 * @return {String}            Messente account balance in EUR
 */
Client.prototype.getAccountBalance = function(callback) {
  request.post(this._url + 'get_balance/', function(err, res, body) {
    if (err) {
      return callback(err);
    }

    // Parse response body
    var tokens = body.split(' ');
    var response = {
      type: tokens[0],
      amount: tokens[1]
    };

    if (response.type === 'OK') {
      return callback(null, response.amount);
    } else {
      var error = Client._ERRORS[response.code] || 'Unknown error';
      return callback(new Error(error));
    }
  }).form({ username: this._username, password: this._password });
};

/**
 * Create a new Messente API client, validate input options
 *
 * @public
 * @static
 * @param  {Object}   opts     Options
 * @param  {Function} callback
 */
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