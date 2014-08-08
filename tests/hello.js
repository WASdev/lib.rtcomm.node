define([
    'intern!object',
    'intern/chai!assert',
    'intern/dojo/node!../rtcomm/hello.js'
], function (registerSuite, assert, hello) {
    registerSuite({
        name: 'hello ',
        'basic tests': function () {
            var scott  = hello.hello('Scott');
            assert.strictEqual('Hello Scott', scott,
                'EventMonitor  should return same object if same config ');
        }
    });
});
