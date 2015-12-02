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

 * @memberof module:rtcomm.connector
 *
 * @classdesc
 * The EndpointConnection encapsulates the functionality to connect and create Sessions.
 *
 * @param {object}  config   - Config object
 * @param {string}  config.server -  MQ Server for mqtt.
 * @param {integer} [config.port=1883] -  Server Port
 * @param {boolean} [config.useSSL=true] -  Server Port
 * @param {string}  [config.userid] -  Unique user id representing user
 * @param {string}  [config.managementTopicName] - Default topic to register with ibmrtc Server
 * @param {string}  [config.rtcommTopicPath]
 * @param {object}  [config.presence] - presence configuration
 * @param {object}  [config.credentials] - Optional Credentials for mqtt server.
 *
 * Events
 * @event message    Emit a message (MessageFactor.SigMessage)
 * @event newsession  Called when an inbound new session is created, passes the new session.
 * @param {function} config.on  - Called when an inbound message needs
 *    'message' --> ['fromEndpointID': 'string', content: 'string']
 *
 * @throws  {String} Throws new Error Exception if invalid arguments
 *
 * @private
 */


var utility = require('../utility');
var MqttConnection= require('./MqttConnection');
var Transaction = require('./Transaction');
var SigSession = require('./SigSession');
var MessageFactory= require('./MessageFactory');

var bunyan = require('bunyan');

var log = bunyan.createLogger({name: 'EndpointConnection'});

