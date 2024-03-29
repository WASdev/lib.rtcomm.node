#API Protocol specification for lib.rtcomm.node 

## Abstract

**lib.rtcomm.node** provides two modules within rtcomm:

**RtcConnector** - Used to monitor events generated by an RtcConnector on the WebSphere Liberty Profile server which is part of the rtcomm-1.0 feature.

**ThirdPartyCC** - Create calls between two Endpoints that are registered with an RtcConnector on the WebSphere Liberty Profile server which is part of the rtcomm-1.0 feature. 

## RtcConnector API

The RtcConnector API provides the ability to create filtered event monitors and can be used to consume events generated by the RtConnector which is part of the 
rtcomm-1.0 feature of the WebSphere Liberty Profile.

#### .get(config)
Return an RtcConnector object.  This will be a new object if the key for the monitor does not exist.  The key is based on the passed config.

|param | description |
|-------|------------|
|eventPath| EventPath topic server emits events on|
|server| MQTT Broker server name|
|port|  MQTT Broker Server port|
|unique|  **false**, Change to **true** to create unique monitor and mqtt connection rather than use existing one w/ same broker |

Returns an 'RtcConnector' Object.

```
var em = require('rtcomm').RtcConnector;
var myEm = em.get({server: server.broker.com, port: 1883, eventPath: '/eventPath/', unique: true});

```

#### .list
Return an Array list of defined RtcConnector(s). 

```
var emList = em.list();
```

#### .delete(monitor)
Delete an RtcConnector. This stops the monitors filters and then removes the monitor.
```
em.delete(myEm);
```

#### .close
Close all event monitors.
``` 
em.close();
```

#### RtcConnector Object
This is the primary object that provides a filter and a callback.  Each Filter has a callback that can be used to handle the message that is received on the filter.  After getting an RtcConnector object, add a Filter and start it:

```
// Define the event handlers
myEm.on('connected',function(){
	console.log('connected');
});
myEm.on('disconnected',function(){
  console.log('disconnected');
});
myEm.on('error',function(error){
   console.log('error', error);
});

// Start the RtcConnector event monitor
myEm.start();

// Add a filter
myEm.allEndpointEvents('scott', function(message) {
	console.log('Event generated for scott ' + message);
});
```

#### Primary Methods
 
#####.start()
 Initialize the monitor and connect to the broker.
 
#####.stop()
 Disconnect the monitor from the broker.


#### Filter Methods
The following methods provide a simple way create a filter for the most common types of events.  The callback is called with a *topic* and *message*:

*Topic:*  /eventPath/[session]/[started|stopped|modified|failed]/fromEndpointID/toEndpointID 

*Message:* 

```
{ method: 'RTCOMM_EVENT_FIRED' }
```

##### .allEndpointEvents(endpointid, filterFunction)
Return events generated TO or FROM the given endpointid.   Passes 'topic' and 'message'  to the callback *filterFunction*
Examples include: <rtcommTopicPath>/connector for session events or  <rtcommTopicPath>/sphere for presence events

##### .allEventFilter(filterFunction)
Return all events.   Passes 'topic' and 'message' to the callback *filterFunction*

##### .allPresenceEvents(filterFunction)
Return all presence events.   Passes 'topic' and 'message'  to the callback *filterFunction*

#####.allSessionEvents(filterFunction)
Return all *session* events.   Passes 'topic' and 'message'  to the callback *filterFunction*

#####.addFilter(configopt, filterFunction)
Create a custom filter.  It is advised to check the above for common filters to ensure you are not doing unnecessary work.

###### configopt
```
{
          'category': {
            'session': /*boolean*/ true, 
           'action': {
             'started':/*boolean*/ true,
             'modified':/*boolean*/ true,
             'stopped':/*boolean*/ true, 
             'failed':/*boolean*/ true },
           'toendpointid': /* String */ toEndpoint,
           'fromendpointid': /* String */ fromEndpoint}
```
For *configopts*, the default is to *INCLUDE* all events, when a flag is not included (like **configopts.action**) all action events include **configopts.action.start** , **configopts.action.modified** , **configopts.action.stopped** and **configopts.action.failed** will be true and all of the actions will be included.     

Returns all events matching the customer filter.  Passes 'topic' and 'message' to the callback *filterFunction*.


#####.removeFilter(filter)
 Stop and remove the Filter passed.
 
 
### ThirdPartyCC API
This API is used to create third party calls between two endpoints registered with an RtcConnector running on a WebSphere Liberty server.  
The ThirdPartyCC library sends a message to the Liberty server which will then send a refer message to the 'Caller', informing it to call the 'Callee'.  

#### .get(config, callback)

Return a ThirdPartyCC object.  

|param | description |
|-------|------------|
|server| MQTT Broker server name|
|port|  MQTT Broker Server port|
|topic| 3PCC Topic |

Returns a 'ThirdPartyCC' Object.

```
var 3pcc = require('rtcomm').ThirdPartyCC;
var my3pcc = 3pcc.get({server: server.broker.com, port: 1883, topic: '/rtcomm/ThirdPartyCC'});
```

#### ThirdPartyCC Object

#####.start()
Initialize the ThirdPartyCC object by connecting to the broker.
```
my3pcc.start();
```

#####.stop()
Stop the ThirdPartyCC object by disconnecting from the broker.
```
my3pcc.stop();
```

#####.startCall(/* String */ callerEndpointID, /* String */calleeEndpointID)
Create a call between **callerEndpointID** and **calleeEndpointID**.  
```
my3pcc.start();
my3pcc.startCall('scott','brian');
```
The above asks the server to have **scott** call **brian**
