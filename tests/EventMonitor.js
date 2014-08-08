define([
    'intern!object',
    'intern/chai!assert',
    'intern/dojo/node!util',
    'intern/dojo/node!../lib/EventMonitor'
], function (registerSuite, assert, util, eventMonitor) {

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
        name: 'EventMonitor',
        // before the suite starts
        setup: function() {
          em = eventMonitor.get(config1);
        },
        // before each test executes
        beforeEach: function () {

        },
        // after the suite is done
        teardown: function() {
          eventMonitor.close();
        },
        'Create second monitor with same config are equal': function () {
            var em2 = eventMonitor.get(config1);
            assert.strictEqual(em, em2,
                'EventMonitor  should return same object if same config ');
            assert.strictEqual(eventMonitor.list().length, 1,
              'only 1 Monitor listed');
            
        },
        'Create a second monitor with different config': function() {
            var em2 = eventMonitor.get(config2);
            assert.notStrictEqual(em, em2,
                'EventMonitor should return a different object if a different configuration ');
            assert.strictEqual(eventMonitor.list().length, 2);
//            console.log(eventMonitor.list());
        },
        'delete a monitor': function() {
          var monitortodelete = null;
          var size = eventMonitor.list().length;
          assert.strictEqual(size, 2);
          console.log('****em****');
          console.log(em);
          eventMonitor.list().forEach(function(id) {
            console.log('****'+id+'****');
            if (eventMonitor[id] !== em.id)  {
              monitortodelete = eventMonitor.find(id);
            }
          });

          eventMonitor.delete(monitortodelete);
          assert.strictEqual(eventMonitor.list().length, 1, 'Monitor was successfully deleted');
        },
        'Force Unique Client': function() {
          var c1 = Object.create(config1);
          c1.unique = true;
          var size = eventMonitor.list().length;
          assert.strictEqual(size, 1);
          var emUnique1 = eventMonitor.get(c1);
          assert.strictEqual(emUnique1.key, em.key, 'Create two unique Event Monitors with same configuration');
          eventMonitor.delete(emUnique1);

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
