"use strict";

const STARTUP_CHECK_DELAY_MS = 10_000;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function isPortableBuild(environment = process.env) {
  return Boolean(String(environment.PORTABLE_EXECUTABLE_FILE || "").trim());
}

function shouldEnableAutoUpdates(options = {}) {
  const platform = options.platform || process.platform;
  const app = options.app;
  return platform === "win32" && app?.isPackaged === true && !isPortableBuild(options.environment);
}

function createAutoUpdateController(options = {}) {
  const app = options.app;
  const updater = options.updater;
  const logger = options.logger || console;
  const onStatus = typeof options.onStatus === "function" ? options.onStatus : () => {};
  const scheduleTimeout = options.setTimeout || setTimeout;
  const scheduleInterval = options.setInterval || setInterval;
  const cancelTimeout = options.clearTimeout || clearTimeout;
  const cancelInterval = options.clearInterval || clearInterval;
  const startupDelayMs = Math.max(0, Number(options.startupDelayMs) || STARTUP_CHECK_DELAY_MS);
  const intervalMs = Math.max(60_000, Number(options.intervalMs) || UPDATE_CHECK_INTERVAL_MS);
  let startupTimer = null;
  let intervalTimer = null;
  let checking = false;
  let started = false;

  const publish = (state, details = {}) => onStatus({ state, ...details });

  async function check() {
    if (!started || checking) return false;
    checking = true;
    try {
      await updater.checkForUpdates();
      return true;
    } catch (error) {
      const message = String(error?.message || error || "Update check failed.");
      logger.warn?.(`Automatic update check failed: ${message}`);
      publish("error", { message });
      return false;
    } finally {
      checking = false;
    }
  }

  function start() {
    if (started) return true;
    if (!shouldEnableAutoUpdates({ app, environment: options.environment, platform: options.platform })) {
      publish(isPortableBuild(options.environment) ? "portable" : "disabled");
      return false;
    }
    if (!updater || typeof updater.checkForUpdates !== "function") {
      publish("error", { message: "The automatic updater is unavailable." });
      return false;
    }

    started = true;
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.on("checking-for-update", () => publish("checking"));
    updater.on("update-available", info => publish("downloading", { version: String(info?.version || "") }));
    updater.on("update-not-available", () => publish("current"));
    updater.on("update-downloaded", info => {
      const version = String(info?.version || "");
      logger.info?.(`Companion ${version || "update"} downloaded; it will install after exit.`);
      publish("ready", { version });
    });
    updater.on("error", error => {
      const message = String(error?.message || error || "Update check failed.");
      logger.warn?.(`Automatic updater error: ${message}`);
      publish("error", { message });
    });
    publish("idle");

    startupTimer = scheduleTimeout(() => void check(), startupDelayMs);
    startupTimer?.unref?.();
    intervalTimer = scheduleInterval(() => void check(), intervalMs);
    intervalTimer?.unref?.();
    return true;
  }

  function stop() {
    started = false;
    if (startupTimer) cancelTimeout(startupTimer);
    if (intervalTimer) cancelInterval(intervalTimer);
    startupTimer = null;
    intervalTimer = null;
  }

  return Object.freeze({ check, start, stop });
}

module.exports = {
  STARTUP_CHECK_DELAY_MS,
  UPDATE_CHECK_INTERVAL_MS,
  createAutoUpdateController,
  isPortableBuild,
  shouldEnableAutoUpdates
};
