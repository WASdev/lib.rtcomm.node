/** @namespace rtcomm.ThirdPartyCC */

/*
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
 */

var util = require('util');
var events = require('events');
var mqtt = require('mqtt');
var logger = require('./log.js');
var l = logger.l;

/*
 * Generate a Random UUID
 */ 
var generateUUID = function generateUUID() {
    /*jslint bitwise: true */
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c==='x' ? r : (r&0x7|0x8)).toString(16);
    }); 
    return uuid;
};

/**
* Third Party Call Control Class
* @class
* @memberof rtcomm.ThirdPartyCC
 * @param {Object} config  
 * @param {String} config.topic topic used for 3PCC 
 * @param {String} config.port 
 * @param {String} config.server  
 *
*/
function ThirdPartyCC(config, resultCallback) {

  console.log('ThirdPartyCC: constructor config.topic: '+ config.topic);
  this.config = config || {};
  this.key = "";
  this.id = generateUUID();
  this.connected = false;
  this.callback = resultCallback || function(message) {
        console.log('Result for 3PCC subscription called, but no callback -- OVERRIDE!');
      };

  /* mqttClient object */
  var mqttClient = null;
  
  /**
   * createMqttClient - create MQTT client
   * 
   * @param {Object} config  
   * @private
   */
  var createMqttClient = function(config) {
     var client = mqtt.createClient(config.port, config.server );
     
	 client.on('message', function(topic, message) {
       /*
        * This is called when a result to a third party call request is delivered.  
        */
       l('MESSAGE') && console.log('3PCC.mqttClient - Received Message on topic: '+topic);
        try {
//FIX		  this.callback(topic, message);
        } catch(e) {
          console.error('MqttClient Message callback chain failure:',e);
          console.log(e.stack);
        }
      });
	  
    client.on('connect', function(error) {
      //console.log('mqtt is CONNECTED');
      this.connected = true;
	  // Subscribe on unique ID to get the response back.
	  mqttClient.subscribe(this.id);
      this.emit('connected');
    }.bind(this));
    
	client.on('error', function(error) {
      console.log('DISCONNECTED - error: '+ error);
      this.connected = false;
      this.emit('disconnected', error);
    }.bind(this));
    
	client.on('close', function(error) {
      console.log('DISCONNECTED - close: '+error);
      this.connected = false;
      this.emit('disconnected',error);
    }.bind(this));
    return client;
  };

  /**
   * init - Initialize the 3PCC
   */
  this.start = function start() {
    if (this.config !== {} ) {
		if (mqttClient == null)
			mqttClient = createMqttClient.call(this,this.config);
      l('DEBUG') && console.log(this+'Using mqttClient: '+ mqttClient.options.clientId);
    } else {
      throw new Error('Config should have been passed during instantiation of 3PCC');
    }
  };
  /**
   * stop the 3pcc connection
   */
  this.stop = function stop() {
    // Stop any Filters, end our client... 
    this.destroy();
  };
  this.destroy = function destroy() {
     mqttClient && mqttClient.end();
  };
  
  /**
   * Start a call between two endpoints
   * @param {String} callerEndpointID The ID for the CALLER
   * @param {String} calleeEndpointID The ID being called
   */

  this.startCall = function startCall(callerEndpointID,calleeEndpointID){
	var transactionID = null;
	if (this.connected == true){
		transactionID = generateUUID;
		
		console.log('ThirdPartyCC: start call between: caller: '+callerEndpointID+' and callee: '+calleeEndpointID+' topic: '+this.config.topic);
		var message = {
			'ibmRTC' : 'v 1.0',
			'method' : '3PCC_PLACE_CALL',
			'calleeEndpoint' : calleeEndpointID,
			'callerEndpoint' : callerEndpointID,
			'fromTopic' : this.id,
			'transID' : transactionID};

		console.log('ThirdPartyCC: publish: ');
		mqttClient.publish(this.config.topic, JSON.stringify(message));
	}
	else
      throw new Error('Not connected. Can not start 3PCC session until mqtt client is connected');
	  
	 return (transactionID);
  };
} // End of ThirdPCC Constructor

util.inherits(ThirdPartyCC, events.EventEmitter);

/** Get a new ThirdPartyCC 
 *  @memberof rtcomm.ThirdPartyCC 
 *  @function get
 *  @returns {rtcomm.ThirdPartyCC.ThirdPartyCC}
 *
 */
module.exports.get = function(config, callback) {
	var tpcc = new ThirdPartyCC(config, callback);
    return tpcc;
};

