"use strict";

const net = require("node:net");

class MockMpvServer {
  constructor(options = {}) {
    this.pipePath = options.pipePath || `\\\\.\\pipe\\osmolog-mpv-test-${process.pid}-${Date.now()}`;
    this.server = null;
    this.sockets = new Set();
    this.properties = {
      pause: false,
      "core-idle": false,
      "paused-for-cache": false,
      mute: false,
      volume: 100,
      speed: 1,
      path: "D:\\Media\\Japanese\\Example.mkv",
      filename: "[Group] Example (1080p) [HEVC].mkv",
      "media-title": "Example",
      "time-pos": 0,
      duration: 1440,
      "current-tracks/audio/lang": "jpn",
      "current-tracks/sub/lang": "eng",
      "sub-visibility": true,
      "track-list": [{ type: "video" }, { type: "audio", lang: "jpn" }],
      focused: true,
      "idle-active": false,
      "eof-reached": false,
      fullscreen: false,
      aid: 1,
      sid: 2,
      "osd-width": 1920,
      "osd-height": 1080,
      ...(options.properties || {})
    };
    this.commands = [];
    this.observers = new Map();
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer(socket => this.onConnection(socket));
      this.server.once("error", reject);
      this.server.listen(this.pipePath, resolve);
    });
  }

  onConnection(socket) {
    this.sockets.add(socket);
    socket.setEncoding("utf8");
    let buffer = "";
    socket.on("data", chunk => {
      buffer += chunk;
      for (;;) {
        const newline = buffer.indexOf("\n");
        if (newline < 0) break;
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) this.onCommand(socket, JSON.parse(line));
      }
    });
    socket.on("close", () => this.sockets.delete(socket));
  }

  onCommand(socket, message) {
    const command = message.command;
    this.commands.push(command);
    const name = Array.isArray(command) ? command[0] : command?.name;
    let data = null;
    let error = "success";
    if (name === "observe_property") {
      this.observers.set(command[2], command[1]);
      data = null;
    } else if (name === "get_property") {
      if (!Object.prototype.hasOwnProperty.call(this.properties, command[1])) error = "property unavailable";
      else data = this.properties[command[1]];
    }
    socket.write(`${JSON.stringify({ request_id: message.request_id, error, data })}\n`);
  }

  setProperty(name, data) {
    this.properties[name] = data;
    this.send({ event: "property-change", id: this.observers.get(name), name, data });
  }

  event(event, extra = {}) {
    this.send({ event, ...extra });
  }

  send(value) {
    for (const socket of this.sockets) socket.write(`${JSON.stringify(value)}\n`);
  }

  close() {
    for (const socket of this.sockets) socket.destroy();
    return new Promise(resolve => this.server?.close(resolve));
  }
}

module.exports = { MockMpvServer };
