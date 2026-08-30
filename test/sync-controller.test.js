"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { syncWithChrome } = require("../src/app/sync-controller");

function serviceWith(results) {
  let syncIndex = 0;
  return {
    pairingCalls: 0,
    syncCalls: 0,
    syncPending() {
      this.syncCalls += 1;
      return results[Math.min(syncIndex++, results.length - 1)];
    },
    startPairing() { this.pairingCalls += 1; },
    dashboardUrl() { return "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/dashboard.html"; }
  };
}

test("Sync now uses an already connected Chrome extension without opening Chrome", async () => {
  const service = serviceWith([{ connected: true, pending: 2 }]);
  let processChecks = 0;
  let launches = 0;
  const result = await syncWithChrome({
    service,
    isChromeRunning: async () => { processChecks += 1; return true; },
    launchChrome: () => { launches += 1; return true; },
    waitForAcks: async () => true
  });
  assert.equal(result.ok, true);
  assert.equal(processChecks, 0);
  assert.equal(launches, 0);
  assert.equal(service.syncCalls, 1);
});

test("Sync now never opens a new window when Chrome is already running", async () => {
  const service = serviceWith([{ connected: false, pending: 1 }]);
  let launches = 0;
  const result = await syncWithChrome({
    service,
    isChromeRunning: async () => true,
    launchChrome: () => { launches += 1; return true; },
    waitForConnection: async () => false
  });
  assert.equal(result.ok, false);
  assert.equal(launches, 0);
  assert.equal(service.pairingCalls, 0);
  assert.match(result.message, /Open Osmolog once/);
});

test("Sync now opens Osmolog once when Chrome is closed, then replays the queue", async () => {
  const service = serviceWith([
    { connected: false, pending: 1 },
    { connected: true, pending: 1 }
  ]);
  let launches = 0;
  const result = await syncWithChrome({
    service,
    isChromeRunning: async () => false,
    launchChrome: () => { launches += 1; return true; },
    waitForConnection: async () => true,
    waitForAcks: async () => true
  });
  assert.equal(result.ok, true);
  assert.equal(result.openedChrome, true);
  assert.equal(launches, 1);
  assert.equal(service.pairingCalls, 1);
  assert.equal(service.syncCalls, 2);
});
