/** @namespace rtcomm.RtcConnector */
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


var rtcConnectors = {};

var createKey = function(user, password, server, port, topic) {
  return "["+(user||"")+":"+(password||"")+"]@"+server+":"+port+"/"+topic;
};

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
* @class Filter object
* @memberof rtcomm.RtcConnector
* @private
 * @param {Object} [config]  
 * @param {String} [config.eventPath]  EventPath topic server emits events on
 * @param {Object} [config.category]  
 * @param {Boolean} [config.category.session]    
 * @param {Object} [config.action]  
 * @param {String} [config.type]   One of 'start'|'stopped'|'modified'   
 * @param {Boolean} [config.type.started]  
 * @param {Boolean} [config.type.failed]  
 * @param {Boolean} [config.type.modified]  
 * @param {Boolean} [config.type.stopped]  
 * @param {String}  [config.toendpointid] 
 * @param {String}  [config.fromendpointid] 
 */
var Filter = function Filter(config) {

  var possibleConfig = {
    'category': {
      'session':true },
    'action' : {
      'started':true,
      'failed':true,
      'modified':true,
      'stopped':true },
    'toendpointid':null,
    'fromendpointid':null};
  
  var eventPath = (config && config.eventPath) ? config.eventPath : "/rtcomm/event";

  /* optimize string for subscription */
  var optimize = function(topicArray) {
    // start at the end, replace each
    // + w/ a # recursively until no other filter...
    var optimized = [];
    topicArray.forEach(function(filterString) {
      optimized.push(filterString.replace(/(\/\+)+$/g,'\/#'));
    });
    return optimized;
  };

  /* build a regular expression to match the topic */
  var buildregex= function(topicArray) {
    var regexArray = [];
    topicArray.forEach(function(filterString) {
      var regex = filterString.replace(/\/\+/g,'\\/.+').replace(/\/#$/g,'');
      regexArray.push(new RegExp(regex));
    });
    return regexArray;
  };
  var allSame = function allSame(boolobj) {
    // returns true if all true or all false
    var t = true;
    var f = true;
    Object.keys(boolobj).forEach(function (key) {
      t = boolobj[key] && t ;
      f = !boolobj[key] && f;
    });
    return f || t;
  };

  var appendFilter = function appendFilter(topics,level,obj) {
    var filter = {}; 
    var newfilters = [];
    if (possibleConfig.hasOwnProperty(level)) {
      // Set the defaults 
      filter = possibleConfig[level];
      Object.keys(filter).forEach(function (key) {
        filter[key] = (obj[level] && obj[level].hasOwnProperty(key)) ? obj[level][key] : true;
      });
      //console.log('Filter', filter);
      if (allSame(filter)) {
        newfilters.push('+');
      } else {
        Object.keys(filter).forEach(function(key)  {
          if (filter[key]) {
            newfilters.push(key);
          }
        });
      }
      var newtopics = [];
      topics.forEach(function(topic) {
        //append a trailing slash if necessary 
        topic =  /\/$/.test(topic) ? topic : topic + '/';
        newfilters.forEach(function(f) {
          newtopics.push(topic+f);
          });
      });
      return newtopics;
    } 
    else {
      return topics;
    }
  };

  var buildTopics = function buildTopics(config) {
    var topics = [eventPath];
    var finalTopics = [];
    var toendpointid = '+'; 
    var fromendpointid = '+'; 

    //console.log('buildTopics - config:',config);
    if (config) {
      topics = appendFilter(topics, 'category',config);
      topics = appendFilter(topics, 'action', config);
      toendpointid = config.toendpointid || toendpointid;
      fromendpointid = config.fromendpointid || toendpointid;
      for(var j=0; j<topics.length; j++) {
        if ((toendpointid === fromendpointid) && (toendpointid !== '+')) {
          finalTopics.push(topics[j]+'/'+toendpointid +'/+'); 
          finalTopics.push(topics[j]+'/+/'+fromendpointid ); 
        } else {
          finalTopics.push(topics[j]+'/'+toendpointid+'/'+fromendpointid);
        }
      } 
      return finalTopics;
    } 
    return topics;
  }; // end of buildTopics

  this.id = generateUUID();
  this.started = false;
  /** topic requested to subscribe to for filter */
  this.topics = buildTopics(config);
  /** topic filter subscribes to */
  this.subscriptions = optimize(this.topics);

  /** regex used to match messages on filter */
  this.regexs = buildregex(this.subscriptions);

  /** callback for this Filter */
  this.callback = function(message) {
    l('INFO') && console.log('Filter for subscription called, but no callback -- OVERRIDE!');
  };

  this.dependencies = {
    mqttClient : null
  };

  this.start = function() {
    var client = this.dependencies.mqttClient;
   // console.log('subscribing: ',this.subscriptions);
    this.subscriptions.forEach(function(subscription) {
      l('DEBUG') && console.log('Filter.start() subscribing to: ', subscription);
      client.subscribe(subscription);
    });
    this.started = true;
  };

  this.stop = function() {
    //Unsubscribe from everthing.
    var client = this.dependencies.mqttClient;
    //console.log('unsubscribing: ',this.subscriptions);
    this.subscriptions.forEach(function(subscription) {
      l('DEBUG') && console.log('Filter.stop() Unsubscribing to: ', subscription);
      client.unsubscribe(subscription);
    });
    this.started = false;
   };

  /** doFilter - calls callback for message if matches topic */
  this.doFilter = function(topic, message) {
    // returns 
    var self = this;
    self.regexs.forEach(function(regex) {
      if (regex.test(topic)) {
       l('DEBUG') && console.log(self+'.doFilter() '+ topic + ' MATCHED ' + regex + 'calling callback ');
       self.callback(topic, message);
     } 
   });
  };
}; // End of Filter Class

Filter.prototype.toString = function toString() {
  return 'Filter['+this.id+']';
};

/**
* RtcConnector Class
* @memberof rtcomm.RtcConnector
* @class
 * @param {Object} config  
 * @param {String} config.eventPath  EventPath topic server emits events on
 * @param {String} config.port 
 * @param {String} config.server  
 *
*/
function RtcConnector(config) {

  this.config = config || {};
  this.config.eventPath = this.config.eventPath || '/rtcomm/event';
  this.key = "";
  this.id = generateUUID();
  this.unique = (config && config.unique) || false;
  this.connected = false;
  /* The internal list of filters */
  var myFilters = {} ;
  /* mqttClient object */

  var mqttClient = null;
  /**
   * createMqttClient - create MQTT client
   * @private
   * @param {Object} config  
   */
  var createMqttClient = function(config) {
  
    //console.log('RtcConnector: createMqttClient: server:  '+ config.server);

     var client = mqtt.connect(config.server + ':' + config.port);
     client.on('message', function(topic, message) {
       /*
        * This is called when a topic matching a valid subsription is received
        *   We have a valid subscription somewhere... 
        *   TODO:  This must call the filter FOR the topic and ensure it hasn't already
        *   been called.  
        */
       l('MESSAGE') && console.log('RtcConnector.mqttClient - Received Message on topic: '+topic);
        try {
          doFilter(topic,message);
        } catch(e) {
          console.error('MqttClient Message callback chain failure:',e);
          console.log(e.stack);
        }
      });
    client.on('connect', function(error) {
      console.log('RtcConnector: mqtt is CONNECTED');
      this.connected = true;
      this.emit('connected');
    }.bind(this));
    client.on('error', function(error) {
      console.log('RtcConnector: DISCONNECTED - error:'+ error);
      this.connected = false;
      this.emit('disconnected', error);
    }.bind(this));
    client.on('close', function(error) {
      console.log('RtcConnector: DISCONNECTED - close: '+error);
      this.connected = false;
      this.emit('disconnected',error);
    }.bind(this));
    return client;
  };

  /**
   * doFilter - Execute the filter callbacks for the topic passed
   * @private
   * @param {String} topic  Topic name to filter 
   * @param {String} message Message to pass
   */
  var doFilter = function(topic, message) {
    /*
     * so should a filter manage the last message it has?  and give it an ID and store it... 
     * to prevent duplicates...
     * or should this filter do it...
     * this shold just execute 1 filter -- NO more than 1.  But if a topic matches
     * multiple filters then we need to call one filter and mark it dirty or something
     *
     * maybe save the lastMessage w/ a timestamp and if it matches, then skip it... 
     *
     * given topic A that matches 2 filters so there will be 2 messages... 
     *
     *
     * return number of matches...
     * 
     *
     */

    for( var key in myFilters) {
      if (myFilters.hasOwnProperty(key)) {
        myFilters[key].doFilter(topic,message) ;
      }
    }
    // count is how many times filter ran... 
  };
  /**
   * init - Initialize the RtcConnector
   */
  this.start = function start() {
    if (this.config !== {} ) {
      mqttClient = mqttClient || createMqttClient.call(this,this.config);
      l('DEBUG') && console.log(this+'Using mqttClient: '+ mqttClient.options.clientId);
    } else {
      throw new Error('Config should have been passed during instantiation of RtcConnector');
    }
  };
/** 
 * stop the RtcConnector
 */
  this.stop = function stop() {
    // Stop any Filters, end our client... 
    this.destroy();
  };

  this.destroy = function destroy() {
 
    for( var key in myFilters) {
      if (myFilters.hasOwnProperty(key)) {
        myFilters[key].stop() ;
      }
    }
    mqttClient && mqttClient.end();
	
	if (rtcConnectors[this.id]){
		delete rtcConnectors[this.id];
	}
  };

  /**
   * Add a filter to the RtcConnector
   *
   * @param {Object} [config]  
   * @param {String} [config.eventPath]  EventPath topic server emits events on
   * @param {Object} [config.category]  
   * @param {Boolean} [config.category.session]  
   * @param {Object} [config.action]  
*  @param {String} [config.type]   One of 'start'|'stopped'|'modified'   
 * @param {Boolean} [config.type.started]  
 * @param {Boolean} [config.type.failed]  
 * @param {Boolean} [config.type.modified]  
 * @param {Boolean} [config.type.stopped]  
 * @param {String}  [config.toendpointid] 
 * @param {String}  [config.fromendpointid] 
   * @param {Function} filterFunction 
   */
  this.addFilter = function(filter,filterFunction) {
      filter.eventPath = this.config.eventPath;
      var f = new Filter(filter);
      f.callback = filterFunction || function(message) {
        //console.log('Filter for subscription called, but no callback -- OVERRIDE!');
      };
      f.dependencies.mqttClient = mqttClient;
      myFilters[f.id] = f;
      if (mqttClient) {
        f.start(mqttClient);
      //  console.log('Added Filter: ', f);
        return f;
      } else {
        console.log('No MQTT Client setup');
        return f;
      }
  };
  /**
  * Remove a filter
  * @param {@module:rtcomm/EventModule.Filter} filter Filter Object to remove
  */
  this.removeFilter = function(filter) {
    if (filter) {
     filter.stop();
     delete myFilters[filter.id];
     return true;
    } else {
      return false;
    }
  };
  /**
  * Add a filter for all events
  * @param {Function} filterFunction callback to execute when Filter is matched
  */
  this.allEventFilter = function(filterFunction) {
    return this.addFilter({},filterFunction);
  };

  /**
  * Add a filter for all events to/from a particular endpointid
  *
  * @param {String} endpointid 
  * @param {Function} filterFunction callback to execute when Filter is matched
  */
  this.allEndpointEvents = function(endpointid, filterFunction) {
    if (typeof endpointid !== 'function') {
      return this.addFilter({'toendpointid':endpointid, 'fromendpointid': endpointid},filterFunction);
    }
  };

  /**
  * Add a filter for all Presence events
  * @param {Function} filterFunction callback to execute when Filter is matched
  */
  this.allPresenceEvents = function(filterFunction){
      return this.addFilter({'type': true ,'state': true,'alias': true,'userDefines': true},filterFunction);
  };

  /**
  * Add a filter for all Session events
  * @param {Function} filterFunction callback to execute when Filter is matched
  */
  this.allSessionEvents = function(filterFunction) {
    return this.addFilter({'category':'session'},filterFunction);
  };

} // End of RtcConnector Constructor
util.inherits(RtcConnector, events.EventEmitter);

// Create an RtcConnector and add it to the rtcConnectors pool
var createRtcConnector = function(config) {
  var em = new RtcConnector(config);
  var unique = (config && config.unique) ? true : false;
  l('DEBUG') && console.log('createRtcConnector() config is: ',config);
  var key = em.key = createKey(em.config.user||null, em.config.password || null, em.config.server || null, em.config.port || null, em.config.eventPath || 'rtcomm');
  var mon = find(key);
  
  // Monitors not requesting to be UNIQUE.
  var umon = [];
  mon.forEach(function(m){ !m.unique && umon.push(m); });
  if (unique || umon.length === 0) {
    rtcConnectors[em.id] = em;
    return em;
  }
  // return first nonunique that matched the key
  return umon[0] || null;
};

/*
 * Return an array of connectors that match
 *
 * @returns {String|Array} 
 */
var find = function find(connector) {
  var connectors = [];
  if (connector && connector.id) {
    // this is an object
    return [rtcConnectors[connector.id]];
  }
  if (connector && rtcConnectors.hasOwnProperty(connector)) {
    return rtcConnectors[connector];
  } 
  // Deep find if it is actually a key.
  if (typeof connector === 'string') { 
    // It is probably a key if we are here, we will try to find it.
    for (var id in rtcConnectors) {
      // return them all in an array.
      if (rtcConnectors[id].key === connector ) {
        connectors.push(rtcConnectors[id]);
      }
    }
  }
  return connectors;
};

/** 
 * get an RtcConnector object
 * @function get
 */
module.exports.get = function(config) {
  if (config) {
    return createRtcConnector(config);
  } else {
    throw new Error('Config obect {server:"",port:"",topic:"",[user:""],[password:""]} is required');
  }
};

module.exports.find = find;
/**
 * List connectors 
 * @memberof rtcomm.RtcConnector
 * @function list
 * */
module.exports.list = function() {
  return Object.keys(rtcConnectors);
};

/** Close connectors
 * @memberof rtcomm.RtcConnector
 * @function close
 * */
module.exports.close = function() {
  for (var id in rtcConnectors) {
    if (rtcConnectors.hasOwnProperty(id) ) {
      rtcConnectors[id].destroy();
    }
  }
  rtcConnectors = {};
  return true;
};

/** Delete a connector 
 * @memberof rtcomm.RtcConnector
 * @function delete
 */
module.exports.delete = function(connector) {
  connector.destroy();
  delete rtcConnectors[connector.id];
  // Remove the connector
};

