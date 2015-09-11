#Rtcomm Service Protocol Specification: v1.0.0 

## Abstract
This specification defines v1.0.0 of the Service Protocol.  All Rtcomm protocols are built on top of MQTT. They are JSON based and as lightweight as possible. The protocol can be broken down into the following two parts:

1. Signaling protocol for connecting WebRTC clients into media sessions. See [**rtcomm.signaling.proto.md**](https://github.com/WASdev/lib.rtcomm.clientjs/blob/master/rtcomm.signaling.proto.spec.md) for details.
2. Service protocol for things like third party call control and event monitoring of specific rtcomm services that run on the WebSphere Liberty profile.

This specification describes the service protocol which is implemented by the Rtcomm node.js modules included in this repository. This protocol is used to interact with server-side Rtcomm components running on the Liberty profile of the WebSphere application server (rtcomm-1.0 feature) to do things like:

1. Monitor events related to the starting and stopping of new signaling sessions.
2. Monitor when endpoints register and unregister.
3. Initiate a third party call request.

# Rtcomm Services

This protocol specification is built on the publish/subscribe semantics of the MQTT protocol. Rtcomm Service Events are monitored by subscribing on a topic used to publish Rtcomm service events and third party call requests are published by client components, such as the 3PCC node module included in this repository, to a topic that is subscribed on the WebSphere Liberty third party calling service.

The next sections describe details on the various types of Rtcomm services and their associated protocols.

## Rtcomm Event Monitoring

Rtcomm session events are published from an Rtcomm service which is part of the rtcomm-1.0 feature in the WebSphere Liberty profile. These events are fired at a topic tree that allows event consumers to subscribe on only what is needed. The Rtcomm event topic tree makes it easy for consumers to filter on specific session events. The following details what the event topic tree looks like (note that .. defines the event topic root typically configured at the event source):

`../<category>/<action>/fromEndpointID/toEndpointID}`

Supported category include:

| Category            | Details                   |
| ----------------- | :------------------------- |
| session           | Events related to Rtcomm peer media sessions. |

Supported actions include:

| Action          | Details                   |
| ----------------- | :------------------------- |
| started      | Events related to creation of a new entity of a certain category type. |
| modified           | Events related to modification of an existing entity of a certain category type. |
| stopped           | Events related to destruction of an existing entity of a certain category type. |
| failed           | Events related to the failure of a new or existing entity of a certain category type. |


Here are some examples of topics that can be subscribed on to filter on various Rtcomm events:

| Topic                   | Details                                     |
| ----------------------- |:-------------------------------------------|
| ../#                      | Receive all Rtcomm related events                          |
| ../session/#              | Receive all session events                  |
| ../session/started/mic_jagger/# | Receive an event every time Mic Jagger makes a call |



Since much of the information about the event is contained in the topic being published to, the event messages themselves are fairly simply. First, every Rtcomm event is a JSON object that contains the following key/value pairs:

| Key                   | Value                                     |
| ----------------------|:-------------------------------------------|
| method                | RTCOMM_EVENT_FIRED |
| rtcommVer             | e.g.  v0.1.0
| timestamp             | e.g.  2014-08-01 17:32:07.735 |
| appContext            | Application context associated with the event    |
| reason                | Any failed event will include a reason    |


In addition, session events can include these additional key/value pairs:

| Key                   | Value                                     |
| ----------------------|:-------------------------------------------|
| sigSessID             | Signaling session ID associated with this event.   |

**See [rtcomm.signaling.proto.md](https://github.com/WASdev/lib.rtcomm.clientjs/blob/master/rtcomm.signaling.proto.spec.md) for details on sigSessID.**


## Third-Party Call Control

Third-party call control (3PCC) is used to initiate an Rtcomm peer-to-peer media session between two Rtcomm clients. The WebSphere Liberty Rtcomm 3PCC service subscribes on a well know MQTT topic to receive 3PCC request. The 3PCC service is responsible for extracting the information needed from the 3PCC request and setting up the call. Once the session is either up and running or fails for some reason, a response to the 3PCC request is sent back to the originating requestor.

The 3PCC request message is as follows:

| Key                   | Value                                     |
| ----------------------|:-------------------------------------------|
| method                | 3PCC_PLACE_CALL |
| rtcommVer             | e.g.  v1.0.0          |
| transID               | transaction for this request/response. May also be used in the signaling transaction. |
| callerEndpoint        | Calling endpoint ID associated with the resulting media session.    |
| calleeEndpoint        | Endpoint ID who should receive the call.    |
| fromTopic             | Topic the response to the request will be sent to    |
| sessionID             | OPTIONAL: session ID that should be use for the resulting media session  |

**Note that all sessionIDs should be UUIDs to insure they are globally unique**

The 3PCC response message is as follows:

| Key                   | Value                                     |
| ----------------------|:-------------------------------------------|
| method                | RESPONSE |
| orig                  | 3PCC_PLACE_CALL          |
| transID               | transaction for this request/response. May also be used in the signaling transaction. |
| result                | SUCCESS or FAILURE    |
| reason                | Provides a reason if there is a FAILURE. Not included with a SUCCESS response.    |

