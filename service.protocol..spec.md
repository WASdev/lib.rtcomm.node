# Abstract
Our main goals when building the base Rtcomm protocols were to make them extremely simple and extremely useful. After years of working with telco based protocols like SIP, we wanted to create something simpler for the web that did not carry all the baggage necessary to support the global telephone network but we also wanted it to be interoperable with those legacy protocols when needed.

With that said, all Rtcomm protocols are built on top of MQTT. They are JSON based and as lightweight as possible. The protocol can be broken down into the following two parts:

1. Signaling protocol for connecting WebRTC clients into media sessions.
2. Service protocol for things like third party call control and event monitoring.

This specification describes the service protocol which is implemented by the Rtcomm node.js modules included in this repository. This protocol is typically used to interact with server-side Rtcomm components such as the Liberty profile of the WebSphere application server (rtcomm-1.0 feature) to do things like:

1. Monitor events related to the starting and stopping of new signalling sessions.
1. Monitor when endpoints register and unregister.
1. Initiate a third party call request.

# Rtcomm Services

This protocol specification is built on the publish/subscribe semantics of the MQTT protocol. Events are monitored by subscribing on one or more topics that are typically configured at a backend server that supports Rtcomm event publishing and third party call requests are published by client components, such as the 3PCC node module included in this repository, to a topic that is subscribed on by a server that supports third party calling (e.g. WebSphere Liberty Application Server).

The next sections describe details on the various types of Rtcomm services and their associated protocols.

## Event Monitoring

Rtcomm events can be published from any component that uses the Rtcomm signaling protocol but they are typically generated from server-side components such as the Rtcomm Node Connector in the WebSphere Liberty profile. These events are fired at a topic tree that allows event consumers to subscribe on only what is needed. The Rtcomm event topic tree makes it easy for consumers to filter on specific events. The following details what the event topic tree looks like (note that .. defines the event topic root typically configured at the event source):

`../<category>/<action>/fromEndpointID/toEndpointID}`

Supported categories include:

| Category          | Details                   |
| ----------------- | ------------------------- |
| registration      | Events related to Rtcomm client registrations. |
| session           | Events related to Rtcomm peer media sessions. |

Supported actions include:

| Action          | Details                   |
| ----------------- | ------------------------- |
| started      | Events related to creation of a new entity of a certain category type. |
| modified           | Events related to modification of an existing entity of a certain category type. |
| stopped           | Events related to destruction of an existing entity of a certain category type. |
| failed           | Events related to the failure of a new or existing entity of a certain category type. |


Here are some examples of topics that can be subscribed on to filter on various Rtcomm events:

| Topic                   | Details                                     |
| ----------------------- |:-------------------------------------------:|
| ../#                      | Receive all events                          |
| ../registration/#         | Receive all registration events             |
| ../registration/#/mic_jagger | Receive all registration events related to Mic Jagger   |
| ../session/#              | Receive all session events                  |
| ../registration/started/# | Receive an event every time a new client registers    |
| ../registration/started/mic_jagger | Receive an event every time Mic Jagger registers |
| ../session/strated/mic_jagger/# | Receive an event every time Mic Jagger makes a call |

Since much of the information about the event is contained in the topic being published to, the event messages themselves are fairly simply. First, every Rtcomm event is a JSON object that contains the following key/value pairs:

| Key                   | Details                                     |
| ----------------------|:-------------------------------------------:|
| method                | RTCOMM_EVENT_FIRED |
| version               | e.g.  1.0          |
| timestamp             | e.g.  2014-08-01 17:32:07.735 |
| appContext            | Application context associated with the event    |
| reason                | Any failed event will include a reason    |

In addition, registration events can also include these additional key/value pairs:

| Key                   | Details                                     |
| ----------------------|:-------------------------------------------:|
| regTopic              | Topic name associated with this registration event |
| transID             | Transaction ID associated transaction that caused this event (started|modified only) |

**Note that clients can register several appContext under the same endpoint ID**

In addition, session events can include these additional key/value pairs:

| Key                   | Details                                     |
| ----------------------|:-------------------------------------------:|
| sigSessID             | Signaling session ID associated with this event.   |

**See [signaling.protocol.md](https://github.com/WASdev/lib.rtcomm.clientjs/blob/master/signaling.protocol.spec.md) for details on sigSessID**

## Third-Party Call Control




