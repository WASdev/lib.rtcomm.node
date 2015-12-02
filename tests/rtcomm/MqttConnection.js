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
define(function(require) {
   var registerSuite = require('intern!object');
   var assert = require('intern/chai!assert');
   var config = require('support/config');
   var connection = require('intern/dojo/node!../../lib/rtcomm');

//   var DEBUG = (intern.args.DEBUG === 'true')? true: false;
  // MQTT ServerConfig
  // client1 Config
    var config1 = config.clientConfig1();
    delete config1.managementTopicName;
    delete config1.userid;
    delete config1.requireRtcommServer;
    // client2 Config
    var config2 = config.clientConfig2();
    delete config2.managementTopicName;
    delete config2.userid;
    delete config2.requireRtcommServer;
    
    var client1 = null;
    var client2 = null;
    console.log('CONFIG 1', config1);
    console.log('CONFIG 2', config2);
    
    var T1 = 5000;  // How long we wait to setup, before sending messages.
    var T2 = T1 + 2000; // How long we wait to check results
    var T3 = T2 +2000;  // How long we wait to timeout test.

    registerSuite({
      name: "FVT - connection/MqttConnection", 
      setup: function() {
        var p = new Promise(
          function(resolve, reject) {
             client1 = new connection.MqttConnection(config1);
             client2 = new connection.MqttConnection(config2);
//             DEBUG && client1.setLogLevel('DEBUG');
 //            DEBUG && client2.setLogLevel('DEBUG');
             client1.connect({
              onSuccess:   function(){
                 client2.connect({ 
                 onSuccess:  function() {
                     resolve();
                   },
                 onFailure:  function(error) {
                     reject(error);
                  }
                 });
               },
               onFailure:  function(error) {
                 reject(error);
               }
             });
        });
        return p;
      },
       teardown: function() {
         client1.destroy();
         client1 = null;
         client2.destroy();
         client2 = null;
       },
      "Send and Receive a Simple Message via the EndpointConnection [without rtcomm]" : function() {
            var dfd = this.async(T1);
            var message1, message2 = null;
            var finish = dfd.callback(function(message){
                 assert.ok(message);
                 console.log('>>>>> Sent:     '+ msgToSend2.toString());
                 console.log('>>>>> Received: '+ message.content.toString());
                 assert.equal(msgToSend2.toString(), message.content.toString());
            });
            client1.subscribe('client1Topic');
            client1.on('message',finish); 
            var msgToSend2 = "Hello from client2";
             // Wait 2 seconds to ensure client is appropriately created, send the message
             setTimeout(function() { 
               console.log('sending a message right now to '+client1.config.myTopic);
               client2.send({message: msgToSend2, toTopic: 'client1Topic'});
             }, 1000);
       }
    }); // End of Tests
});
