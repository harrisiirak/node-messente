messente
========
[![NPM version](https://badge.fury.io/js/messente.png)](http://badge.fury.io/js/messente)

Node.js client library (unofficial) for Messente (https://messente.com) group messaging platform, based on Messente API v2.
For more information and how to use and setup Messente API, read Messente API [documentation](https://messente.com/pages/api).

Setup
========
```bash 
npm install messente
```

Usage
========

Although Messente API v2 doesn't seem to support multiple recipients per message anymore, but there is a workaround. The message
will be sent for every recipient separately.

```javascript
var messente = require('messente');

// Create a new Messente API
var opts = {
  username: '<api-user>',
  password: '<api-secret>',
  secure: true
};

var client = messente.createClient(opts);

// Compose message
var message = {
  to: [ '+372500000000' ], // You can specify multiple recipients here
  text: 'Hello!'
};

client.sendMessage(message, function(err, result, ids) {
  /**
   * result: [ { error: null,
   *             code: 'b3258850cef53cd8b904a8185d6375c9f7d96369',
   *             phone: '+372500000000' } ]
   *
   *
   *  ids: [ 'b3258850cef53cd8b904a8185d6375c9f7d96369' ]
   *
   */

  if (err) {
    console.log('Error: ' + err.message);
    return;
  }

  console.log('Result: ');
  console.log(result);
});
```

`sendMessage` callback will return an array of the delivered messages id's, which can be use to track delivery status.

```javascript
client.getReport([ 'b3258850cef53cd8b904a8185d6375c9f7d96369' ], function(err, result) {
  /**
    * result: [ { error: null,
    *             code: 'DELIVERED',
    *             report: 'b3258850cef53cd8b904a8185d6375c9f7d96369' } ]
    */

  if (err) {
    console.log('Error: ' + err.message);
    return;
  }

  console.log('Result: ');
  console.log(result);
});
```

Account balance call.

```javascript
client.getAccountBalance(function(err, result) {
  if (err) {
    console.log('Error: ' + err.message);
    return;
  }

  console.log('Result: ');
  console.log(result);
});
```

Running tests
========
```bash 
MSNTE_USER=<api user> MSNTE_PWD=<api password> MSNTE_SECURE=true MSNTE_NUMBERS="<comma separated list of numbers>" npm test
```
