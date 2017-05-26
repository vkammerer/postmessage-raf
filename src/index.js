import { sendToWorker, sendToMain } from "./utils";

export const mainMessager = ({ worker, onAction, onBeforePing }) => {
  // STATE
  const s = {
    pinging: false,
    operations: { next: [] },
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
    if (
      !operation.meta ||
      !operation.meta.delay ||
      !operation.meta.delay.count ||
      operation.meta.delay.count === s.count
    )
      onAction(operation.payload);
    else if (operation.meta.delay.count > s.count) {
      s.operations[operation.meta.delay.count] = s.operations[
        operation.meta.delay.count
      ] || [];
      s.operations[operation.meta.delay.count].push(operation);
    }
  };
  const processDelayedOperations = () => {
    if (!s.operations[s.count]) return;
    s.operations[s.count].forEach(operation => onAction(operation.payload));
    s.operations[s.count].length = 0;
  };
  const sendAll = ({ pingData }) => {
    sendToWorker(worker, {
      type: "PMRAF_TO_WORKER",
      meta: { pingData },
      payload: s.operations.next
    });
    s.operations.next.length = 0;
  };
  const ping = () => {
    if (!s.pinging) return;
    requestAnimationFrame(ping);
    if (onBeforePing) onBeforePing(post, s.count);
    sendAll({ pingData: { count: s.count, time: performance.now() } });
    processDelayedOperations();
    s.count++;
  };

  // PUBLIC
  const post = operation => {
    s.operations.next.push(operation);
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
  };
  return { post };
};

export const workerMessager = ({ onAction, onBeforePong }) => {
  // STATE
  const s = {
    pinging: false,
    operations: { next: [] }
  };
  self.operations = s.operations;

  // INIT
  self.addEventListener("message", function handleMessage(mE) {
    const message = JSON.parse(mE.data);
    if (!message.type || message.type !== "PMRAF_TO_WORKER") return;
    message.payload.forEach(onOperation);
    if (message.meta.pingData) pong(message.meta.pingData);
  });

  // PRIVATE
  const onOperation = operation => onAction(operation.payload);
  const sendAll = ({ pingRequest, pongData }) => {
    sendToMain({
      type: "PMRAF_TO_MAIN",
      meta: { pingRequest, pongData },
      payload: s.operations.next
    });
    s.operations.next.length = 0;
  };
  const pong = pingData => {
    if (!s.pinging) return;
    if (onBeforePong) onBeforePong(post, pingData);
    sendAll({ pongData: pingData });
  };

  // PUBLIC
  const post = operation => {
    s.operations.next.push(operation);
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
