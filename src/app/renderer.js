"use strict";

const LANGUAGE_NAMES = { ja: "Japanese", en: "English", sv: "Swedish", es: "Spanish", fr: "French", de: "German", ko: "Korean", zh: "Chinese" };
const byId = id => document.getElementById(id);
let state = { ready: false };

function createPreviewBridge() {
  const preview = new URLSearchParams(location.search).get("preview");
  let previewState = {
    ready: true,
    mpvConnected: preview === "mpv" || preview === "tracking",
    paired: preview === "tracking",
    extensionConnected: preview === "tracking",
    playing: preview === "tracking",
    paused: false,
    fileLoaded: preview === "tracking",
    mode: preview === "tracking" ? "active" : "",
    title: preview === "tracking" ? "Frieren - 07" : "",
    languageCode: "ja",
    sessionSeconds: preview === "tracking" ? 305 : 0,
    sessionActiveSeconds: preview === "tracking" ? 245 : 0,
    sessionPassiveSeconds: preview === "tracking" ? 60 : 0,
    todaySeconds: preview === "tracking" ? 4825 : 0,
    speed: 1,
    pairingSeconds: preview === "tracking" ? 0 : 300,
    runOnlyWithMpv: false,
    autoLaunchStatus: "off",
    autoLaunchMessage: "Automatic MPV start is off.",
    pendingSegments: 0
  };
  const stateListeners = [];
  const modeListeners = [];
  const publish = () => stateListeners.forEach(listener => listener(previewState));
  return Object.freeze({
    getState: async () => previewState,
    onState: listener => stateListeners.push(listener),
    onWindowMode: listener => modeListeners.push(listener),
    windowAction: action => {
      if (action === "compact" || action === "expand") modeListeners.forEach(listener => listener(action === "compact" ? "compact" : "expanded"));
    },
    startPairing: async () => { previewState = { ...previewState, pairingSeconds: 60 }; publish(); return previewState; },
    setLanguage: async languageCode => { previewState = { ...previewState, languageCode }; publish(); return { ok: true, scope: previewState.fileLoaded ? "file" : "default" }; },
    setRunOnlyWithMpv: async enabled => {
      previewState = {
        ...previewState,
        runOnlyWithMpv: enabled,
        autoLaunchStatus: enabled ? "enabled" : "off",
        autoLaunchMessage: enabled ? "Companion will open and close with MPV." : "Automatic MPV start is off."
      };
      publish();
      return { ok: true, message: previewState.autoLaunchMessage, state: previewState };
    },
    syncNow: async () => ({ ok: true, message: "Everything is already synced." }),
    openDashboard: async () => false
  });
}

const companionApi = window.osmolog || createPreviewBridge();

