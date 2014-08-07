# Abstract
Starting out, our main goals when building the base Rtcomm protocols were to make them both extremely simple and extremely useful. After years of working with telco based protocols like SIP, we wanted to create something simpler for the web that did not carry all the baggage necessary to support the global telephone network but we also wanted it to be interoperable with those legacy protocols if needed.

The Rtcomm MQTT based protocol can be broken down into the following two parts:

1. Signalling protocol for connecting WebRTC clients.
2. Service protocol for things like third party call control and event monitoring.

This specification describes the service protocol which is implemented by the Rtcomm node.js modules included in this repository. This protocol is typically used to interact with server-side Rtcomm components such as the Liberty profile of the WebSphere application server (rtcomm-1.0 feature) to do things like:

1. Monitor events related to the starting and stopping of new signalling sessions.
1. Monitor when endpoints register and unregister.
1. Initiate a third party call request.

# Rtcomm Services

This protocol specification is built on the publish/subscribe semantics of the MQTT protocol. Events are monitored by subscribing on one or more topics that are typically configured at a backend server that supports Rtcomm event publishing and third party call requests are published by client components, such as the 3PCC node module included in this repository, to a topic that is subscribed on by a server that supports third party calling (e.g. WebSphere Liberty Application Server).

The next sections describe details on the various types of Rtcomm services and their associated protocols.

## Event Monitoring





