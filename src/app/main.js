"use strict";

const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");
const { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } = require("electron");
const { CompanionService } = require("../service");
const { installMpvAutoLauncher } = require("../mpv/auto-launch");

let mainWindow = null;
let tray = null;
let service = null;
let quitting = false;
let expandedBounds = null;
let compactBounds = null;
let windowMode = "expanded";
let hiddenForFullscreen = false;
let latestState = { ready: false };
let launcherOptions = null;

if (!app.requestSingleInstanceLock()) app.quit();

function sendState(state = latestState) {
  latestState = state;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("companion-state", state);
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (state.fullscreen && mainWindow.isVisible()) {
    hiddenForFullscreen = true;
    mainWindow.hide();
  } else if (!state.fullscreen && hiddenForFullscreen) {
    hiddenForFullscreen = false;
    mainWindow.showInactive();
  }
}

function showExpanded() {
  if (!mainWindow) return;
  const current = mainWindow.getBounds();
  if (windowMode === "compact") compactBounds = current;
  else expandedBounds = current;
  windowMode = "expanded";
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setResizable(false);
  mainWindow.setBounds(expandedBounds || { x: current.x, y: current.y, width: 620, height: 470 }, true);
  mainWindow.webContents.send("window-mode", "expanded");
  if (latestState.fullscreen) {
    hiddenForFullscreen = true;
    mainWindow.hide();
    return;
  }
  mainWindow.show();
  mainWindow.focus();
}

function showCompact() {
  if (!mainWindow) return;
  const current = mainWindow.getBounds();
  if (windowMode === "expanded") expandedBounds = current;
  windowMode = "compact";
  const bounds = compactBounds || { x: current.x, y: current.y, width: 156, height: 42 };
  mainWindow.setResizable(false);
  mainWindow.setBounds({ ...bounds, width: 156, height: 42 }, true);
  mainWindow.setAlwaysOnTop(true, "floating");
  mainWindow.webContents.send("window-mode", "compact");
  if (latestState.fullscreen) {
    hiddenForFullscreen = true;
    mainWindow.hide();
    return;
  }
  mainWindow.show();
}

function hideToTray() {
  hiddenForFullscreen = false;
  mainWindow?.hide();
}

function findChromeExecutable(environment = process.env) {
  if (process.platform !== "win32") return "";
  const candidates = [environment.PROGRAMFILES, environment["PROGRAMFILES(X86)"], environment.LOCALAPPDATA]
    .filter(Boolean)
    .map(root => path.join(root, "Google", "Chrome", "Application", "chrome.exe"));
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || "";
}

function launchChromeDashboard(url, environment = process.env) {
  const executable = findChromeExecutable(environment);
  if (!executable || !/^chrome-extension:\/\/[a-p]{32}\//i.test(String(url || ""))) return false;
  try {
    const child = childProcess.spawn(executable, [url], { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function openDashboard() {
  if (!service) return false;
  if (service.openDashboard("settings")) return true;
  service.startPairing();
  return launchChromeDashboard(service.dashboardUrl("settings"));
}

async function quitCompanion() {
  if (quitting) return;
  quitting = true;
  await service?.shutdown("app quit");
  app.quit();
}

function createTray() {
  const source = path.join(__dirname, "../../assets/icon-32.png");
  const icon = nativeImage.createFromPath(source).resize({ width: 18, height: 18 });
  tray = new Tray(icon);
  tray.setToolTip("Osmolog Companion");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open mini window", click: showExpanded },
    { label: "Open Osmolog dashboard", click: () => openDashboard() },
    { type: "separator" },
    { label: "Quit companion", click: () => void quitCompanion() }
  ]));
  tray.on("double-click", showExpanded);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 620,
    height: 470,
    minWidth: 156,
    minHeight: 42,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    roundedCorners: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.once("ready-to-show", () => {
    expandedBounds = mainWindow.getBounds();
    if (latestState.fullscreen) hiddenForFullscreen = true;
    else mainWindow.show();
    sendState();
  });
  mainWindow.on("close", event => {
    if (quitting) return;
    event.preventDefault();
    hideToTray();
  });
}

function registerIpc() {
  ipcMain.handle("get-state", () => latestState);
  ipcMain.handle("window-action", (_event, action, details = {}) => {
    if (action === "compact") showCompact();
    if (action === "expand") showExpanded();
    if (action === "hide") hideToTray();
    if (action === "quit") void quitCompanion();
    if (action === "move" && windowMode === "compact" && Number.isFinite(details.x) && Number.isFinite(details.y)) {
      const x = Math.round(details.x);
      const y = Math.round(details.y);
      mainWindow.setPosition(x, y, false);
      compactBounds = { ...mainWindow.getBounds(), x, y, width: 156, height: 42 };
    }
    return true;
  });
  ipcMain.handle("start-pairing", () => service.startPairing());
  ipcMain.handle("set-extension-id", (_event, extensionId) => service.setExtensionId(extensionId));
  ipcMain.handle("set-language", (_event, languageCode) => service.setLanguage(languageCode));
  ipcMain.handle("open-dashboard", () => openDashboard());
}

app.on("second-instance", () => showExpanded());
app.on("window-all-closed", () => {});
app.on("before-quit", event => {
  if (!quitting) {
    event.preventDefault();
    void quitCompanion();
  }
});

app.whenReady().then(async () => {
  app.setAppUserModelId("com.osmolog.mpv-companion");
  registerIpc();
  createWindow();
  createTray();
  service = new CompanionService();
  service.on("state", sendState);
  service.on("log", entry => mainWindow?.webContents.send("companion-log", entry));
  launcherOptions = {
    environment: process.env,
    execPath: process.execPath,
    appPath: app.getAppPath(),
    packaged: app.isPackaged
  };
  service.on("mpv-executable-directory", directory => {
    const portableLauncher = installMpvAutoLauncher({ ...launcherOptions, mpvExecutableDirectory: directory });
    if (!portableLauncher.ok && portableLauncher.reason !== "unsupported") {
      service.logger.warn(portableLauncher.message || "Could not install the portable MPV startup launcher.");
    }
  });
  const launcher = installMpvAutoLauncher(launcherOptions);
  if (!launcher.ok && launcher.reason !== "unsupported") {
    service.logger.warn(launcher.message || "Could not install the MPV startup launcher.");
  }
  await service.start();
  sendState(service.publicState());
}).catch(async error => {
  await service?.shutdown("startup error").catch(() => null);
  latestState = { ready: false, fatalError: String(error?.message || error) };
  sendState(latestState);
});

module.exports = { findChromeExecutable, launchChromeDashboard };
