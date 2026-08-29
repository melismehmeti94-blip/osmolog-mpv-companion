"use strict";

const path = require("node:path");
const { languageCode } = require("../util");

function normalizedWindowsPath(value) {
  return path.win32.normalize(String(value || "").trim()).replace(/[\\/]+$/, "").toLowerCase();
}

function isPrefixPath(filePath, prefix) {
  return filePath === prefix || filePath.startsWith(`${prefix}\\`);
}

function resolveLanguage(filePath, config) {
  const target = normalizedWindowsPath(filePath);
  const matches = (config?.folderRules || [])
    .map(rule => ({ prefix: normalizedWindowsPath(rule.match), language: languageCode(rule.language) }))
    .filter(rule => rule.prefix && rule.language && isPrefixPath(target, rule.prefix))
    .sort((left, right) => right.prefix.length - left.prefix.length);
  if (matches[0]) return { languageCode: matches[0].language, languageSource: "folderRule" };
  const fallback = languageCode(config?.defaultLanguage);
  if (fallback) return { languageCode: fallback, languageSource: "default" };
  return { languageCode: null, languageSource: "unassigned" };
}

module.exports = { normalizedWindowsPath, resolveLanguage };