var EndpointConnection = function EndpointConnection(config) {
  /*
   * Registery Object
   */
  function Registry(timer) {
    timer = timer || false;
    var registry = {};
    var defaultTimeout = 5000;
    var self = this;

    var addTimer = function addTimer(item){
      if(item.timer) {
        log.debug(' Timer: Clearing existing Timer: '+item.timer + 'item.timeout: '+ item.timeout);
        clearTimeout(item.timer);
      }

      var timerTimeout = item.timeout || defaultTimeout;
      item.timer  = setTimeout(function() {
          if (item.id in registry ) {
            // didn't execute yet
            var errorMsg = item.objName + ' '+item.timer+' Timed out ['+item.id+'] after  '+timerTimeout+': '+Date();
            if (typeof registry[item.id].onFailure === 'function' ) {
              registry[item.id].onFailure({'reason': errorMsg});
            } else {
              log.error(errorMsg);
            }
            remove(item);
          }
        },
        timerTimeout);
      log.debug(item+' Timer: Setting Timer: '+item.timer + 'item.timeout: '+timerTimeout);
      };

    var remove =  function remove(item) {
        if (item.id in registry) {
          item.clearEventListeners();
          item.timer && clearTimeout(item.timer);
          log.debug('EndpointConnection  Removing item from registry: ', item);
          delete registry[item.id];
        }
      };

    var add = function(item) {

      /*global l:false*/
      log.trace('Registry.add() Adding item to registry: ', item);
      item.on('finished', function() {
        this.remove(item);
      }.bind(this));
      item.on('canceled', function() {
        this.remove(item);
      }.bind(this));
      timer && item.on('timeout_changed', function(newtimeout) {
        addTimer(item);
      }.bind(this));
      timer && addTimer(item);
      registry[item.id] = item;
    };

    return {
      add: add,
      remove: remove ,
      clear: function() {
        var self = this;
        Object.keys(registry).forEach(function(item) {
          self.remove(registry[item]);
        });
      },
      list: function() {
        return Object.keys(registry);
      },
      find: function(id) {
        return registry[id] || null ;
      }
    };
  } // End of Registry definition

  /*
   * create an MqttConnection for use by the EndpointConnection
   */
  /*global MqttConnection:false*/
  var createMqttConnection = function(config) {
    var mqttConn= new MqttConnection(config);
    return mqttConn;
  };
  /*
   * Process a message, expects a bind(this) attached.
   */
  var processMessage = function(message) {
    var endpointConnection = this;
    var topic = message.topic;
    var content = message.content;
    var fromEndpointID = message.fromEndpointID;
    var rtcommMessage = null;
    /*global MessageFactory:false*/
    try {
      rtcommMessage = MessageFactory.cast(content);
      log.debug(this+'.processMessage() processing Message', rtcommMessage);
      // Need to propogate this, just in case...
      rtcommMessage.fromEndpointID = fromEndpointID;
    } catch (e) {
      log.debug(this+'.processMessage() Unable to cast message, emitting original message',e);
      log.debug(this+'.processMessage() Unable to cast message, emitting original message',message);
    }

    if (rtcommMessage && rtcommMessage.transID) {
      // this is in context of a transaction.
      if (rtcommMessage.method === 'RESPONSE') {
        // close an existing transaction we started.
        log.trace(this+'.processMessage() this is a RESPONSE', rtcommMessage);
        var transaction = endpointConnection.transactions.find(rtcommMessage.transID);
        if (transaction) {
          log.trace(this+'.processMessage() existing transaction: ', transaction);
          transaction.finish(rtcommMessage);
        } else {
          if (rtcommMessage.orig === 'SERVICE_QUERY') {
            // This is a special case, if we get a response here that does not have a valid transaction then 
            // multiple Liberty Servers exist and we need to ALERT that things will be bad.
            var error = new utility.RtcommError("There are multiple rtcomm hosts listening on the same topic:"+endpointConnection.config.rtcommTopicPath+"  Create a unique topic for the client and server and try again");
            error.name = "MULTIPLE_SERVERS";
            endpointConnection._.onFailure(error);
            endpointConnection.disconnect();
          } else {
            console.error('Transaction ID: ['+rtcommMessage.transID+'] not found, nothing to do with RESPONSE:',rtcommMessage);
          }
        }
      } else if (rtcommMessage.method === 'START_SESSION' )  {
        // Create a new session:
        endpointConnection.emit('newsession', 
                                endpointConnection.createSession(
                                  {message:rtcommMessage, 
                                    source: topic, 
                                    fromEndpointID: fromEndpointID}));
      } else if (rtcommMessage.method === 'REFER' )  {
        /*
         * This is an INBOUND Transaction... 
         * ... NOT COMPLETE ...
         */
        var t = this.createTransaction({message: rtcommMessage, timeout:30000});
        // Create a new session:
        endpointConnection.emit('newsession', 
                                endpointConnection.createSession(
                                  {message:rtcommMessage, 
                                    referralTransaction: t,
                                    source: topic }));

      } else {
        // We have a transID, we need to pass message to it.
        // May fail? check.
        var msgTransaction = endpointConnection.transactions.find(rtcommMessage.transID);
        if (msgTransaction) {
          msgTransaction.emit('message',rtcommMessage);
        } else {
          log.info('Dropping message, transaction is gone for message: ',message);
        }

      }
    } else if (rtcommMessage && rtcommMessage.sigSessID) {
      // has a session ID, fire it to that.
      endpointConnection.emit(rtcommMessage.sigSessID, rtcommMessage);

    } else if (rtcommMessage && rtcommMessage.method === 'DOCUMENT_REPLACED') {
      // Our presence document has been replaced by another client, emit and destroy.
      // We rely on the creator of this to clean it up...
      endpointConnection.emit('document_replaced', rtcommMessage);
    } else if (message.topic) {
      // If there is a topic, but it wasn't a START_SESSION, emit the WHOLE original message.
       // This should be a raw mqtt type message for any subscription that matches.
      var subs  = endpointConnection.subscriptions;
      Object.keys(subs).forEach(function(key) {
         if (subs[key].regex.test(message.topic)){
           if (subs[key].callback) {
              log.info('Emitting Message to listener -> topic '+message.topic);
              subs[key].callback(message);
           } else {
            // there is a subscription, but no callback, pass up normally.
             // drop tye messge
             log.info('Nothing to do with message, dropping message', message);
           }
         }
      });
    } else {
      endpointConnection.emit('message', message);
    }
  };


  /*
   * Instance Properties
   */
  this.objName = 'EndpointConnection';
  //Define events we support
  this.events = {
      'servicesupdate': [],
      'document_replaced': [],
      'message': [],
      'newsession': []};

  // Private
  this._ = {};
  this._.presenceTopic = null;
  // If we have services and are configured
  // We are fully functional at this point.
  this.ready = false;
  // If we are connected
  this.connected = false;
  var rtcommTopicPath = '/rtcomm/';
  var configDefinition = {
    required: { 
      server: 'string', 
      port: 'number'},
    optional: { 
      credentials : 'object', 
      myTopic: 'string', 
      rtcommTopicPath: 'string', 
      managementTopicName: 'string', 
      connectorTopicName: 'string',
      userid: 'string', 
      appContext: 'string', 
      useSSL: 'boolean', 
      publishPresence: 'boolean', 
      presence: 'object'
    },
    defaults: { 
      rtcommTopicPath: rtcommTopicPath, 
      managementTopicName: 'management', 
      connectorTopicName : "connector",
      publishPresence: 'false', 
      useSSL: false, 
      presence: { 
        rootTopic: rtcommTopicPath + 'sphere/',
        topic: '/', // Same as rootTopic by default
      }
    }
  };
  // the configuration for Endpoint
  if (config) {
    /* global setConfig:false */
    this.config = utility.setConfig(config,configDefinition);
  } else {
    throw new Error("EndpointConnection instantiation requires a minimum configuration: "+ 
                    JSON.stringify(configDefinition));
  }
  this.id = this.userid = this.config.userid || null;
  var mqttConfig = { server: this.config.server,
                     port: this.config.port,
                     useSSL: this.config.useSSL,
                     credentials: this.config.credentials || null};
  // set 'myTopic'  
  this.config.myTopic = this.config.myTopic || this.config.rtcommTopicPath + utility.generateRandomBytes('rtcomm-xxxxxxxxxxx');

  //Registry Store for Session & Transactions
  this.sessions = new Registry();
  this.transactions = new Registry(true);
  this.subscriptions = {};

  // Only support 1 appContext per connection
  this.appContext = this.config.appContext || 'rtcomm';

  // Services Config.

  // Should be overwritten by the service_query
  // We define and expect ONE service if the server exists and the query passed.
  // Other services can be defined w/ a topic/schemes 
  //
  this.services = {
    RTCOMM_CONNECTOR_SERVICE : {}
  }; 

  // LWT config 
  this._.willMessage = null;

  //create our Mqtt Layer
  this.mqttConnection = createMqttConnection(mqttConfig);
  this.mqttConnection.on('message', processMessage.bind(this));

};  // End of Constructor

