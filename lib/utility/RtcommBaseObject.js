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
 **/ 
/** Base Rtcomm class that provides event functionality 
 * @class
 * @memberof module:rtcomm.util
 */

var bunyan = require('bunyan');
var log = bunyan.createLogger({name: 'base'});
var RtcommBaseObject = {
    /** @lends module:rtcomm.util.RtcommBaseObject.prototype */
    /*
     * Properties

    objName : 'Base',
    id : 'unknown',
    config: {},
    dependencies: {},
    ready: false,
    state: 'unknown',
    states: {},
    events: {},  
     */
    /*
     * Methods
     */
    setState : function(value, object) {
      if (typeof this.state !== 'undefined') {
        if (this.state !== value) {
          this.state = value;
          this.emit(value,object);
        } else {
          log.debug(this + '.setState():  State already set, ignoring '+value );
        }
      } else {
        this.emit(value,object);
      }
    },
    listEvents : function() {

      console.log('******* ' + this+' Configured events ***********');
      /*jslint forin: true */
      for(var event in this.events) {
          if (this.events.hasOwnProperty(event)) {
            console.log('******* ['+event+'] has '+this.events[event].length+' listeners registered');
          } 
          
        }
    },  
    clearEventListeners : function() {
      for(var event in this.events) {
          if (this.events.hasOwnProperty(event)) {
            this.events[event] = [];
          } 
      }
    },
    createEvent: function(event) {
      if (this.hasOwnProperty('events')){
        this.events[event] = []; 
      } else {
        throw new Error('createEvent() requires an events property to store the events');
      }
    },  
    removeEvent: function(event) {
      if (event in this.events) {
        delete this.events[event];
      }   
    },  

    hasEventListener: function(event){
     return (event in this.events) && (this.events[event].length > 0);
    },
    /** Establish a listener for an event */
    on : function(event,callback) {
      //console.log('on -- this.events is: '+ JSON.stringify(this.events));
      // This function requires an events object on whatever object is attached to. and event needs to be defined there.
      if (this.events) {
        if(typeof event === 'object') {
          // this is an object of events: 
          for (var key in event) { 
            if (event.hasOwnProperty(key)) {
              if (this.events[key] && Array.isArray(this.events[key])) {
                 log.debug(this+' Adding a listener callback for event['+key+']');
                 log.trace(this+' Callback for event['+key+'] is', event[key]);
                 this.events[key].push(event[key]);
              }
            }
          }
        } else { 
          if (this.events[event] && Array.isArray(this.events[event])) {
            log.debug(this+' Adding a listener callback for event['+event+']');
            log.trace(this+' Callback for event['+event+'] is', callback);
            this.events[event].push(callback);
          }
        }
      } else {
        throw new Error("on() requires an events property listing the events. this.events["+event+"] = [];");
      }
    },
    /** attach a callback to ALL events */
    bubble : function(callback) {
      if (this.events) {
        for(var event in this.events) {
          if (this.events.hasOwnProperty(event) ) {
            this.events[event].push(callback);
          }
        }
      }
    },
    // Clear callbacks for a particular event.
    off : function(event) {
      if (this.events && this.events[event]) {
        log.trace(this+' Removing listeners for event['+event+']');
        this.events[event] = [];
      }
    },
    /** emit an event from the object */
    emit : function(event, object) {
      var event_object = object || {};
      var self = this;
      // We have an event format specified, normalize the event before emitting.
      if (this._Event && typeof this._Event === 'function') { 
        event_object = this._Event(event, event_object);
      }
      // event_object.name = (event_object.name) ? event_object.name : event;
      if (this.events && this.events[event] ) {
     //   console.log('>>>>>>>> Firing event '+event);
        log.debug(this+".emit()  for event["+event+"]", self.events[event].length);
        // Save the event
        if (typeof self.lastEvent !== 'undefined') {
          self.lastEvent = event;
        };
         // Event exists, call all callbacks
        self.events[event].forEach(function(callback) {
            if (typeof callback === 'function') {
              log.debug(self+".emit()  executing callback for event["+event+"]");
              try {
                callback(event_object);
              } catch(e) {
                var m = 'Event['+event+'] callback failed with message: '+e.message;
                throw new Error(m);
              }
            } else {
              log.debug(self+' Emitting, but no callback for event['+event+']');
            }   
        });
      } else {
        throw new Error('emit() requires an events property listing the events. this.events['+event+'] = [];');
      }
    },
    extend: function(props) {
      var prop, obj;
      obj = Object.create(this);
      for (prop in props) {
        if (props.hasOwnProperty(prop)) {
          obj[prop] = props[prop];
        }
      }
      return obj;
    },
    // Test Function
    _l: function(level){
      if (typeof l === 'function') {
        return l(level,this);
      } else {
        return 'unknown';  
      }
    },
    toString: function() {
      var name =  (this._ && this._.objName)? this._.objName : this.objName || this.name || 'Unknown';
      var id =  (this._ && this._.id)? this._.id: this.id || 'Unknown';
      return name + '['+id+']';
    }
};

module.exports = RtcommBaseObject;
