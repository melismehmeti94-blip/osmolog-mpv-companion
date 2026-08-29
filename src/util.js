"use strict";

const crypto = require("node:crypto");

function clamp(value, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : minimum;
}

function localDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function uuid() {
  return crypto.randomUUID();
}

function languageCode(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/_/g, "-");
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(normalized) ? normalized.slice(0, 24) : null;
}

function cleanTitle(filename, mediaTitle) {
  const candidate = String(filename || mediaTitle || "").split(/[\\/]/).pop() || "";
  return candidate
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/\[[^\]]*(?:1080|720|2160|480|hevc|x26[45]|av1|aac|flac|opus|web[- ]?dl|bluray|bdrip|[a-f0-9]{8})[^\]]*\]/gi, "")
    .replace(/\([^)]*(?:1080|720|2160|480|hevc|x26[45]|av1|web[- ]?dl|bluray|bdrip)[^)]*\)/gi, "")
    .replace(/^\s*\[[^\]]{1,40}\]\s*/, "")
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || "Local media";
}

function monotonicNow() {
  return process.hrtime.bigint();
}

function monotonicSeconds(later, earlier) {
  if (typeof later !== "bigint" || typeof earlier !== "bigint" || later <= earlier) return 0;
  return Number(later - earlier) / 1e9;
}

module.exports = { clamp, cleanTitle, languageCode, localDateKey, monotonicNow, monotonicSeconds, uuid };