function duration(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  if (value < 60) return `${value}s`;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function setupContent(current) {
  if (current.fatalError) return { eyebrow: "COMPANION ERROR", title: "Could not start", copy: current.fatalError, button: "Retry after restart", disabled: true };
  if (!current.ready) return { eyebrow: "GETTING READY", title: "Starting companion…", copy: "Opening the local tracker and crash-safe journal.", button: "Starting…", disabled: true };
  if (!current.extensionConnected) return current.paired ? {
    eyebrow: "OSMOLOG CONNECTION",
    title: "Reconnecting to Osmolog…",
    copy: "Keep the companion open. Osmolog reconnects in Chrome's background; the dashboard does not need to be open.",
    button: "",
    disabled: true
  } : {
    eyebrow: "FIRST-TIME CONNECTION",
    title: "Connect Osmolog once",
    copy: "Open Osmolog once and allow local companion access. After setup, the dashboard can stay closed.",
    button: "Open Osmolog",
    disabled: false
  };
  if (!current.mpvConnected) return {
    eyebrow: "MPV CONNECTION",
    title: "Connected — waiting for MPV",
    copy: "Start MPV with the Osmolog named-pipe setting.",
    button: "",
    disabled: true
  };
  return null;
}

function render(next) {
  state = next || state;
  const connected = state.extensionConnected === true;
  const status = byId("connectionStatus");
  status.className = `connection-status${connected ? " is-connected" : state.pairingSeconds ? " is-pairing" : ""}`;
  status.querySelector("b").textContent = connected ? "CONNECTED TO OSMOLOG" : state.pairingSeconds ? `NOT CONNECTED · READY TO PAIR` : "NOT CONNECTED";

  const setup = setupContent(state);
  byId("setupPanel").hidden = !setup;
  byId("trackingPanel").hidden = Boolean(setup);
  if (setup) {
    byId("setupEyebrow").textContent = setup.eyebrow;
    byId("setupTitle").textContent = setup.title;
    byId("setupCopy").textContent = setup.copy;
    byId("pairButton").textContent = setup.button;
    byId("pairButton").disabled = setup.disabled;
    byId("setupActions").hidden = !setup.button;
    if (connected) byId("setupFeedback").textContent = "";
  }

  const languageCode = state.languageCode || "ja";
  const languageName = LANGUAGE_NAMES[languageCode] || languageCode.toUpperCase();
  if (document.activeElement !== byId("languageSelect")) byId("languageSelect").value = languageCode;
  byId("mediaTitle").textContent = state.title || (state.fileLoaded ? "Local media" : "No media loaded");
  const playbackStatus = state.playing ? "Tracking now" : state.fileLoaded && state.paused ? "Playback paused" : "Ready to track";
  byId("modeLabel").textContent = playbackStatus;
  byId("modeDot").className = state.mode === "active" ? "is-active" : state.mode === "passive" ? "is-passive" : "";
  byId("fileTime").textContent = duration(state.sessionSeconds);
  byId("todayLabel").textContent = `OSMOLOG TODAY · ${languageCode.toUpperCase()}`;
  byId("todayLabel").title = `All Osmolog sources tracked today in ${languageName}`;
  byId("todayTime").textContent = duration(state.todaySeconds);
  byId("speedValue").textContent = `${Number(state.speed || 1).toFixed(1)}×`;
  byId("activeLabel").textContent = `Active ${duration(state.sessionActiveSeconds)}`;
  byId("passiveLabel").textContent = `Passive ${duration(state.sessionPassiveSeconds)}`;
  const total = Math.max(0, Number(state.sessionActiveSeconds) + Number(state.sessionPassiveSeconds));
  byId("activeTrack").style.width = `${total ? state.sessionActiveSeconds / total * 100 : 0}%`;
  byId("passiveTrack").style.width = `${total ? state.sessionPassiveSeconds / total * 100 : 0}%`;
  byId("footerStatus").textContent = state.pendingSegments
    ? `${state.pendingSegments} segment${state.pendingSegments === 1 ? "" : "s"} waiting for Osmolog. Closing keeps tracking.`
    : state.extensionConnected ? "Closing keeps tracking in the tray." : state.paired ? "Osmolog will reconnect automatically in the background." : "Open Osmolog once to finish the local connection.";
  byId("pairAgain").hidden = state.extensionConnected;

  const lifecycleToggle = byId("runOnlyWithMpvToggle");
  if (document.activeElement !== lifecycleToggle) lifecycleToggle.checked = state.runOnlyWithMpv === true;
  const autoLaunchLabels = { enabled: "Enabled", "needs-mpv": "Needs MPV", error: "Needs attention", off: "Off" };
  byId("autoLaunchStatus").textContent = autoLaunchLabels[state.autoLaunchStatus] || "Off";
  byId("autoLaunchStatus").title = state.autoLaunchMessage || "";
  byId("autoLaunchStatus").className = state.autoLaunchStatus === "enabled" ? "is-enabled" : state.autoLaunchStatus === "error" ? "is-error" : "";

  byId("compactTime").textContent = duration(state.sessionSeconds);
  byId("compactLanguage").textContent = languageName.toUpperCase();
  byId("compactDot").className = state.mode === "active" ? "is-active" : state.mode === "passive" ? "is-passive" : "";
}

byId("minimizeButton").addEventListener("click", () => companionApi.windowAction("compact"));
byId("closeButton").addEventListener("click", () => companionApi.windowAction("hide"));
const compactOverlay = byId("compactOverlay");
let compactDrag = null;
compactOverlay.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;
  compactDrag = { pointerId: event.pointerId, startX: event.screenX, startY: event.screenY, offsetX: event.clientX, offsetY: event.clientY, moved: false };
  compactOverlay.setPointerCapture(event.pointerId);
});
compactOverlay.addEventListener("pointermove", event => {
  if (!compactDrag || compactDrag.pointerId !== event.pointerId) return;
  if (Math.hypot(event.screenX - compactDrag.startX, event.screenY - compactDrag.startY) >= 3) compactDrag.moved = true;
  if (compactDrag.moved) void companionApi.windowAction("move", { x: event.screenX - compactDrag.offsetX, y: event.screenY - compactDrag.offsetY });
});
compactOverlay.addEventListener("pointerup", event => {
  if (!compactDrag || compactDrag.pointerId !== event.pointerId) return;
  const moved = compactDrag.moved;
  compactDrag = null;
  compactOverlay.releasePointerCapture(event.pointerId);
  if (!moved) void companionApi.windowAction("expand");
});
compactOverlay.addEventListener("pointercancel", () => { compactDrag = null; });
byId("pairButton").addEventListener("click", async () => {
  await companionApi.startPairing();
  const opened = await companionApi.openDashboard();
  byId("setupFeedback").textContent = opened
    ? "Osmolog opened. On first setup, select Connect MPV once if Chrome asks for local access."
    : "Could not open Chrome automatically. Open Osmolog, then select Connect MPV once if Chrome asks for local access.";
});
byId("pairAgain").addEventListener("click", async () => {
  await companionApi.startPairing();
  byId("setupFeedback").textContent = "Pairing is ready. Open Osmolog in Chrome once to finish reconnecting.";
});
byId("languageSelect").addEventListener("change", async event => {
  const result = await companionApi.setLanguage(event.target.value);
  byId("footerStatus").textContent = result.scope === "file-and-default"
    ? "Language changed and saved for future MPV sessions."
    : "Default language saved for future MPV sessions.";
});
byId("openDashboard").addEventListener("click", async () => {
  const opened = await companionApi.openDashboard();
  if (!opened) byId("footerStatus").textContent = "Open Osmolog in Chrome to view the dashboard.";
});
byId("runOnlyWithMpvToggle").addEventListener("change", async event => {
  const toggle = event.currentTarget;
  toggle.disabled = true;
  byId("lifecycleFeedback").textContent = toggle.checked ? "Setting up MPV auto-start…" : "Removing MPV auto-start…";
  const result = await companionApi.setRunOnlyWithMpv(toggle.checked);
  byId("lifecycleFeedback").textContent = result?.message || (result?.ok ? "Lifecycle setting updated." : "Could not update this setting.");
  if (!result?.ok) toggle.checked = state.runOnlyWithMpv === true;
  toggle.disabled = false;
});
byId("syncNowButton").addEventListener("click", async event => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "Syncing…";
  byId("lifecycleFeedback").textContent = "Connecting to Osmolog…";
  const result = await companionApi.syncNow();
  byId("lifecycleFeedback").textContent = result?.message || "Could not sync right now.";
  button.textContent = "Sync now";
  button.disabled = false;
});

companionApi.onState(render);
companionApi.onWindowMode(mode => byId("appShell").dataset.mode = mode);
companionApi.getState().then(render);
