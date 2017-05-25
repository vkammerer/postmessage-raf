import { sendToWorker, sendToMain } from "./utils";

export const mainMessager = ({ worker, onReceiveAction, onBeforePing }) => {
  // INIT
  worker.addEventListener("message", function handleMessage(mE) {
    const message = JSON.parse(mE.data);
    if (!message.type || message.type !== "PMRAF_TO_MAIN") return;
    message.payload.forEach(onAction);
    if (message.meta.pingRequest === "start") startPing();
    if (message.meta.pingRequest === "stop") stopPing();
  });

  // STATE
  let pinging = false;
  let count = 0;
  const actions = [];
  const dActions = {};

  // PRIVATE
  const onAction = ({ action, count: actionCount }) => {
    if (!actionCount || actionCount === count) onReceiveAction(action);
    else if (actionCount > count) {
      dActions[actionCount] = dActions[actionCount] || [];
      dActions[actionCount].push(action);
    }
  };
  const receiveDelayedActions = count => {
    if (!dActions[count]) return;
    dActions[count].forEach(onReceiveAction);
    dActions[count].length = 0;
  };
  const sendAll = pingData => {
    sendToWorker(worker, {
      type: "PMRAF_TO_WORKER",
      meta: { pingData },
      payload: actions
    });
    actions.length = 0;
  };
  const ping = () => {
    if (!pinging) return;
    requestAnimationFrame(ping);
    if (onBeforePing) onBeforePing(post, count);
    sendAll({ count, time: performance.now() });
    receiveDelayedActions(count);
    count++;
  };

  // PUBLIC
  const post = action => {
    actions.push({ action });
    if (!pinging) sendAll();
  };
  const startPing = () => {
    pinging = true;
    count = 0;
    requestAnimationFrame(ping);
  };
  const stopPing = () => {
    pinging = false;
    sendAll();
  };
  return { post };
};

export const workerMessager = ({ onReceiveAction, onBeforePong }) => {
  // INIT
  self.addEventListener("message", function handleMessage(mE) {
    const message = JSON.parse(mE.data);
    if (!message.type || message.type !== "PMRAF_TO_WORKER") return;
    message.payload.forEach(onAction);
    if (message.meta.pingData) pong(message.meta.pingData);
  });

  // STATE
  let pinging = false;
  const actions = [];

  // PRIVATE
  const onAction = ({ action }) => {
    onReceiveAction(action);
  };
  const sendAll = ({ pingRequest, pongData }) => {
    sendToMain({
      type: "PMRAF_TO_MAIN",
      meta: { pingRequest, pongData },
      payload: actions
    });
    actions.length = 0;
  };
  const pong = pingData => {
    if (!pinging) return;
    if (onBeforePong) onBeforePong(post, pingData);
    sendAll({ pongData: pingData });
  };

  // PUBLIC
  const post = (action, count) => {
    actions.push({ action, count });
    if (!pinging) sendAll({});
  };
  const startPing = () => {
    pinging = true;
    sendAll({ pingRequest: "start" });
  };
  const stopPing = () => {
    pinging = false;
    sendAll({ pingRequest: "stop" });
  };
  return {
    post,
    startPing,
    stopPing
  };
};
