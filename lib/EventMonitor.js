/** @namespace rtcomm.EventMonitor */
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

var eventMonitors = {};

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
* @memberof rtcomm.EventMonitor
* @private
 * @param {Object} [config]  
 * @param {String} [config.eventPath]  EventPath topic server emits events on
 * @param {Object} [config.category]  
 * @param {Boolean} [config.category.session]  
 * @param {Boolean} [config.category.registration]  
 * @param {Boolean} [config.category.registration]  
 * @param {Object} [config.action]  
*  @param {String} [config.type]   One of 'start'|'stopped'|'modified'   
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
      'session':true,
      'registration':true },
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
* EventMonitor Class
* @memberof rtcomm.EventMonitor
* @class
 * @param {Object} config  
 * @param {String} config.eventPath  EventPath topic server emits events on
 * @param {String} config.port 
 * @param {String} config.server  
 *
*/
function EventMonitor(config) {

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
     var client = mqtt.createClient(config.port, config.server );
     client.on('message', function(topic, message) {
       /*
        * This is called when a topic matching a valid subsription is received
        *   We have a valid subscription somewhere... 
        *   TODO:  This must call the filter FOR the topic and ensure it hasn't already
        *   been called.  
        */
       l('MESSAGE') && console.log('EventMonitor.mqttClient - Received Message on topic: '+topic);
        try {
          doFilter(topic,message);
        } catch(e) {
          console.error('MqttClient Message callback chain failure:',e);
          console.log(e.stack);
        }
      });
    client.on('connect', function(error) {
      //console.log('mqtt is CONNECTED');
      this.connected = true;
      this.emit('connected');
    }.bind(this));
    client.on('error', function(error) {
      //console.log('DISCONNECTED - error');
      this.connected = false;
      this.emit('disconnected', error);
    }.bind(this));
    client.on('close', function(error) {
      //console.log('DISCONNECTED - close');
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
   * init - Initialize the EventMonitor
   */
  this.start = function start() {
    if (this.config !== {} ) {
      mqttClient = mqttClient || createMqttClient.call(this,this.config);
      l('DEBUG') && console.log(this+'Using mqttClient: '+ mqttClient.options.clientId);
    } else {
      throw new Error('Config should have been passed during instantiation of EventMonitor');
    }
  };
/** 
 * stop the EventMonitor
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
  };

  /**
   * Add a filter to the EventMonitor
   *
   * @param {Object} [config]  
   * @param {String} [config.eventPath]  EventPath topic server emits events on
   * @param {Object} [config.category]  
   * @param {Boolean} [config.category.session]  
   * @param {Boolean} [config.category.registration]  
   * @param {Boolean} [config.category.registration]  
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
        console.log('Filter for subscription called, but no callback -- OVERRIDE!');
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
  * Add a filter for all Registration events
  * @param {Function} filterFunction callback to execute when Filter is matched
  */
  this.allRegistrationEvents = function(filterFunction){
      return this.addFilter({'category':'registration'},filterFunction);
  };

  /**
  * Add a filter for all Session events
  * @param {Function} filterFunction callback to execute when Filter is matched
  */
  this.allSessionEvents = function(filterFunction) {
    return this.addFilter({'category':'session'},filterFunction);
  };

} // End of EventMonitor Constructor
util.inherits(EventMonitor, events.EventEmitter);

// Create an EventMonitor and add it to the eventMonitors pool
var createEventMonitor = function(config) {
  var em = new EventMonitor(config);
  var unique = (config && config.unique) ? true : false;
  l('DEBUG') && console.log('createEventMonitor() config is: ',config);
  var key = em.key = createKey(em.config.user||null, em.config.password || null, em.config.server || null, em.config.port || null, em.config.eventPath || 'rtcomm');
  var mon = find(key);
  
  // Monitors not requesting to be UNIQUE.
  var umon = [];
  mon.forEach(function(m){ !m.unique && umon.push(m); });
  if (unique || umon.length === 0) {
    eventMonitors[em.id] = em;
    return em;
  }
  // return first nonunique that matched the key
  return umon[0] || null;
};

/*
 * Return an array of monitors that match
 *
 * @returns {String|Array} 
 */
var find = function find(monitor) {
  var monitors = [];
  if (monitor && monitor.id) {
    // this is an object
    return [eventMonitors[monitor.id]];
  }
  if (monitor && eventMonitors.hasOwnProperty(monitor)) {
    return eventMonitors[monitor];
  } 
  // Deep find if it is actually a key.
  if (typeof monitor === 'string') { 
    // It is probably a key if we are here, we will try to find it.
    for (var id in eventMonitors) {
      // return them all in an array.
      if (eventMonitors[id].key === monitor ) {
        monitors.push(eventMonitors[id]);
      }
    }
  }
  return monitors;
};

/** 
 * get an EventMonitor object
 * @function get
 */
module.exports.get = function(config) {
  if (config) {
    return createEventMonitor(config);
  } else {
    throw new Error('Config obect {server:"",port:"",topic:"",[user:""],[password:""]} is required');
  }
};

module.exports.find = find;
/**
 * List event monitors 
 * @memberof rtcomm.EventMonitor
 * @function list
 * */
module.exports.list = function() {
  return Object.keys(eventMonitors);
};

/** Close event monitors
 * @memberof rtcomm.EventMonitor
 * @function close
 * */
module.exports.close = function() {
  for (var id in eventMonitors) {
    if (eventMonitors.hasOwnProperty(id) ) {
      eventMonitors[id].destroy();
    }
  }
  eventMonitors = {};
  return true;
};
/** Delete an event monitor 
 * @memberof rtcomm.EventMonitor
 * @function delete
 */
module.exports.delete = function(monitor) {
  console.log('Delete called for monitor: ' + monitor.id);
  monitor.destroy();
  delete eventMonitors[monitor.id];
  // Remove the monitor
};


