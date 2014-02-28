'use strict';

var when = require('when');
var http = require('http');
var https = require('https');
var querystring = require('querystring');
var csv = require('csv');

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
function Client (opts) {
  this._username = opts.username;
  this._password = opts.password;
  this._secure = opts.hasOwnProperty('secure') ? opts.secure : true;
}

/**
 * Messente internal errors map
 * @type {Object}
 */
Client._ERRORS = {
  101: 'Access is restricted, wrong credentials.',
  102: 'Parameters are wrong or missing.',
  103: 'Invalid IP address.',
  104: 'Country was not found.',
  105: 'No such country or area code.',
  106: 'Destination country is not supported.',
  107: 'Not enough credit on account.',
  111: 'Sender parameter from is invalid.',
  208: 'Account credit balance undetermined, try again.',
  209: 'Server failure, try again.'
};

/**
 * List of Messente API endpoint URLs
 *
 * @type {string[]}
 * @private
 */
Client._ENDPOINTS = [
  'api2.messente.com',
  'api3.messente.com'
];

/**
 * Build Messente API HTTP request and dispatch it.
 * Parses automatically JSON and status-value responses.
 * NB! Response data size is limited to 1MB.
 *
 * Supports fallback to Messente secondary API endpoint(s).
 *
 * @private
 * @param {String} method HTTP method
 * @param {String} action API action
 * @param {Object} payload Body data to append
 * @param {Function} callback
 */
Client.prototype._sendRequest = function _sendRequest (method, action, payload, callback) {
  if (typeof payload === 'function') {
    callback = payload;
    payload = null;
  }

  var self = this;
  var endpoints = Client._ENDPOINTS;

  function request (endpoint) {
    var data = null;
    var client = self._secure ? https : http;
    var options = {
      port: self._secure ? 443 : 80,
      hostname: endpoint,
      method: method,
      path: '/' + action + '/',
      rejectUnauthorized: false
    };

    // Set headers and data for POST request
    if (method === 'POST') {
      data = payload ? querystring.stringify(payload) : null;
      options.headers = {
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': data.length
      };
    }

    var req = client.request(options);
    var response = [];
    var parsed = null;
    var len = 0;

    // Handle response
    req.on('response', function onResponse (res) {
      res.setEncoding('utf8');

      res.on('data', function onData (data) {
        if (len < 1024 * 1024) { // 1MB
          len += data.length;
          response.push(data);
        } else {
          req.abort();
          return callback(new Error('Response body is too long: ' + len + ' bytes'));
        }
      });

      res.on('end', function onEnd () {
        parsed = response.join();
        console.log(action);
        console.log(parsed);

        // Try auto-parse JSON
        if (res.headers['content-type'].match('json') || parsed[0] === '{') {
          try {
            parsed = JSON.parse(parsed);
          } catch (err) {
            return callback(new Error('Invalid JSON response: ' + err.message));
          }

          return callback(null, parsed);
        } else if (res.headers['content-type'].match('text/html')) {
          // Parse status-value pair
          var atoms = parsed.split(' ');

          if (atoms.length < 2) {
            return callback(new Error('Invalid status-value response: ' + parsed));
          }

          parsed = {
            status: atoms[0],
            value: atoms[1]
          };

          return callback(null, parsed);
        } else if (res.headers['content-type'].match('text/csv')) {
          csv()
            .from.string(parsed)
            .to.array(function (data) {
              return callback(null, data);
            });
        }
      });
    });

    req.on('error', function onError (err) {
      console.log(err);
      if (endpoints.length) {
        return request(endpoints.shift());
      } else {
        return callback(new Error('Unable to connect API endpoint'));
      }
    });

    // Send body data if set
    if (data) {
      req.write(data);
    }

    req.end();
  }

  return request(endpoints.shift());
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
 * @param {Object} opts Message options
 * @param {Function} callback
 */
Client.prototype.sendMessage = function sendMessage (opts, callback) {
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
  function send (phone) {
    var deffered = when.defer();

    message.to = phone; // Set recipient

    self._sendRequest('POST', 'send_sms', message, function onFinish (err, data) {
      if (err) {
        return deffered.resolve({ error: err, code: null, phone: phone });
      }

      if (data.status === 'OK') {
        return deffered.resolve({ error: null, code: data.value, phone: phone });
      } else {
        var error = Client._ERRORS[data.value] || 'Unknown error';
        return deffered.resolve({ error: new Error(error), code: null, phone: phone });
      }
    });

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
 * Callback will be triggered when all the reports are collected
 * and parsed
 *
 * @public
 * @param {Array} ids Message identifiers
 * @param {Function} callback
 */
Client.prototype.getReport = function getReport (ids, callback) {
  var self = this;
  var message = {
    username: this._username,
    password: this._password
  };

  // Promise wrapper function
  function getReport(id) {
    var deffered = when.defer();

    message.sms_unique_id = id; // Set message identifier

    self._sendRequest('POST', 'get_dlr_response', message, function onFinish (err, data) {
      if (err) {
        return deffered.resolve({ error: err, code: null, report: id });
      }

      if (data.status === 'OK') {
        return deffered.resolve({ error: null, code: data.value, report: id });
      } else {
        var error = Client._ERRORS[data.value] || 'Unknown error';
        return deffered.resolve({ error: new Error(error), code: null, report: id });
      }
    });

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
 * @param {Function} callback
 * @return {String} Messente account balance in EUR
 */
Client.prototype.getAccountBalance = function getAccountBalance (callback) {
  var data = {
    username: this._username,
    password: this._password
  };

  return this._sendRequest('POST', 'get_balance', data, function onFinish (err, data) {
    if (err) {
      return callback({ error: err, code: null });
    }

    if (data.status === 'OK') {
      return callback(null, parseFloat(data.value));
    } else {
      var error = Client._ERRORS[data.value] || 'Unknown error';
      return callback(new Error(error));
    }
  });
};

/**
 * Returns full pricelist
 *
 * @param {Function} callback
 */
Client.prototype.getPrices = function getPrices (callback) {
  var data = {
    username: this._username,
    password: this._password
  };

  return this._sendRequest('POST', 'pricelist', data, function onFinish (err, data) {
    if (err) {
      return callback({ error: err, code: null });
    }

    return callback(null, data);
  });
};

/**
 * Returns price list for specified country
 * @param country
 * @param callback
 * @returns {*}
 */
Client.prototype.getPricesForCountry = function getPrices (country, callback) {
  var data = {
    username: this._username,
    password: this._password,
    country: country
  };

  return this._sendRequest('POST', 'prices', data, function onFinish (err, data) {
    if (err) {
      return callback({ error: err, code: null });
    }

    return callback(null, data);
  });
};

/**
 * Create a new Messente API client, validate input options
 *
 * @public
 * @static
 * @param {Object} opts Options
 * @param {Function} callback
 */
Client.createClient = function createClient (opts, callback) {
  if (!opts.username || !opts.password) {
    return callback(new Error('Missing credentials'));
  }

  callback(null, new Client(opts));
};

module.exports = Client;