import { sendToWorker, sendToMain } from "./utils";

export const mainMessager = ({ worker, onReceiveAction, onBeforePing }) => {
  // INIT
  worker.addEventListener("message", function handleMessage(mE) {
    const message = JSON.parse(mE.data);
    if (!message.type || message.type !== "WWM_TO_MAIN") return;
    message.payload.forEach(onReceiveAction);
    if (message.meta.pingRequest === "start") startPing();
    if (message.meta.pingRequest === "stop") stopPing();
  });

  // STATE
  let pinging = false;
  let count = 0;
  const actions = [];

  // PRIVATE
  const sendAll = pingData => {
    sendToWorker(worker, {
      type: "WWM_TO_WORKER",
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
    count++;
  };

  // PUBLIC
  const post = action => {
    actions.push(action);
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
  return {
    post,
    startPing,
    stopPing
  };
};

export const workerMessager = ({ onReceiveAction, onBeforePong }) => {
  // INIT
  self.addEventListener("message", function handleMessage(mE) {
    const message = JSON.parse(mE.data);
    if (!message.type || message.type !== "WWM_TO_WORKER") return;
    message.payload.forEach(onReceiveAction);
    if (message.meta.pingData) pong(message.meta.pingData);
  });

  // STATE
  let pinging = false;
  const actions = [];

  // PRIVATE
  const sendAll = ({ pingRequest, pongData }) => {
    sendToMain({
      type: "WWM_TO_MAIN",
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
  const post = action => {
    actions.push(action);
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
