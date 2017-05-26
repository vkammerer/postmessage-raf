import { sendToWorker, sendToMain } from "./utils";

export const mainMessager = ({ worker, onAction }) => {
  // STATE
  const s = {
    pinging: false,
    inOperations: {},
    outOperations: [],
    count: 0
  };
  window.operations = s.operations;

  // INIT
  worker.addEventListener("message", function handleMessage(mE) {
    const message = JSON.parse(mE.data);
    if (!message.type || message.type !== "PMRAF_TO_MAIN") return;
    message.payload.forEach(onOperation);
    if (message.meta.pingRequest === "start") startPing();
    if (message.meta.pingRequest === "stop") stopPing();
  });

  // PRIVATE
  const onOperation = operation => {
    if (!s.pinging) return onAction(operation.payload);
    if (!operation.meta || !operation.meta.delay) {
      s.inOperations[s.count] = s.inOperations[s.count] || [];
      return s.inOperations[s.count].push(operation);
    }
    if (operation.meta.delay.count && operation.meta.delay.count >= s.count) {
      s.inOperations[operation.meta.delay.count] = s.inOperations[
        operation.meta.delay.count
      ] || [];
      return s.inOperations[operation.meta.delay.count].push(operation);
    }
    if (operation.meta.delay.index && operation.meta.delay.index >= 0) {
      s.inOperations[s.count + operation.meta.delay.index] = s.inOperations[
        s.count + operation.meta.delay.index
      ] || [];
      return s.inOperations[s.count + operation.meta.delay.index].push(
        operation
      );
    }
  };
  const processInOperations = () => {
    if (!s.inOperations[s.count]) return;
    s.inOperations[s.count].forEach(operation => onAction(operation.payload));
    s.inOperations[s.count].length = 0;
  };
  const sendAll = ({ pingData }) => {
    sendToWorker(worker, {
      type: "PMRAF_TO_WORKER",
      meta: { pingData },
      payload: s.outOperations
    });
    s.outOperations.length = 0;
  };
  const ping = () => {
    if (!s.pinging) return;
    requestAnimationFrame(ping);
    sendAll({ pingData: { count: s.count } });
    processInOperations();
    s.count++;
  };

  // PUBLIC
  const post = operation => {
    s.outOperations.push(operation);
    if (!s.pinging) sendAll({});
  };
  const startPing = () => {
    s.pinging = true;
    s.count = 0;
    requestAnimationFrame(ping);
  };
  const stopPing = () => {
    s.pinging = false;
    sendAll({});
    processInOperations();
  };
  return { post };
};

export const workerMessager = ({ onAction, onPong }) => {
  // STATE
  const s = {
    pinging: false,
    outOperations: []
  };
  self.operations = s.operations;

  // INIT
  self.addEventListener("message", function handleMessage(mE) {
    const message = JSON.parse(mE.data);
    if (!message.type || message.type !== "PMRAF_TO_WORKER") return;
    if (message.meta.pingData) pong(message.meta.pingData);
    message.payload.forEach(onOperation);
  });

  // PRIVATE
  const onOperation = operation => onAction(operation.payload);
  const sendAll = ({ pingRequest, pongData }) => {
    sendToMain({
      type: "PMRAF_TO_MAIN",
      meta: { pingRequest, pongData },
      payload: s.outOperations
    });
    s.outOperations.length = 0;
  };
  const pong = pingData => {
    if (!s.pinging) return;
    sendAll({ pongData: pingData });
    if (onPong) onPong(post, pingData);
  };

  // PUBLIC
  const post = operation => {
    s.outOperations.push(operation);
    if (!s.pinging) sendAll({});
  };
  const startPing = () => {
    s.pinging = true;
    sendAll({ pingRequest: "start" });
  };
  const stopPing = () => {
    s.pinging = false;
    sendAll({ pingRequest: "stop" });
  };
  return {
    post,
    startPing,
    stopPing
  };
};
