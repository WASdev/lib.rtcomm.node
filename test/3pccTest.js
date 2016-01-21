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
 
 /**
 * Testing requires
 */
var mosca = require('mosca'),
	bunyan = require('bunyan'),
	mqtt = require('mqtt'),
	chai = require('chai');  
	
  
/**
 * Units under test
 */
var rtcomm3PCC = require('../lib/3pcc');
//var rtcomm3PCC = require('rtcomm').ThirdPartyCC;

var assert = chai.assert;
var port = 1883;
var host = 'localhost';
var rtcommTopicPath = '/rtcomm/callControl';

var config1 = {'server': 'mqtt://localhost',
           		'port': 1883,
            	'topic': rtcommTopicPath};
			
/**
 * Settings that will be used to startup the MQTT Broker
 *
 * @type {Object}
 */
var settings = {
	persistence: {
		factory: mosca.persistence.Memory
	},
	host: 'localhost',
	logger: {
		level: 'info'
	}
};

describe('3pccTest', function() {

	//	Set all async done timeouts to 5 seconds.
	this.timeout(5000);
  
	before(function (done) {
  
		// Here we startup Mosca for testing.
		this.server = new mosca.Server(settings, function(error) {
			console.log("3pccTest: Mosca started on: " + error);
		});

		this.server.on('clientConnected', function(client) {
			console.log('3pccTest: Mosca: client connected', client.id);
		});

		this.server.on('published', function(packet) {
			// console.log('Published', packet);
			console.log('3pccTest: Mosca: Published', packet.payload.toString());
		});

		this.server.on('subscribed', function(topic, client) {
			console.log('3pccTest: Mosca: Subscribed: ' + topic + ' client:' + client);
		});

		this.server.on('ready', setup);

		// fired when the mqtt server is ready
		function setup() {
			console.log('3pccTest: before: Mosca server is up and running');
			done();
		}	
	});
  
	after(function(){
		//	Shutdown the Mosca server.
		console.log('3pccTest: after: Shutting Mosca down');
		this.server.close();
	});
  

  	describe('3pcc testing', function() {
  
		before(function (done) {
 	       console.log('3pccTest: before: Create mqtt client');
			this.mqttClient = mqtt.connect('mqtt://localhost:1883');
     
    		this.mqttClient.on('connect', function(error) {
      			console.log('3pccTest.mqttClient is CONNECTED');
	      		done();
    		});
    
    		this.mqttClient.on('error', function(error) {
				//console.log('3pccTest.mqttClient ERROR - error:'+ error);
    	  		this.mqttClient = null;
    			done (error);
	    	});
    
			this.mqttClient.on('close', function(error) {
    	  		//console.log('3pccTest.mqttClient DISCONNECTED - close: '+error);
      			this.mqttClient = null;
    		});
		});
		
		after(function() {
			if (this.mqttClient != null){
				this.mqttClient.end(true);
				this.mqttClient = null;
			}
		});

 		it('should create and successfully connect 3pcc to broker', function(done) {

			this.thirdPCC = rtcomm3PCC.get(config1,function(message){});

			this.thirdPCC.on('connected',function(){
			  console.log('3pccTest: connected');
			  done();
			});
			
			this.thirdPCC.on('disconnected',function(){
			  console.log('3pccTest: disconnected');
			});
			
			this.thirdPCC.start();
  		});
  		  
        it('should create second 3pcc with same config that is unique', function () {
            var thirdPCC2 = rtcomm3PCC.get(config1,function(message){});
            
            assert.notStrictEqual(this.thirdPCC, thirdPCC2,
                '3pcc should always return a different object ');
        }),
        

 		it('should complete an end-to-end 3pcc transaction', function(done) {
 		
 			//	First setup mqtt client to receive and respond to the message.
 			this.mqttClient.subscribe(rtcommTopicPath);
 			
			this.mqttClient.on('message', function(topic, message) {
					//	First convert to a JS object;
					message = JSON.parse(message);
					
					var respMessage = {
						'method' : 'RESPONSE',
						'orig' : '3PCC_PLACE_CALL',
						'transID' : message.transID,
						'result' : 'SUCCESS'
					};
			
					this.mqttClient.publish(message.fromTopic,JSON.stringify(respMessage));
				}.bind(this));


			var thirdPCC3 = this.thirdPCC3 = rtcomm3PCC.get(config1,function(message){
										var transID = message.transID;
							
										if (transID != 100)
										{
											done("ERROR: Unknown transID received from nodeModule");
										}
							
										if (message.result == 'SUCCESS')
										{
											console.log('3PCC call INITIATED successfully');
											done();
										}
										else
										{
											console.log('3PCC call FAILED with reason:' + message.reason);
											done(message.reason);
										}
									}.bind(this));

			this.thirdPCC3.on('connected',function(){
				//	Here we initiate a 3PCC call
				thirdPCC3.startCall("Jack Endpoint","Jill Endpoint", 1000, 100);
			});
			
			this.thirdPCC3.on('disconnected',function(){
			});
			
			this.thirdPCC3.start();
  		});
  		  
		it('should successfully close all the 3pcc instances that were started', function() {
			this.thirdPCC.stop();
			this.thirdPCC3.stop();
	    });
	});
});