/*global util:false */
EndpointConnection.prototype = utility.RtcommBaseObject.extend (
    (function() {
      /*
       * Class Globals
       */

      /* optimize string for subscription */
      var optimizeTopic = function(topic) {
      // start at the end, replace each
        // + w/ a # recursively until no other filter...
        var optimized = topic.replace(/(\/\+)+$/g,'\/#');
        return optimized;
      };

      /* build a regular expression to match the topic */
      var buildTopicRegex= function(topic) {
        // If it starts w/ a $ its a Shared subscription.  Essentially:
        // $SharedSubscription/something//<publishTopic>
        // We need to Remove the $-> //
        // /^\$.+\/\//, ''
        var regex = topic.replace(/^\$SharedSubscription.+\/\//, '\\/')
                    .replace(/\/\+/g,'\\/.+')
                    .replace(/\/#$/g,'($|\\/.+$)')
                    .replace(/(\\)?\//g, function($0, $1){
                      return $1 ? $0 : '\\/';
                    });

        // The ^ at the beginning in the return ensures that it STARTS w/ the topic passed.
        return new RegExp('^'+regex+'$');
      };

      /*
       * Parse the results of the serviceQuery and apply them to the connection object
       * "services":{
       * "RTCOMM_CONNECTOR_SERVICE":{
       *   "iceURL":"stun:stun.juberti.com:3478,turn:test@stun.juberti.com:3478:credential:test",
       *  "eventMonitoringTopic":"\/7c73b5a5-14d9-4c19-824d-dd05edc45576\/rtcomm\/event",
       *  "topic":"\/7c73b5a5-14d9-4c19-824d-dd05edc45576\/rtcomm\/bvtConnector"},
       * "RTCOMM_CALL_CONTROL_SERVICE":{
       *   "topic":"\/7c73b5a5-14d9-4c19-824d-dd05edc45576\/rtcomm\/callControl"},
       * "RTCOMM_CALL_QUEUE_SERVICE":{
       *   "queues":[
       *     {"endpointID":"callQueueEndpointID","topic":"\/7c73b5a5-14d9-4c19-824d-dd05edc45576\/rtcomm\/callQueueTopicName"}
       *   ]}
       *  }
       */
      var parseServices = function parseServices(services, connection) {
        if (services) {
          connection.services = services;
          connection.config.connectorTopicName = services.RTCOMM_CONNECTOR_SERVICE.topic|| connection.config.connectorTopicName;
        }
      };
      var  createGuestUserID = function createGuestUserID() {
          /* global generateRandomBytes: false */
          var prefix = "GUEST";
          var randomBytes = utility.generateRandomBytes('xxxxxx');
          return prefix + "-" + randomBytes;
      };


      /** @lends module:rtcomm.connector.EndpointConnection.prototype */
      var proto = {
        /*
         * Instance Methods
         */

        normalizeTopic: function normalizeTopic(topic, adduserid) {
        /*
         * The messaging standard is such that we will send to a topic
         * by appending our clientID as follows:  topic/<clientid>
         *
         * This can be Overridden by passing a qualified topic in as
         * toTopic, in that case we will leave it alone.
         *
         */
         // our topic should contain the rtcommTopicPath -- we MUST stay in the topic Path... 
         // and we MUST append our ID after it, so...
          if (topic) {
            log.trace(this+'.normalizeTopic topic is: '+topic);
            var begin = this.config.rtcommTopicPath;
            adduserid = (typeof adduserid === 'boolean') ? adduserid : true;
            var end = (adduserid) ? this.config.userid: '';
            var p = new RegExp("^" + begin,"g");
            topic = p.test(topic)? topic : begin + topic;
            var p2 = new RegExp(end + "$", "g");
            topic = p2.test(topic) ? topic: topic + "/" + end;
            // Replace Double '//' if present
            topic = topic.replace(/\/+/g,'\/');
          } else {
            if (this.config.connectorTopicName) { 
              topic = this.normalizeTopic(this.config.connectorTopicName);
            } else {
              throw new Error('normalize Topic requires connectorTopicName to be set - call serviceQuery?');
            }
          }
          log.trace(this+'.normalizeTopic returing topic: '+topic);
          return topic;
        },
        /* Factory Methods */
        /**
         * Create a message for this EndpointConnection
         */
        createMessage: function(type) {
          var message = MessageFactory.createMessage(type);
          if (message.hasOwnProperty('fromTopic')) {
            message.fromTopic = this.config.myTopic;
          }
          log.info(this+'.createMessage() returned', message);
          return message;
        },
        createPresenceDocument: function(config){
          var presenceDocument = MessageFactory.createMessage('DOCUMENT');
          presenceDocument.addressTopic = this.getMyTopic();
          presenceDocument.appContext = this.appContext;
          if (config) {
            presenceDocument.state = config.state || presenceDocument.state;
            presenceDocument.alias = config.alias || presenceDocument.alias;
            presenceDocument.userDefines = config.userDefines || presenceDocument.userDefines;
          }
          return presenceDocument;
        },

        publishPresence : function(presenceDoc) {
          if (this.config.publishPresence) {
            this.publish(this.getMyPresenceTopic(), presenceDoc, true);
          } else {
            throw new Error('Cannot publish presence if publishPresence != true upon connection creation');
          }
          return this;
        },
        /**
         * Create a Response Message for this EndpointConnection
         */
        createResponse : function(type) {
          var message = MessageFactory.createResponse(type);
          // default response is SUCCESS
          message.result = 'SUCCESS';
          return message;
        },
        /**
         * Create a Transaction
         */
        createTransaction : function(options,onSuccess,onFailure) {
          if (!this.connected) {
            throw new Error('not Ready -- call connect() first');
          }
          // options = {message: message, timeout:timeout}
          /*global Transaction:false*/
          var t = new Transaction(options, onSuccess,onFailure);
          t.endpointconnector = this;
          log.info(this+'.createTransaction() Transaction created: ', t);
          this.transactions.add(t);
          return t;
        },
        /**
         * Create a Session
         */
        createSession : function createSession(config) {
          if (!this.connected) {
            throw new Error('not Ready -- call connect() first');
          }

          // start a transaction of type START_SESSION
          // createSession({message:rtcommMessage, fromEndpointID: fromEndpointID}));
          // if message & fromEndpointID -- we are inbound..
          //  ALWAYS use a configure toTopic as an override.
          /*global routeLookup:false*/
          /*global uidRoute:false*/
          if (config && config.remoteEndpointID) {
            config.toTopic = config.toTopic ? 
              this.normalizeTopic(config.toTopic) :
              this.normalizeTopic(routeLookup(this.services, uidRoute(config.remoteEndpointID).route));
          }
          /*global SigSession:false*/
          var session = new SigSession(config);
          session.endpointconnector = this;
          // apply EndpointConnection
          this.createEvent(session.id);
          this.on(session.id,session.processMessage.bind(session));
          this.sessions.add(session);
          session.on('failed', function() {
            this.sessions.remove(session);
          }.bind(this));
          return session;
        },
        /**
         * common query fucntionality
         * @private
         *
         */
        _query : function(message, contentfield, cbSuccess, cbFailure) {
          var successContent = contentfield || 'payload';
          var onSuccess = function(query_response) {
            if (cbSuccess && typeof cbSuccess === 'function') {
              if (query_response) {
                var successMessage = query_response[successContent] || null;
                cbSuccess(successMessage);
              }
            } else {
              log.info('query returned: ', query_response);
            }
          };
          var onFailure = function(query_response) {
            log.info('Query Failed: ', query_response);
            if (cbFailure && typeof cbFailure === 'function') {
              cbFailure((query_response)? query_response.reason : "Service Query failed for Unknown reason");
            } else {
              console.error('query failed:', query_response);
            }
          };
          if (this.connected) {
            var t = this.createTransaction({
              message: message, 
              toTopic: this.config.managementTopicName 
            }, onSuccess,onFailure);
            t.start();
          } else {
            console.error(this+'._query(): not Ready!');
          }
        },
        /**
         * connect the EndpointConnection to the server endpointConnection
         *
         * @param {callback} [cbSuccess] Optional callbacks to confirm success/failure
         * @param {callback} [cbFailure] Optional callbacks to confirm success/failure
         */
        connect : function(cbSuccess, cbFailure) {
          var epConn = this;

          log.info(this+'.connect() LWT topic: '+ this.getMyPresenceTopic()+ ' message', this.getLwtMessage());
          cbSuccess = (typeof cbSuccess === 'function') ? cbSuccess :
            function(service) {
              log.info('Success - specify a callback for more information', service);
          };

          cbFailure = (typeof cbFailure === 'function') ? cbFailure :
            function(error) {
              console.error('EndpointConnection.connect() failed - specify a callback for more information', error);
          };
          if (this.connected) {
            throw new Error(this+".connect() is already connected!");
          }
          var onSuccess = function(service) {
            this.connected = true;
            log.info('EndpointConnection.connect() Success, calling callback - service:', service);
            // Subscribe to anything that is published to myTopic
            epConn.mqttConnection.subscribe(epConn.config.myTopic+'/#');
            cbSuccess(service);
          };
          var onFailure = function(error) {
            console.error(this+'.connect() FAILURE! - ',error);
            this.connected = false;
            cbFailure(error);
          };
          // Save this onFailure, we will use it in another place if we get multiple servicequery responses
          this._.onFailure = onFailure;
          var mqttConfig ={'onSuccess': onSuccess.bind(this),
                           'onFailure': onFailure.bind(this)};
          if (this.config.publishPresence) {
            mqttConfig.willMessage = this.getLwtMessage();
            mqttConfig.presenceTopic =this.getMyPresenceTopic();
          }
          // Connect MQTT
          this.mqttConnection.connect(mqttConfig);
         },
        disconnect : function(clear_presence) {
          log.info('EndpointConnection.disconnect() called: ', this.mqttConnection);
          clear_presence = (typeof clear_presence === 'boolean') ? clear_presence : true;
          log.info(this+'.disconnect() publishing LWT');
          if (this.connected) {
            log.info(this+'.disconnect() We are connected, Cleanup...');
            clear_presence && this.publish(this.getMyPresenceTopic(), this.getLwtMessage(), true);
            this.sessions.clear();
            this.transactions.clear();
          } 
          this.clearEventListeners();
          this.mqttConnection.destroy();
          this.mqttConnection = null;
          this.connected = false;
          this.ready = false;
        },
        /**
         * Service Query for supported services by endpointConnection
         * requires a userid to be set.
         */
        serviceQuery: function(cbSuccess, cbFailure) {
          var self = this;
          var error = null;
          cbSuccess = cbSuccess || function(message) {
            log.info(this+'.serviceQuery() Default Success message, use callback to process:', message);
          };
          cbFailure = cbFailure || function(error) {
            log.info(this+'.serviceQuery() Default Failure message, use callback to process:', error);
          };

          if (!this.id) {
            error = new utility.RtcommError('servicQuery requires a userid to be set');
            error.name = "NO_USER_ID";
            cbFailure(error);
            return;
          }

          if (this.connected) {
            var message = this.createMessage('SERVICE_QUERY');
            this._query(message, 'services',
                   function(services) {
                      log.info(self+'.serviceQuery() calling success callback with', services);
                      parseServices(services,self);
                      self.ready = true;
                      self.emit('servicesupdate', services);
                      cbSuccess(services);
                    },
                    function(message) {
                      error = new utility.RtcommError(message);
                      error.name = 'SERVICE_QUERY_FAILED';
                      cbFailure(error);
                    });
          } else {
            console.error('Unable to execute service query, not connected');
          }
        },
        /**
         * Subscribe to an MQTT topic.
         * To receive messages on the topic, use .on(topic, callback);
         *
         */
        subscribe: function(topic,callback) {
          var topicRegex = buildTopicRegex(optimizeTopic(topic));
          this.subscriptions[topicRegex] = {regex: topicRegex, callback: callback};
          this.mqttConnection.subscribe(topic);
          // RegExp Object can be used to match inbound messages. (as a string it is a key)
          return topicRegex;
        },
        unsubscribe: function(topic) {
          var topicRegex = buildTopicRegex(optimizeTopic(topic));
          if(this.mqttConnection && this.mqttConnection.unsubscribe(topic)) {
            delete this.subscriptions[topicRegex];
          }
        },

        //TODO:  Expose all the publish options... (QOS, etc..);
        publish: function(topic, message, retained) {
          this.mqttConnection.publish(topic, message, retained);
        },

        destroy : function() {
          log.info(this+'.destroy() Destroying the connection');
          this.disconnect();
        },
        /**
         * Send a message
         *  @param toTopic
         *  @param message
         *  @param fromEndpointID  // optional...
         */
        send : function(config) {
          if (!this.connected) {
            throw new Error('not Ready -- call connect() first');
          }
          if (config) {
            var toTopic = this.normalizeTopic(config.toTopic);
            this.mqttConnection.send({message:config.message, toTopic:toTopic});
          } else {
            console.error('EndpointConnection.send() Nothing to send');
          }
        },
        getMyTopic: function() {
          return this.config.myTopic; 
        },
        /**
         * set the userid
         */
        setUserID : function(id) {

          id = id || createGuestUserID();
          log.info(this+'.setUserID id is '+id);
          if (this.id === null || /^GUEST/.test(this.id)) {
            // Set the id to what was passed.
            this.id = this.userid = this.config.userid = id;
            return id;
          } else if (this.id === id){
            log.info(this+'.setUserID() already set to same value: '+id);
            return id;
          } else {
            console.error(this+'.setUserID() ID already set, cannot be changed: '+ this.id);
            return id;
           }
        },
        getUserID : function() {
          return this.config.userid;
        }, 
        getLwtMessage: function() {
          // should be an empty message
          this._.willMessage =  this._.willMessage || ''; 
          return this._.willMessage;
        },
        /**
         * Return the topic my presence is published to (includes user id);
         */
        getMyPresenceTopic: function() {
          this._.presenceTopic = this._.presenceTopic || this.normalizeTopic(this.config.presence.rootTopic + this.config.presence.topic ,true);
          log.info(this+'.getMyPresenceTopic() returning topic: '+this._.presenceTopic);
          return this._.presenceTopic;
        },

        getPresenceRoot: function() {
          log.info(this+'.getPresenceRoot() returning topic: '+ 
                                   this.normalizeTopic(this.config.presence.rootTopic, false));
          return this.normalizeTopic(this.config.presence.rootTopic,false);
        },
        useLwt: function() {
          if (this.services.RTCOMM_CONNECTOR_SERVICE && this.services.RTCOMM_CONNECTOR_SERVICE.sphereTopic) {
            return true;
          } else {
            return false;
          }
        }
    };
    return proto;
  })()
);
/* globals exports:false */
module.exports = EndpointConnection;
