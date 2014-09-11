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
define([
    'intern!object',
    'intern/chai!assert',
    'intern/dojo/node!util',
    'intern/dojo/node!../lib/RtcConnector'
], function (registerSuite, assert, util, rtcConnector) {

    var eventPath = '/rtcomm/event';

    var config1 = {server:'svt-msd1.rtp.raleigh.ibm.com',port:1883,'eventPath':eventPath};
    var config2 = {server:'svt-msd2.rtp.raleigh.ibm.com',port:1883,'eventPath':eventPath};
    var em =null; 
    var filters = [
        // All events 
        {filter:{},
          sub:[eventPath+'/#']},
        // All Sessions 
        {filter:{ category: {'session':true}},
          sub:[ eventPath+'/session/#']},
        // All Scott Events
        {filter:{ toendpointid: 'scott', 
                  fromendpointid: 'scott'},
         sub:[eventPath+'/?/?/scott/#',
              eventPath+'/?/?/?/scott/#']}
        ];

    registerSuite({
        name: 'RtcConnector',
        // before the suite starts
        setup: function() {
          em = rtcConnector.get(config1);
        },
        // before each test executes
        beforeEach: function () {

        },
        // after the suite is done
        teardown: function() {
          rtcConnector.close();
        },
        'Create second monitor with same config are equal': function () {
            var em2 = rtcConnector.get(config1);
            assert.strictEqual(em, em2,
                'RtcConnector  should return same object if same config ');
            assert.strictEqual(rtcConnector.list().length, 1,
              'only 1 Monitor listed');
            
        },
        'Create a second monitor with different config': function() {
            var em2 = rtcConnector.get(config2);
            assert.notStrictEqual(em, em2,
                'RtcConnector should return a different object if a different configuration ');
            assert.strictEqual(rtcConnector.list().length, 2);
//            console.log(rtcConnector.list());
        },
        'delete a monitor': function() {
          var monitortodelete = null;
          var size = rtcConnector.list().length;
          assert.strictEqual(size, 2);
          console.log('****em****');
          console.log(em);
          rtcConnector.list().forEach(function(id) {
            console.log('****'+id+'****');
            if (rtcConnector[id] !== em.id)  {
              monitortodelete = rtcConnector.find(id);
            }
          });

          rtcConnector.delete(monitortodelete);
          assert.strictEqual(rtcConnector.list().length, 1, 'Monitor was successfully deleted');
        },
        'Force Unique Client': function() {
          var c1 = Object.create(config1);
          c1.unique = true;
          var size = rtcConnector.list().length;
          assert.strictEqual(size, 1);
          var emUnique1 = rtcConnector.get(c1);
          assert.strictEqual(emUnique1.key, em.key, 'Create two unique Event Monitors with same configuration');
          rtcConnector.delete(emUnique1);

        },

        'start the monitor': function() {
          var def = this.async(1000);
          em.start();
          setTimeout(def.callback(function(data) {
            console.log('Callback Called: '+ em.connected);
            assert(em.connected, 'Client is connected');
          }),500);

          return def;
        },
        'stop the monitor': function() {
          var def = this.async(1000);
          em.stop();
          setTimeout(def.callback(function(data) {
            console.log('Callback Called: '+ em.connected);
            assert(!em.connected, 'Client is disconnected');
          }),500);
          return def;
        },
        // Probably do a whole slew of filter tests..
        'Filter Test':function() {
          // Add a filter, remove a filter.
          em.start();
          var testFilter = filters[0].filter;
          var testSub = filters[0].sub;

          var f = em.addFilter(testFilter);
          assert.sameMembers(testSub, f.subscriptions,'The filter was added correctly');


        }
      });
});
