export const sendToWorker = (worker, message) => {
  const stringed = JSON.stringify(message);
  worker.postMessage(stringed);
};

export const sendToMain = message => {
  const stringed = JSON.stringify(message);
  self.postMessage(stringed);
};
