"use strict";

const LANGUAGE_NAMES = Object.freeze({ ja: "Japanese", en: "English", sv: "Swedish", es: "Spanish", fr: "French", de: "German", ko: "Korean", zh: "Chinese" });
const OVERLAY_ID = 47823;

function duration(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}` : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function assEscape(value) {
  return String(value || "").replace(/[{}\\]/g, character => `\\${character}`);
}

class MpvOverlay {
  constructor(client, options = {}) {
    this.client = client;
    this.logger = options.logger || console;
    this.config = options.config;
    this.persistent = this.config.overlay.persistent === true;
    this.todayTotals = new Map();
    this.lastSnapshot = null;
  }

  updateConfig(config) {
    this.config = config;
    this.persistent = config.overlay.persistent === true;
    if (!this.persistent) void this.remove();
  }

  async installToggle() {
    await this.client.command(["define-section", "osmolog-companion", "Shift+o script-message osmolog-toggle", "force"]);
    await this.client.command(["enable-section", "osmolog-companion", "allow-hide-cursor+allow-vo-dragging"]);
  }

  handleClientMessage(message) {
    if (!Array.isArray(message.args) || message.args[0] !== "osmolog-toggle") return false;
    this.persistent = !this.persistent;
    if (this.persistent && this.lastSnapshot) void this.render(this.lastSnapshot);
    else void this.remove();
    void this.client.command(["show-text", `Osmolog readout ${this.persistent ? "on" : "off"}`, 1500]).catch(() => null);
    return true;
  }

  async toast(snapshot) {
    if (!this.config.overlay.toastOnLoad) return;
    const code = snapshot.languageCode;
    const text = code
      ? `Osmolog · ${LANGUAGE_NAMES[code] || code.toUpperCase()} · tracking`
      : "Osmolog · language not set · will ask later";
    await this.client.command(["show-text", text, 3000]).catch(() => null);
  }

  setTodayTotal(languageCode, seconds) {
    if (languageCode) this.todayTotals.set(languageCode, Math.max(0, Number(seconds) || 0));
    if (this.lastSnapshot) void this.render(this.lastSnapshot);
  }

  async render(snapshot) {
    this.lastSnapshot = snapshot;
    if (!this.persistent || !snapshot?.playing || !snapshot.languageCode) return this.remove();
    const symbol = snapshot.mode === "active" ? "●" : "○";
    const today = this.todayTotals.get(snapshot.languageCode);
    const suffix = Number.isFinite(today) ? `  ·  today ${duration(today)}` : "";
    const text = `${symbol} ${snapshot.languageCode.toUpperCase()}  ${duration(snapshot.sessionSeconds)}${suffix}`;
    const data = `{\\an3\\pos(1890,1045)\\fs22\\alpha&H4D&}${assEscape(text)}`;
    await this.client.command({ name: "osd-overlay", id: OVERLAY_ID, format: "ass-events", data, res_x: 1920, res_y: 1080, z: 10 })
      .catch(error => this.logger.warn(`Could not update mpv OSD: ${error.message}`));
  }

  async remove() {
    if (!this.client.connected) return;
    await this.client.command({ name: "osd-overlay", id: OVERLAY_ID, format: "none", data: "" }).catch(() => null);
  }
}

module.exports = { MpvOverlay, OVERLAY_ID, duration };
