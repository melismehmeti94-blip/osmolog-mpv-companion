"use strict";

async function syncWithChrome(options = {}) {
  const service = options.service;
  if (!service) return { ok: false, openedChrome: false, message: "Companion is still starting." };

  const waitForConnection = options.waitForConnection || (async () => false);
  const waitForAcks = options.waitForAcks || (async () => false);
  let result = service.syncPending();
  let openedChrome = false;
  let chromeWasRunning = true;

  if (!result.connected) {
    chromeWasRunning = await options.isChromeRunning();
    if (!chromeWasRunning) {
      service.startPairing();
      openedChrome = options.launchChrome(service.dashboardUrl("settings"));
    }
    if (!await waitForConnection()) {
      return {
        ok: false,
        openedChrome,
        message: chromeWasRunning
          ? "Chrome is open, but Osmolog has not connected yet. Open Osmolog once, then try again."
          : openedChrome
            ? "Osmolog opened in Chrome. Finish pairing, then select Sync now again."
            : "Could not open Chrome. Open Osmolog once, then try again."
      };
    }
    result = service.syncPending();
  }

  if (!result.pending) return { ok: true, openedChrome, message: "Everything is already synced." };
  const acknowledged = await waitForAcks();
  return acknowledged
    ? { ok: true, openedChrome, message: "Queued MPV activity synced with Osmolog." }
    : { ok: false, openedChrome, message: "Osmolog is connected, but some activity is still queued. Try again shortly." };
}

module.exports = { syncWithChrome };
