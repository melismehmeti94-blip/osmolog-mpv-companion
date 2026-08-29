"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MANAGED_HEADER = "-- Osmolog Companion managed MPV launcher v1";
const SCRIPT_NAME = "osmolog-companion.lua";

function luaString(value) {
  return `"${String(value || "").replaceAll("\\", "/").replaceAll("\r", "").replaceAll("\n", "").replaceAll('"', '\\"')}"`;
}

function launchArguments({ execPath, appPath, packaged }) {
  const executable = String(execPath || "").trim();
  if (!executable) return [];
  if (packaged) return [executable, "--from-mpv"];
  const application = String(appPath || "").trim();
  return application ? [executable, application, "--from-mpv"] : [];
}

function launcherSource(argumentsList) {
  const args = argumentsList.map(luaString).join(", ");
  return `${MANAGED_HEADER}
local mp = require "mp"
local launched = false

local function launch_osmolog()
  if launched then return end
  launched = true
  mp.command_native_async({
    name = "subprocess",
    args = { ${args} },
    playback_only = false,
    detach = true
  }, function() end)
end

mp.add_timeout(0.1, launch_osmolog)
`;
}

function installMpvAutoLauncher(options = {}) {
  const environment = options.environment || process.env;
  const appData = String(environment.APPDATA || "").trim();
  const args = launchArguments(options);
  if (process.platform !== "win32" || !appData || !args.length) return { ok: false, reason: "unsupported" };

  const executableDirectory = String(options.mpvExecutableDirectory || "").trim();
  const portableConfig = executableDirectory ? path.join(executableDirectory, "portable_config") : "";
  const configDirectory = portableConfig && fs.existsSync(portableConfig) ? portableConfig : path.join(appData, "mpv");
  const directory = path.join(configDirectory, "scripts");
  const file = path.join(directory, SCRIPT_NAME);
  const source = launcherSource(args);
  let existing = "";
  try { existing = fs.readFileSync(file, "utf8"); }
  catch (error) { if (error.code !== "ENOENT") return { ok: false, reason: "read-failed", message: error.message, file }; }
  if (existing && !existing.startsWith(MANAGED_HEADER)) {
    return { ok: false, reason: "conflict", message: `${file} already exists and is not managed by Osmolog.`, file };
  }
  if (existing === source) return { ok: true, installed: false, file };
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(file, source, "utf8");
    return { ok: true, installed: true, file };
  } catch (error) {
    return { ok: false, reason: "write-failed", message: error.message, file };
  }
}

module.exports = { MANAGED_HEADER, SCRIPT_NAME, installMpvAutoLauncher, launcherSource, launchArguments, luaString };
