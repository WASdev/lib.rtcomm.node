/**
 * Copyright 2013 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
var eventPath = 'scottEvent';
var mqConfig = {
  'server': 'svt-msd1.rtp.raleigh.ibm.com',
  'port': 1883,
  'eventPath':eventPath };

var evMon = require('./RtcConnector.js');

function createMqttClient () {
  var mqtt = require('mqtt');
  var client = mqtt.createClient(mqConfig.port, mqConfig.server);
  client.on('connect', function(error) {
  //  console.log(testClient);
    console.log('mqtt clientWe connected!', error);
  }.bind(client));
  return client;
};
/* --------------------------------- */
var testFilters = 10;

var filterTemplate = 
 { 'category':[],
   'type':[],
   'endpointid':[]};

var categories = ['session', 'registration'];
var types = ['started', 'modifed','stopped'];
var endpointids = ['swgraham@us.ibm.com', 'bpulito@us.ibm.com','jlawwill@us.ibm.com','sergio@us.ibm.com'];
var directions = ['from', 'to'];

var randomFilter = function() {

  var filter = {
    'category': {
      'session':false,
      'registration':false},
    'type' : {
      'started':false,
      'modifed':false,
      'stopped':false},
    'toendpointid':null,
    'fromendpointid':null};

  filter.category[randomKey(categories)] = true;
  filter.type[randomKey(types)] = true;
  filter.toendpointid = randomKey(endpointids);
  filter.fromendpointid = randomKey(endpointids);
  return filter;
};

var randomPublishTopic = function() {
  var topic =  
      eventPath +
      '/'+ randomKey2(categories) +
      '/'+ randomKey2(types) +
      '/'+ randomKey2(endpointids) +
      '/'+ randomKey2(endpointids) 
  return topic;
};

var randomKey2 = function(field) {
  var n = randomNum(0,field.length-1);
  return field[n];
};

var randomKey = function(field) {
  var f = field.slice();
  f.push('+');
  var n = randomNum(0,f.length-1);
  return f[n];
};

function randomNum(min,max) {
   return Math.floor(Math.random()*(max-min +1) +min); 
}

/*********** Test 1 *********************/
function test1() {

  var em = evMon.get(mqConfig);
  console.log(em);
  var em2 = evMon.get(mqConfig);
  if (em === em2) {
    console.log('YAY! they are equal');
  } else {
    console.log('uh oh, they aren not');
  }
  console.log(evMon.list());

  em = null;
}

/*********** Test 2 *********************/
function test2() {

  var em = evMon.get(mqConfig);
  em.start();
  console.log(em);
  var testClient = createMqttClient();
  em.addFilter({category:{'session':true, 'registration':false }, toendpointid:'scott',fromendpointid:'scott'}, function(topic,message) {
   console.log('Received message from topic: '+topic); 
   console.log('Received message: '+message); 
  });

  em.addFilter({toendpointid:'scott',fromendpointid:'scott'}, function(topic,message) {
   console.log('SCOTT ONLY: Received message from topic: '+topic); 
   console.log('SCOTT ONLY: message: '+message); 
  });

  setTimeout(function() {
    testClient.publish(eventPath+'/registration/start/scott','Registraion Starting SCOTT'); 
    testClient.publish(eventPath+'/registration/start/jim','Registraion Starting a session jim'); 
    testClient.publish(eventPath+'/session/start/scott/jim','Starting a session to Jim'); 
    testClient.publish(eventPath+'/session/start/jim/scott','Received Starting a session jim'); 
  },2000);

}

/*************** Test 3 ***************/
function test3() {
  var em = evMon.get(mqConfig);
  em.start();
  var testClient = createMqttClient();

  var cb = function(message) {
      console.log('Received message:', message);
    };

  for (var i=1; i<testFilters; i++) {
    var f = randomFilter();
    console.log('FILTER: '+JSON.stringify(f));
    em.addFilter(f, cb); 
  }
  console.log('publishing Messages...');
  var pubMessages = function(number) {
    number = number || 10;
    for (var i=1; i<number; i++) {
      var f = randomPublishTopic();
      console.log('Publishing to topic: '+JSON.stringify(f));
      testClient.publish(f,'HELLO'); 
    }
  };

  //em.addFilter({category:'session', endpointid: 'scott'}, cb);

  setTimeout(function() {
  //  testClient.publish('/rtcomm/event/session/start/scott/from','HELLO scott'); 
   // testClient.publish('/rtcomm/event/session/stop/scott/from','HELLO scott'); 
   pubMessages(10);
  },3000);
}

test1();
test2();
