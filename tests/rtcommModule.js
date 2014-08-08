define([
    'intern!object',
    'intern/chai!assert',
    'intern/dojo/node!../lib/EventMonitor'
], function (registerSuite, assert, rtcomm) {
    var config1 = {server:'svt-msd1.rtp.raleigh.ibm.com',port:1883,eventPath:'/rtcomm/event'};
    var config2 = {server:'svt-msd2.rtp.raleigh.ibm.com',port:1883,eventPath:'/rtcomm/event'};
    registerSuite({
        name: 'rtcommModule',
        'Create second monitor with same config are equal': function () {
            var em = rtcomm.get(config1);
            var em2 = rtcomm.get(config1);
            assert.strictEqual(em, em2,
                'EventMonitor  should return same object if same config ');
            assert.strictEqual(rtcomm.list().length, 1);
 //           console.log(rtcomm.list());
            
        },
        'Create a second monitor with different config': function() {
            var em = rtcomm.get(config1);
            var em2 = rtcomm.get(config2);
            assert.notStrictEqual(em, em2,
                'EventMonitor should return a different object if a different configuration ');
            assert.strictEqual(rtcomm.list().length, 2);
//            console.log(rtcomm.list());
        },
        'delete a monitor': function() {
          var em = rtcomm.get(config1);
          var em2 = rtcomm.get(config2);
          rtcomm.delete(em2);
          assert.strictEqual(rtcomm.list().lenght,1 );
          assert.strictEqual(rtcomm.list()[0], em.key);
        }
    });
});
