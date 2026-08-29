"use strict";

const net = require("node:net");
const EventEmitter = require("node:events");

const PIPE_PATH = "\\\\.\\pipe\\osmolog-mpv";
const OBSERVED_PROPERTIES = Object.freeze([
  "pause", "core-idle", "paused-for-cache", "mute", "volume", "speed", "path", "filename",
  "media-title", "time-pos", "duration", "sub-visibility", "track-list", "focused", "idle-active",
  "eof-reached", "fullscreen", "aid", "sid", "osd-width", "osd-height"
]);
const TRACK_LANGUAGE_PROPERTIES = Object.freeze(["current-tracks/audio/lang", "current-tracks/sub/lang"]);

class MpvIpcClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.pipePath = options.pipePath || PIPE_PATH;
    this.net = options.net || net;
    this.logger = options.logger || console;
    this.socket = null;
    this.buffer = "";
    this.connected = false;
    this.stopped = false;
    this.reconnectDelay = 1000;
    this.reconnectTimer = null;
    this.requestId = 1;
    this.pending = new Map();
    this.properties = {};
    this.focusSupported = null;
  }

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    this.socket?.destroy();
    this.socket = null;
  }

  connect() {
    if (this.stopped || this.socket) return;
    const socket = this.net.connect({ path: this.pipePath });
    this.socket = socket;
    socket.setEncoding("utf8");
    socket.on("connect", () => this.onConnect());
    socket.on("data", chunk => this.onData(chunk));
    socket.on("error", error => this.emit("connection-error", error));
    socket.on("close", () => this.onClose());
  }

  async onConnect() {
    this.connected = true;
    this.reconnectDelay = 1000;
    this.emit("connected");
    try {
      let observerId = 1;
      for (const property of OBSERVED_PROPERTIES) {
        await this.command(["observe_property", observerId++, property]);
      }
      for (const property of TRACK_LANGUAGE_PROPERTIES) await this.refreshProperty(property);
      const executableDirectory = await this.command(["expand-path", "~~exe_dir/"]).catch(() => "");
      if (executableDirectory) this.emit("executable-directory", executableDirectory);
      const focused = await this.getProperty("focused").catch(() => null);
      this.focusSupported = typeof focused === "boolean";
      this.emit("focus-support", this.focusSupported);
      const snapshot = await this.refreshFileSnapshot();
      if (snapshot.path) this.emit("file-loaded", snapshot);
    } catch (error) {
      this.logger.warn(`Could not initialise mpv observation: ${error.message}`);
    }
  }

  onClose() {
    this.connected = false;
    this.socket = null;
    for (const { reject } of this.pending.values()) reject(new Error("mpv disconnected"));
    this.pending.clear();
    this.emit("disconnected");
    if (this.stopped) return;
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(30000, this.reconnectDelay * 2);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  onData(chunk) {
    this.buffer += chunk;
    for (;;) {
      const newline = this.buffer.indexOf("\n");
      if (newline < 0) break;
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      try { this.onMessage(JSON.parse(line)); }
      catch { this.emit("protocol-warning", "mpv sent invalid JSON"); }
    }
  }

  onMessage(message) {
    if (message.request_id && this.pending.has(message.request_id)) {
      const pending = this.pending.get(message.request_id);
      this.pending.delete(message.request_id);
      if (message.error && message.error !== "success") pending.reject(new Error(message.error));
      else pending.resolve(message.data);
      return;
    }
    if (message.event === "property-change" && message.name) {
      this.properties[message.name] = message.data;
      this.emit("property", message.name, message.data);
      if (message.name === "aid" || message.name === "sid") {
        for (const property of TRACK_LANGUAGE_PROPERTIES) void this.refreshProperty(property);
      }
      return;
    }
    if (message.event === "file-loaded") {
      void this.refreshFileSnapshot().then(snapshot => this.emit("file-loaded", snapshot));
      return;
    }
    if (["end-file", "playback-restart", "seek", "shutdown", "client-message"].includes(message.event)) {
      this.emit(message.event, message);
    }
  }

  send(payload) {
    if (!this.socket || !this.connected) return false;
    this.socket.write(`${JSON.stringify(payload)}\n`);
    return true;
  }

  command(command) {
    if (!this.connected) return Promise.reject(new Error("mpv is not connected"));
    const requestId = this.requestId++;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      if (!this.send({ command, request_id: requestId })) {
        this.pending.delete(requestId);
        reject(new Error("mpv is not connected"));
      }
      setTimeout(() => {
        if (!this.pending.has(requestId)) return;
        this.pending.delete(requestId);
        reject(new Error("mpv command timed out"));
      }, 5000).unref?.();
    });
  }

  async getProperty(name) {
    return this.command(["get_property", name]);
  }

  async refreshProperty(name) {
    const value = await this.getProperty(name).catch(() => null);
    this.properties[name] = value;
    this.emit("property", name, value);
    return value;
  }

  async refreshFileSnapshot() {
    const names = [...OBSERVED_PROPERTIES, ...TRACK_LANGUAGE_PROPERTIES];
    await Promise.all(names.map(name => this.refreshProperty(name)));
    return {
      path: this.properties.path,
      filename: this.properties.filename,
      mediaTitle: this.properties["media-title"],
      properties: { ...this.properties }
    };
  }
}

module.exports = { MpvIpcClient, OBSERVED_PROPERTIES, PIPE_PATH, TRACK_LANGUAGE_PROPERTIES };
