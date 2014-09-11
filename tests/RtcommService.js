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
    'intern/dojo/node!./RtcommService'
], function (registerSuite, assert, rtc) {
    registerSuite({
        name: 'RtcConnector instantiatiation',
        'basic tests': function () {
            var em = rtc.get({server:'svt-msd1.rtp.raleigh.ibm.com',port:1883,eventPath:'/rtcomm/event'});
            var em2 = rtc.get({server:'svt-msd1.rtp.raleigh.ibm.com',port:1883,eventPath:'/rtcomm/event'});
            assert.strictEqual(em, em2,
                'RtcConnector  should return same object if same config ');
        }
    });
});
