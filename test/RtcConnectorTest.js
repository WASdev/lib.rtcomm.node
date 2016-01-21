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
var rtcommRtcConnector = require('../lib/RtcConnector');
var assert = chai.assert;
var port = 1883;
var host = 'localhost';
var rtcommEventPath = '/rtcomm/';

var config1 = {server:'mqtt://localhost',port:1883,'eventPath':rtcommEventPath};
var config2 = {server:'ws://localhost',port:80,'eventPath':rtcommEventPath};

var filters = [
        // All events 
        {filter:{},
          sub:[rtcommEventPath+'#']},
        // All Sessions 
        {filter:{ category: {'session':true}},
          sub:[ rtcommEventPath+'session/#']},
        // All Scott Events
        {filter:{ toendpointid: 'scott', 
                  fromendpointid: 'scott'},
         sub:[rtcommEventPath+'?/?/scott/#',
              rtcommEventPath+'?/?/?/scott/#']}
        ];


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

describe('RtcConnectorTest', function() {

	//	Set all async done timeouts to 5 seconds.
	this.timeout(5000);
  
	before(function (done) {
  
		// Here we startup Mosca for testing.
		this.server = new mosca.Server(settings, function(error) {
			console.log("RtcConnectorTest: before: Mosca started on: " + error);
		});

		this.server.on('clientConnected', function(client) {
			console.log('RtcConnectorTest: before: client connected', client.id);
		});

		this.server.on('published', function(packet) {
			// console.log('Published', packet);
			console.log('RtcConnectorTest: before: Published', packet.payload.toString());
		});

		this.server.on('subscribed', function(topic, client) {
			console.log('RtcConnectorTest: before: Subscribed: ' + topic + ' client:' + client);
		});

		this.server.on('ready', setup);

		// fired when the mqtt server is ready
		function setup() {
			console.log('RtcConnectorTest: before: Mosca server is up and running');
			done();
		}	
	});
  
	after(function(){
		//	Shutdown the Mosca server.
		console.log('RtcConnectorTest: after: Shutting Mosca down');
		this.server.close();
	});
  

  	describe('event monitor testing', function() {
  
		before(function (done) {
 	       console.log('RtcConnectorTest: before: Create mqtt client');
			this.mqttClient = mqtt.connect('mqtt://localhost:1883');
     
    		this.mqttClient.on('connect', function(error) {
      			console.log('RtcConnectorTest.mqttClient is CONNECTED');
	      		done();
    		});
    
    		this.mqttClient.on('error', function(error) {
				//console.log('RtcConnectorTest.mqttClient ERROR - error:'+ error);
    	  		this.mqttClient = null;
    			done (error);
	    	});
    
			this.mqttClient.on('close', function(error) {
    	  		//console.log('RtcConnectorTest.mqttClient DISCONNECTED - close: '+error);
      			this.mqttClient = null;
    		});
		});
		
		after(function() {
			if (this.mqttClient != null){
				this.mqttClient.end(true);
				this.mqttClient = null;
			}
		});

 		it('should create and successfully connect rtcConnector to broker', function(done) {
	      	this.rtcConnector = rtcommRtcConnector.get(config1);
    	  	this.rtcConnector.on('connected',function(){
        	    console.log('RtcConnectorTest: before: connected');
            	done();
    	 	   });
			this.rtcConnector.on('disconnected',function(){
    	        console.log('RtcConnectorTest: disconnected');
   	    	 });
	        this.rtcConnector.on('error',function(){
    	        console.log('error');
        	    done('error connecting to broker');
	        });
    	    this.rtcConnector.start();
  		});
  		  
        it('should create second rtcConnector with same config that is equal', function () {
            var rtcConnector2 = rtcommRtcConnector.get(config1);
            
            assert.strictEqual(this.rtcConnector, rtcConnector2,
                'EventMonitor  should return same object if same config ');
            assert.strictEqual(rtcommRtcConnector.list().length, 1,
            	'only 1 Monitor listed');
        }),

        it('should create a second rtcConnector with different config', function() {
            var rtcConnector2 = rtcommRtcConnector.get(config2);
            assert.notStrictEqual(this.rtcConnector, rtcConnector2,
                'rtcommRtcConnector should return a different object if a different configuration ');
            assert.strictEqual(rtcommRtcConnector.list().length, 2);
        }),
        
        it ('should delete an rtcConnector', function() {
        	var rtcConnectorToDelete = null;
          	var size = rtcommRtcConnector.list().length;
          	assert.strictEqual(size, 2);
			var rtcConnectorID = this.rtcConnector.id;
			
          	rtcommRtcConnector.list().forEach(function(id) {
            	if (id !== rtcConnectorID)  {
              		rtcConnectorToDelete = rtcommRtcConnector.find(id);
            	}
          	});

          	rtcommRtcConnector.delete(rtcConnectorToDelete);
          	assert.strictEqual(rtcommRtcConnector.list().length, 1, 'rtcConnector was successfully deleted');
        }),
        
        it('Filter Test', function() {
	          // Add a filter, remove a filter.
        	var testFilter = filters[0].filter;
   		    var testSub = filters[0].sub;

			var f = this.rtcConnector.addFilter(testFilter);
        	assert.sameMembers(testSub, f.subscriptions,'The filter was added correctly');
        }),
        
		it('should successfully register and receive a presence event', function(done) {
    
			//	Create the event monitor for the presence events    
			this.filter = this.rtcConnector.allPresenceEvents(function (topic, message) {
        	    console.log('RtcConnectorTest: Presence event received: message:' + message);

				var endpointStr = /([^\/]+$)/.exec(topic);
		        var msg = {};
         
				if(message.length != 0){
					try {
        	    		msg.payload = JSON.parse(message);
          			} 
					catch(e) {
            			done("Message cannot be parsed as an Object: "+message);
          			}
		  		
			  		if (typeof msg.payload === 'object' &&
    	          		msg.payload.method === 'DOCUMENT' ) {	  
     					done();   
					}
				}
				else{
					done("Invalid presence message received");			
 	         	} 
			});

			//	Send the presence event
			var endpointID = "testID";
			var documentMessage = {	'method' : 'DOCUMENT',
									'type' : 'ENDPOINT'};
		
			this.mqttClient.publish(rtcommEventPath + endpointID,JSON.stringify(documentMessage));
	    });
	    
		it('should successfully close the presence rtcConnector', function() {
			this.rtcConnector.stop();
	    });
	    
	});
});
