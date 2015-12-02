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

// Learn more about configuring this file at <https://github.com/theintern/intern/wiki/Configuring-Intern>.
// These default settings work OK for most people. The options that *must* be changed below are the
// packages, suites, excludeInstrumentation, and (if you want functional tests) functionalSuites.
define({
	// The port on which the instrumenting proxy will listen
	proxyPort: 9000,

	// A fully qualified URL to the Intern proxy
	proxyUrl: 'http://localhost:9000/',

	// Default desired capabilities for all environments. Individual capabilities can be overridden by any of the
	// specified browser environments in the `environments` array below as well. See
	// https://code.google.com/p/selenium/wiki/DesiredCapabilities for standard Selenium capabilities and
	// https://saucelabs.com/docs/additional-config#desired-capabilities for Sauce Labs capabilities.
	// Note that the `build` capability will be filled in with the current commit ID from the Travis CI environment
	// automatically
	capabilities: {
		'selenium-version': '2.41.0'
	},

abilities: {
    'browserstack.selenium_version': '2.45.0'
  },

  // Browsers to run integration testing against. Note that version numbers must be strings if used with Sauce
  // OnDemand. Options that will be permutated are browserName, version, platform, and platformVersion; any other
  // capabilities options specified for an environment will be copied as-is
  environments: [
    { browserName: 'internet explorer', version: '11', platform: 'WIN8' },
    { browserName: 'internet explorer', version: '10', platform: 'WIN8' },
    { browserName: 'internet explorer', version: '9', platform: 'WINDOWS' },
    { browserName: 'firefox', version: '37', platform: [ 'WINDOWS', 'MAC' ] },
    { browserName: 'chrome', version: '39', platform: [ 'WINDOWS', 'MAC' ] },
    { browserName: 'safari', version: '8', platform: 'MAC' }
  ],

  // Maximum number of simultaneous integration tests that should be executed on the remote WebDriver service
  maxConcurrency: 2,

  // Name of the tunnel class to use for WebDriver tests.
  // See <https://theintern.github.io/intern/#option-tunnel> for built-in options
  tunnel: 'BrowserStackTunnel',

  // Configuration options for the module loader; any AMD configuration options supported by the AMD loader in use
  // can be used here.
  // If you want to use a different loader than the default loader, see
  // <https://theintern.github.io/intern/#option-useLoader> for instruction
  loaderOptions: {
    // Packages that should be registered with the loader in each testing environment
		packages: [// { name: 'rtcomm', location: 'lib/rtcomm' },
                { name: 'support', location: 'tests/support'}],
//		packages: [ { name: 'rtcomm', location: '.' } ]
  },

  // Non-functional test suite(s) to run in each browser
	//suites: [ 'rtcomm/tests/RtcConnector' ],
	suites: [ 'tests/rtcomm/MqttConnection'],
 // suites: [ /* 'myPackage/tests/foo', 'myPackage/tests/bar' */ ],

  // Functional test suite(s) to execute against each browser once non-functional tests are completed
  functionalSuites: [ /* 'myPackage/tests/functional' */ ],

  // A regular expression matching URLs to files that should not be included in code coverage analysis
  excludeInstrumentation: /^(?:tests|node_modules)\//
});
