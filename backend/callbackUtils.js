let callbackCount = 0;
const logEntries = [];

// Keep only the latest 10 logs
function logEntry(message) {
  logEntries.push(message);
  if (logEntries.length > 10) {
    logEntries.shift();
  }
}

function getLogs() {
  return logEntries.slice();
}

function resetLogs() {
  logEntries.length = 0;
}

function incrementCount() {
  callbackCount++;
}

function getCallbackCount() {
  return callbackCount;
}

function resetCount() {
  callbackCount = 0;
}

module.exports = {
  incrementCount,
  getCallbackCount,
  resetCount,
  logEntry,
  getLogs,
  resetLogs,
};
