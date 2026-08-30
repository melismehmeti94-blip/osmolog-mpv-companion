"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const output = path.resolve(process.argv[2] || path.join(__dirname, "companion-ui-preview.png"));

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 620,
    height: 540,
    x: 100,
    y: 100,
    show: true,
    frame: false,
    transparent: true,
    resizable: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  await window.loadFile(path.join(__dirname, "../src/app/index.html"), { query: { preview: "tracking" } });
  await new Promise(resolve => setTimeout(resolve, 500));
  const image = await window.webContents.capturePage();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, image.toPNG());
  app.quit();
}).catch(error => {
  console.error(error);
  app.exit(1);
});
