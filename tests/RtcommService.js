define([
    'intern!object',
    'intern/chai!assert',
    'intern/dojo/node!./RtcommService'
], function (registerSuite, assert, rtc) {
    registerSuite({
        name: 'EventMonitor instantiatiation',
        'basic tests': function () {
            var em = rtc.get({server:'svt-msd1.rtp.raleigh.ibm.com',port:1883,eventPath:'/rtcomm/event'});
            var em2 = rtc.get({server:'svt-msd1.rtp.raleigh.ibm.com',port:1883,eventPath:'/rtcomm/event'});
            assert.strictEqual(em, em2,
                'EventMonitor  should return same object if same config ');
        }
    });
});
