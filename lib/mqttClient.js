var mqConfig = {
  'server': 'svt-msd1.rtp.raleigh.ibm.com',
  'port': 1883 };
var topicPath = "/rtcomm";
var mqtt = require('mqtt');


// print process.argv
process.argv.forEach(function (val, index, array) {
  console.log(index + ': ' + val);
});

var topic = null;
var client = null;

if (process.argv[2]) {
  topic = process.argv[2];
  message = process.argv[3] || "Default Message";
  client = mqtt.createClient(mqConfig.port, mqConfig.server);
  client.on('connect', function() {
    client.publish(topic, message);
    client.end();
  });
} else {
  console.log('TOpic required ');
}





