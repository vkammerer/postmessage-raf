A small layer on top of ```postMessage``` and ```requestAnimationFrame``` to improve performance with web workers.

## Installation   
```shell
npm i @vkammerer/postmessage-raf
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
messager.post({ payload: action });
```

In "slave.js", the worker:
```javascript
import { workerMessager } from "@vkammerer/postmessage-raf";

const messager = workerMessager({
  onAction: action => console.log(action.foo); // 'bar'
});
```

In this example, the method ```post``` simply calls ```JSON.stringify``` on the action, which is then parsed with ```JSON.parse``` in the other thread.

### Ping mode   
The point of this library is to optimize the time at which messages are sent between the main and the worker threads, so that every message is exchanged at the beginning of a [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame) call.   
In order to do that, the worker can call the method ```startPing``` on its messager.   

In the worker:
```javascript
messager.startPing();
```   

This triggers the "Ping mode":
- the main thread will send a "ping" message to the worker on every ```requestAnimationFrame``` and the worker thread will respond with a "pong" message.
- any action posted with ```messager.post()``` will not be sent immediately to the other thread, but added to a queue and sent only along with "ping" and "pong" messages.

## API   

#### - mainMessager   
The function ```mainMessager``` takes an single object as parameter, with the following structure:   
```javascript
const messager = mainMessager({
  worker: new Worker('./slaveWorker.js'),
  // worker instance
  onAction: action => { console.log(`Just received an action of type ${action.type}`) },
  // function to execute on all actions received from the worker
});

```
It returns an object with the ```post``` method:
```javascript
const action = {
  foo: 'bar',
  data: ['a', 'b']
}
messager.post({ payload: action });
// Sends action to the worker
```
The action passed to ```post``` should be namespaced under ```{ payload: {} }```. This is to preserve the same format as the post method returned by  ```workerMessager``` (see here under).

#### - workerMessager   
The function ```workerMessager``` takes an single object as parameter, with the following structure:   
```javascript
const messager = mainMessager({
  onAction: action => { console.log(`Just received an action of type ${action.type}`) },
  // function to execute on all actions received from the main thread
  onPong: pingData => {
    console.log(
      `The worker just sent a pong message.
      The number of pings since startPing was called is ${pingData.count}.`;
    )
  }
  // function executed after the pong message in "Ping mode"
});
```
It returns an object with the following methods:
```javascript
  post, // Sends action to the worker - see usage here under
  startPing, // Initiates "Ping mode"
  stopPing, // Terminates "Ping mode" and resumes "Default mode"
```
Usage:
```javascript
const action = {
  foo: 'bar',
  data: ['a', 'b']
}
messager.post({
  payload: action,
  meta: {
    delay: {
      count: 10,
      // Registers the action to be called at the 10th ping since startPing was called.
      // If the ping has already occured or if the pinging mode is stopped before,
      // the action will be ignored.
      // Not to be used in conjunction with 'index' here under
      index: 12
      // Registers the action to be called 12 pings after the main thread will receive it.
      // If the pinging mode is stopped before, the action will be ignored.
      // Not to be used in conjunction with 'count' here above
    }
  }
});
// Sends action to the main thread
```

## Example diagram
Here under is an example of how a user input ```U``` would propagate to the worker application, which could then emit a response ```R``` back to the main thread.   
```
mainApp:  -----U-------------------R-----------
pingMsg:  -P-------P-------P-------P-------P---
                   U

pongMsg:  ---P-------P-------P-------P-------P-
                             R
workerApp:-----------U-R-----------------------
```   
As you can see, there is a minimum of two times the duration of ```requestAnimationFrame``` calls for the main thread to get a response. If the frame rate is at about 60 FPS, that means we get a response in about 50 ms. This time is satisfying as the user will not notice the latency.   

For more information on acceptable latency after user input, see the Response category of the [RAIL model](https://developers.google.com/web/fundamentals/performance/rail).
