"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { CompanionService } = require("../src/service");

function lifecycleService(options = {}) {
  const service = Object.create(CompanionService.prototype);
  Object.assign(service, {
    mpvExitTimer: null,
    shuttingDown: false,
    mpvConnected: false,
    config: { runOnlyWithMpv: true },
    mpvExitDelayMs: options.mpvExitDelayMs || 15,
    deliveryGraceMs: options.deliveryGraceMs || 20,
    transport: { clients: new Set(options.connected ? [{}] : []) },
    journal: { list: () => [] }
  });
  return service;
}

test("run-only mode requests exit after MPV closes", async () => {
  const service = lifecycleService();
  const exited = once(service, "exit-requested");
  service.scheduleExitAfterMpv();
  service.mpvExitTimer.ref?.();
  assert.deepEqual(await exited, ["mpv closed"]);
});

test("an MPV reconnect during the grace delay cancels exit", async () => {
  const service = lifecycleService({ mpvExitDelayMs: 20 });
  let exited = false;
  service.once("exit-requested", () => { exited = true; });
  service.scheduleExitAfterMpv();
  service.mpvExitTimer.ref?.();
  setTimeout(() => { service.mpvConnected = true; }, 5);
  await new Promise(resolve => setTimeout(resolve, 35));
  assert.equal(exited, false);
});

test("pending activity receives an acknowledgement grace period before exit", async () => {
  const service = lifecycleService({ connected: true, deliveryGraceMs: 40 });
  let pending = 1;
  service.journal.list = () => Array.from({ length: pending });
  const exited = once(service, "exit-requested");
  const started = Date.now();
  service.scheduleExitAfterMpv();
  service.mpvExitTimer.ref?.();
  setTimeout(() => { pending = 0; }, 20);
  await exited;
  assert.ok(Date.now() - started >= 20);
});
