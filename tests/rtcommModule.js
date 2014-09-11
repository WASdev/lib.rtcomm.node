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
    'intern/dojo/node!../lib/RtcConnector'
], function (registerSuite, assert, rtcomm) {
    var config1 = {server:'svt-msd1.rtp.raleigh.ibm.com',port:1883,eventPath:'/rtcomm/event'};
    var config2 = {server:'svt-msd2.rtp.raleigh.ibm.com',port:1883,eventPath:'/rtcomm/event'};
    registerSuite({
        name: 'rtcommModule',
        'Create second monitor with same config are equal': function () {
            var em = rtcomm.get(config1);
            var em2 = rtcomm.get(config1);
            assert.strictEqual(em, em2,
                'RtcConnector  should return same object if same config ');
            assert.strictEqual(rtcomm.list().length, 1);
 //           console.log(rtcomm.list());
            
        },
        'Create a second monitor with different config': function() {
            var em = rtcomm.get(config1);
            var em2 = rtcomm.get(config2);
            assert.notStrictEqual(em, em2,
                'RtcConnector should return a different object if a different configuration ');
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
