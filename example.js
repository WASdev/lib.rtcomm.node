var rtcomm = require('./lib/rtcomm');

var config = {
  server: "messagesight.demos.ibm.com",
  port : 1883,
}

var endpointConnection = new rtcomm.EndpointConnection(config);

endpointConnection.connect();
console.log(endpointConnection);
