"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

class PendingJournal {
  constructor(options = {}) {
    this.file = options.file;
    this.draftFile = options.draftFile || path.join(path.dirname(this.file), "active-segment.json");
    this.maxBytes = options.maxBytes || MAX_BYTES;
    this.maxAgeMs = options.maxAgeMs || MAX_AGE_MS;
    this.now = options.now || Date.now;
    this.pending = new Map();
    this.onWarning = options.onWarning || (() => {});
  }

  open() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    if (!fs.existsSync(this.file)) fs.writeFileSync(this.file, "");
    const acknowledged = new Set();
    const segments = new Map();
    for (const line of fs.readFileSync(this.file, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.op === "segment" && entry.event?.eventId) segments.set(entry.event.eventId, entry.event);
        if (entry.op === "ack" && entry.eventId) acknowledged.add(entry.eventId);
      } catch {
        this.onWarning("Skipped a damaged line in pending.jsonl.");
      }
    }
    const cutoff = this.now() - this.maxAgeMs;
    for (const [id, event] of segments) {
      if (!acknowledged.has(id) && Number(event.segmentEndedAt) >= cutoff) this.pending.set(id, event);
    }
    this.compact();
    return this.list();
  }

  append(event) {
    if (!event?.eventId || this.pending.has(event.eventId)) return false;
    fs.appendFileSync(this.file, `${JSON.stringify({ op: "segment", event })}\n`);
    this.pending.set(event.eventId, event);
    this.enforceCap();
    return true;
  }

  acknowledge(eventId) {
    if (!this.pending.has(eventId)) return false;
    fs.appendFileSync(this.file, `${JSON.stringify({ op: "ack", eventId })}\n`);
    this.pending.delete(eventId);
    if (!this.pending.size) this.compact();
    return true;
  }

  list() {
    return [...this.pending.values()].sort((a, b) => a.segmentStartedAt - b.segmentStartedAt);
  }

  compact() {
    const body = this.list().map(event => JSON.stringify({ op: "segment", event })).join("\n");
    const temporary = `${this.file}.tmp`;
    fs.writeFileSync(temporary, body ? `${body}\n` : "");
    fs.renameSync(temporary, this.file);
  }

  enforceCap() {
    if (fs.statSync(this.file).size <= this.maxBytes) return;
    const ordered = this.list();
    while (ordered.length && Buffer.byteLength(ordered.map(event => JSON.stringify({ op: "segment", event })).join("\n")) > this.maxBytes) {
      const removed = ordered.shift();
      this.pending.delete(removed.eventId);
    }
    this.onWarning("The pending journal reached 10 MB; its oldest unacknowledged events were removed.");
    this.compact();
  }

  saveDraft(draft) {
    if (!draft) return this.clearDraft();
    const temporary = `${this.draftFile}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(draft));
    fs.renameSync(temporary, this.draftFile);
  }

  consumeDraft() {
    if (!fs.existsSync(this.draftFile)) return null;
    try {
      const value = JSON.parse(fs.readFileSync(this.draftFile, "utf8"));
      fs.unlinkSync(this.draftFile);
      return value;
    } catch {
      this.clearDraft();
      return null;
    }
  }

  clearDraft() {
    try { fs.unlinkSync(this.draftFile); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

module.exports = { MAX_AGE_MS, MAX_BYTES, PendingJournal };
