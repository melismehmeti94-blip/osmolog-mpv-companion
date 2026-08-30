"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  MANAGED_HEADER,
  companionExecutablePath,
  installMpvAutoLauncher,
  launcherSource,
  launchArguments,
  removeMpvAutoLauncher
} = require("../src/mpv/auto-launch");

test("portable build uses its stable original executable instead of the temporary extraction path", () => {
  assert.equal(companionExecutablePath({
    environment: { PORTABLE_EXECUTABLE_FILE: "D:\\Apps\\Osmolog Companion.exe" },
    execPath: "C:\\Users\\Example\\AppData\\Local\\Temp\\temporary.exe"
  }), "D:\\Apps\\Osmolog Companion.exe");
});

test("MPV launcher starts the packaged companion as a detached subprocess", () => {
  const args = launchArguments({ execPath: "C:\\Program Files\\Osmolog\\Osmolog Companion.exe", packaged: true });
  const source = launcherSource(args);
  assert.deepEqual(args, ["C:\\Program Files\\Osmolog\\Osmolog Companion.exe", "--from-mpv"]);
  assert.match(source, /name = "subprocess"/);
  assert.match(source, /playback_only = false/);
  assert.match(source, /detach = true/);
  assert.match(source, /C:\/Program Files\/Osmolog\/Osmolog Companion\.exe/);
});

test("development launcher includes Electron's application path and preserves unrelated scripts", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "osmolog-mpv-launcher-"));
  try {
    const options = {
      environment: { APPDATA: temporary },
      execPath: "C:\\Electron\\electron.exe",
      appPath: "C:\\Code\\Osmolog Companion",
      packaged: false
    };
    const installed = installMpvAutoLauncher(options);
    assert.equal(installed.ok, process.platform === "win32");
    if (process.platform !== "win32") return;
    const source = fs.readFileSync(installed.file, "utf8");
    assert.ok(source.startsWith(MANAGED_HEADER));
    assert.match(source, /C:\/Electron\/electron\.exe/);
    assert.match(source, /C:\/Code\/Osmolog Companion/);

    fs.writeFileSync(installed.file, "-- user-owned script\n", "utf8");
    const conflict = installMpvAutoLauncher(options);
    assert.equal(conflict.ok, false);
    assert.equal(conflict.reason, "conflict");
    assert.equal(fs.readFileSync(installed.file, "utf8"), "-- user-owned script\n");
  } finally {
    const resolved = path.resolve(temporary);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(resolved, { recursive: true, force: true });
  }
});

test("portable MPV receives the launcher beside its executable", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "osmolog-portable-mpv-"));
  try {
    const executableDirectory = path.join(temporary, "mpv");
    fs.mkdirSync(path.join(executableDirectory, "portable_config"), { recursive: true });
    const installed = installMpvAutoLauncher({
      environment: { APPDATA: path.join(temporary, "AppData") },
      execPath: "C:\\Osmolog\\Companion.exe",
      packaged: true,
      mpvExecutableDirectory: executableDirectory
    });
    assert.equal(installed.ok, process.platform === "win32");
    if (process.platform === "win32") assert.equal(installed.file, path.join(executableDirectory, "portable_config", "scripts", "osmolog-companion.lua"));
  } finally {
    const resolved = path.resolve(temporary);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(resolved, { recursive: true, force: true });
  }
});

test("detected active MPV config directory wins and managed removal preserves foreign scripts", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "osmolog-detected-mpv-"));
  try {
    const activeConfig = path.join(temporary, "custom-mpv-home");
    const options = {
      environment: { APPDATA: path.join(temporary, "AppData") },
      execPath: "C:\\Osmolog\\Companion.exe",
      packaged: true,
      mpvConfigDirectory: activeConfig
    };
    const installed = installMpvAutoLauncher(options);
    assert.equal(installed.ok, process.platform === "win32");
    if (process.platform !== "win32") return;
    assert.equal(installed.file, path.join(activeConfig, "scripts", "osmolog-companion.lua"));

    const removed = removeMpvAutoLauncher(options);
    assert.equal(removed.ok, true);
    assert.equal(removed.removed, true);
    assert.equal(fs.existsSync(installed.file), false);

    fs.mkdirSync(path.dirname(installed.file), { recursive: true });
    fs.writeFileSync(installed.file, "-- user-owned script\n", "utf8");
    const conflict = removeMpvAutoLauncher(options);
    assert.equal(conflict.ok, false);
    assert.equal(conflict.reason, "conflict");
    assert.equal(fs.readFileSync(installed.file, "utf8"), "-- user-owned script\n");
  } finally {
    const resolved = path.resolve(temporary);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(resolved, { recursive: true, force: true });
  }
});
