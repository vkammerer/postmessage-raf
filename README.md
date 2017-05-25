A small layer on top of ```postMessage``` and ```requestAnimationFrame``` to improve performance with web workers.

## Installation   
```shell
npm i @vkammerer/webworker-postmessage
```

## Usage   

### Default mode   
In its most basic usage, the library is nothing more than syntaxic sugar on top of the native [postMessage](https://developer.mozilla.org/en/docs/Web/API/Worker/postMessage) API.   

In the main thread:
```javascript
import { mainMessager } from "@vkammerer/postmessage-raf";

const slaveWorker = new Worker("./slave.js");
const messager = mainMessager({ worker: slaveWorker });

const action = { foo: 'bar' };
messager.post(action);
```

In "slave.js", the worker:
```javascript
import { workerMessager } from "@vkammerer/webworker-postmessage";

const messager = workerMessager({
  onReceiveAction: action => console.log(action.foo); // 'bar'
});
```

In this example, the method ```post``` simply calls ```JSON.stringify``` on the "action" object, which is then parsed with ```JSON.parse``` in the other thread.

### Ping mode   
The point of this library is to optimize the time at which messages are sent between the main and the worker threads, so that every message is exchanged at the beginning of a [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame) call.   
In order to do that, the worker can call the method ```startPing``` on its messager.   

In the worker:
```javascript
messager.startPing();
```   

This triggers the "Ping mode":
- the main thread will send a "ping" message to the worker on every ```requestAnimationFrame``` and the worker thread will respond with a "pong" message.
- any "action" posted with ```messager.post()``` will not be sent immediately to the other thread, but added to a queue and sent only along with "ping" and "pong" messages.

## API   

#### mainMessager   
The function ```mainMessager``` takes an single object as parameter, with the following structure:   
```javascript
const messager = mainMessager({
  worker: new Worker('./slaveWorker.js'),
  // worker instance
  onReceiveAction: action => { console.log(`Just received an action of type ${action.type}`) },
  // callback function to execute on all action objects received from the worker
  onBeforePing: count => {
    console.log(
      `About to send a ping message. The count is ${count}.
      It is the number of ping messages sent since the last 'startPing()' call.`;
    )
  }
  // hook function executed before the ping message in "Ping mode"
});

```
It returns an object with the ```post``` method:
```javascript
const action = {
  foo: 'bar',
  data: ['a', 'b']
}
messager.post(action);
// Encodes the action object and sends it to the worker
```

#### workerMessager   
The function ```workerMessager``` takes an single object as parameter, with the following structure:   
```javascript
const messager = mainMessager({
  onReceiveAction: action => { console.log(`Just received an action of type ${action.type}`) },
  // callback function to execute on all action objects received from the main thread
  onBeforePong: pingData => {
    console.log(
      `About to send a pong message.
      The ping count was ${pingData.count}.
      The ping time was ${pingData.time}.`;
    )
  }
  // hook function executed before the pong message in "Ping mode"
});
```
It returns an object with the following methods:
```javascript
{
  post, // Encodes the action object and sends it to the worker
  startPing, // Initiates "Ping mode" and terminates "Default mode"
  stopPing, // Terminates "Ping mode" and resumes "Default mode"
}
```

## TODO   
- Support for delayed action callbacks: make it possible for the worker to send a collection of actions, each associated with a count index, and call ```onReceiveAction``` only when the corresponding ping occurs.
