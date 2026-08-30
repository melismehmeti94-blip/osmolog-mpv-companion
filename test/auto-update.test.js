"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const EventEmitter = require("node:events");
const {
  createAutoUpdateController,
  isPortableBuild,
  shouldEnableAutoUpdates
} = require("../src/app/auto-update");

class FakeUpdater extends EventEmitter {
  constructor() {
    super();
    this.checks = 0;
  }

  async checkForUpdates() {
    this.checks += 1;
    this.emit("checking-for-update");
  }
}

test("automatic updates run only for the packaged Windows installer", () => {
  const app = { isPackaged: true };
  assert.equal(isPortableBuild({ PORTABLE_EXECUTABLE_FILE: "C:\\Apps\\Osmolog.exe" }), true);
  assert.equal(isPortableBuild({}), false);
  assert.equal(shouldEnableAutoUpdates({ app, platform: "win32", environment: {} }), true);
  assert.equal(shouldEnableAutoUpdates({ app, platform: "win32", environment: { PORTABLE_EXECUTABLE_FILE: "Osmolog.exe" } }), false);
  assert.equal(shouldEnableAutoUpdates({ app, platform: "linux", environment: {} }), false);
  assert.equal(shouldEnableAutoUpdates({ app: { isPackaged: false }, platform: "win32", environment: {} }), false);
});

test("installed builds check on startup and periodically, then install on normal exit", async () => {
  const updater = new FakeUpdater();
  const statuses = [];
  const timeouts = [];
  const intervals = [];
  const controller = createAutoUpdateController({
    app: { isPackaged: true },
    updater,
    platform: "win32",
    environment: {},
    onStatus: status => statuses.push(status),
    setTimeout: callback => { timeouts.push(callback); return { unref() {} }; },
    setInterval: callback => { intervals.push(callback); return { unref() {} }; },
    clearTimeout() {},
    clearInterval() {}
  });

  assert.equal(controller.start(), true);
  assert.equal(updater.autoDownload, true);
  assert.equal(updater.autoInstallOnAppQuit, true);
  assert.equal(updater.allowPrerelease, false);
  assert.equal(updater.allowDowngrade, false);
  assert.equal(timeouts.length, 1);
  assert.equal(intervals.length, 1);

  await timeouts[0]();
  await intervals[0]();
  assert.equal(updater.checks, 2);
  updater.emit("update-available", { version: "1.2.0" });
  updater.emit("update-downloaded", { version: "1.2.0" });
  assert.deepEqual(statuses.slice(-2), [
    { state: "downloading", version: "1.2.0" },
    { state: "ready", version: "1.2.0" }
  ]);
});

test("portable builds stay manual-update only", () => {
  const updater = new FakeUpdater();
  const statuses = [];
  const controller = createAutoUpdateController({
    app: { isPackaged: true },
    updater,
    platform: "win32",
    environment: { PORTABLE_EXECUTABLE_FILE: "C:\\Apps\\Osmolog.exe" },
    onStatus: status => statuses.push(status)
  });

  assert.equal(controller.start(), false);
  assert.deepEqual(statuses, [{ state: "portable" }]);
  assert.equal(updater.checks, 0);
});
