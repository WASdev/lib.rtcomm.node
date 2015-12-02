/*
 * Copyright 2014 IBM Corp.
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
/**
 * @class 
 * @memberof module:rtcomm.connector
 * @classdesc
 *
 * Low level service used to create the MqttConnection which connects
 * via mqtt over WebSockets to a server passed via the config object.
 *
 * @param {object}  config   - Config object for MqttConnection
 * @param {string}  config.server -  MQ Server for mqtt.
 * @param {integer} [config.port=1883] -  Server Port
 * @param {string}  [config.defaultTopic] - Default topic to publish to with ibmrtc Server
 * @param {string}  [config.myTopic] - Optional myTopic, defaults to a hash from userid
 * @param {object}  [config.credentials] - Optional Credentials for mqtt server.
 *
 * @param {function} config.on  - Called when an inbound message needs
 *    'message' --> {'fromEndpointID': 'string', content: 'string'}
 * 
 * @throws {string} - Throws new Error Exception if invalid arguments.
 * 
 * @private
 */

var util = require('../utility');

var bunyan = require('bunyan');
var mqtt = require('mqtt');

var log = bunyan.createLogger({name:'MqttConnection'}); 
var MqttConnection = function MqttConnection(config) {
  // Unused at the moment
  this.ERRORS = {
    SSL: {name: 'SSL', msg:'useSSL is enabled, but failure occurred connecting to server.  Check server certificate by going to: '},
    CONNLOST: {name: 'CONNLOST', msg:'The Connection the MQTT Server was lost'},
    CONNREFUSED: {name: 'CONNREFUSED', msg:'The connection to the MQTT Server failed(Connection Refused)'}
  };
  // Our required properties
  this.dependencies = {};
  this.config = {};
  // connectOptions saved for if we need to retry
  // Events we can emit go here.
  this.events = {'message':[]};
  //config items that are required and must be the correct type or an error will be thrown
  var configDefinition = { 
    required: { server: 'string', port: 'number'}, 
    optional: { rtcommTopicPath: 'string', credentials : 'object', myTopic: 'string', defaultTopic: 'string',useSSL: 'boolean'}
  };

  // the configuration for MqttConnection
  if (config) {
    /* global setConfig:false */
    this.config = util.setConfig(config,configDefinition);
  } else {
    throw new Error("MqttConnection instantiation requires a minimum configuration: "+ JSON.stringify(configDefinition.required));
  }

};
/* global util: false */
MqttConnection.prototype  = util.RtcommBaseObject.extend({
    /** @lends module:rtcomm.connector.MqttConnection.prototype */
      /**
       * connect()
       *  onSuccess || null;
       *  onFailure || null;
       *  willMessage || null;
       *  presenceTopic || null;
       *  mqttVersion || mqttVersion;
       */
      connect: function connect(options) {
        var protocol = (this.config.useSSL) ? 'tls://' : 'tcp://';
        var url = protocol + this.config.server + ':' + this.config.port; 
        // Define the mqttOptions
        var mqttOptions= {};
        if (options && options.willMessage && options.presenceTopic) {
          mqttOptions.will = {
            message: options.willMessage,
            topic: options.presenceTopic,
            retain: true};
        }
        if (this.config.credentials) {
          mqttOptions.username = this.config.credentials.username;
          mqttOptions.password = this.config.credentials.password;
        }

        if (options && options.mqttVersion === 3) {
          mqttOptions.protocolId = 'MQIsdp';
          mqttOptions.protocolVersion= 3;
        }
        var mqttClient = this.dependencies.mqttClient = mqtt.connect(url, mqttOptions);
        var mqttConnection = this;

        mqttClient.on('message', this._processMessage.bind(this));
        mqttClient.on('connect', function(obj) {
          if (options && options.onSuccess && typeof options.onSuccess === 'function') {
            options.onSuccess(obj);
          }
        });

        mqttClient.on('error', function(obj) {
          if (options && options.onFailure && typeof options.onFailure === 'function') {
            options.onFailure(obj);
          }
        });

      },
      subscribe : function subscribe(/* string */ topic) {
        this.dependencies.mqttClient.subscribe(topic);
      },
      unsubscribe : function unsubscribe(/* string */ topic) {
        this.dependencies.mqttClient.unsubscribe(topic);
      },
      publish: function publish(/* string */ topic, message, /* boolean */retained, callback) {
        if (typeof retained !== undefined) { 
          this.dependencies.mqttClient.publish(topic, message, {retain: retained}, callback);
        } else {
          this.dependencies.mqttClient.publish(topic, message, null, callback);
        }
      },
      /**
       *  Send a Message
       *
       *  @param {object} message -  RtcMessage to send.
       *  @param {string} toTopic  - Topic to send to.  Testing Only.
       *
       */
      send : function(/*object */ config ) {
        if (config.message) { 
          this.publish((config.toTopic ? config.toTopic : config.destinationTopic), JSON.stringify(config.message));
        }
      },
      /* cleanup */
      destroy: function() {
        this.dependencies.mqttClient.end();
      },
      setDefaultTopic: function(topic) {
        this.config.destinationTopic = topic;
      },

      _processMessage: function(topic,message, packet) {
        var mqttConnection = this;
         var msgToEmit = { 
            content: '',
            fromEndpointID: '',
            topic: '' };
          // Convert to String
          // Strip the Double Quotes from around it.
          msgToEmit.content = message.toString().replace(/^"(.+)"$/,'$1');

          var m = topic.split('/');
          // The last field should be the fromEndpointID
          msgToEmit.fromEndpointID = m[m.length-1];
          msgToEmit.topic = topic;
         try {
            log.info(mqttConnection+' Received message: '+JSON.stringify(msgToEmit));
            mqttConnection && mqttConnection.emit('message',msgToEmit);
          } catch(e) {
            console.error('MQTT Message Arrived callback chain failure:',e);
          }
      }
});
module.exports= MqttConnection;

