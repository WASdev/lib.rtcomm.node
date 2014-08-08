var mqtt = require('mqtt')
  , host = 'svt-msd1.rtp.raleigh.ibm.com' // or localhost
  , client = mqtt.createClient(1883, host, {keepalive: 10000});

client.subscribe('presence');
client.on('message', function (topic, message) {
  console.log(message);
});

client.on('connect', function() {
  console.log('Client is connencted...');
  client.publish('presence', 'bin hier');
});

