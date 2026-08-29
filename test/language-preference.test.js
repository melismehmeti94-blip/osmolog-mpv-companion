"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { CompanionService } = require("../src/service");

test("a language chosen during playback becomes the next-session default", () => {
  let currentLanguage = "ja";
  const configStore = {
    update(patch) { return { defaultLanguage: patch.defaultLanguage, extensionId: "PUT_EXTENSION_ID_HERE", port: 47823 }; }
  };
  const service = new CompanionService({ configStore });
  service.config = { defaultLanguage: "ja", extensionId: "PUT_EXTENSION_ID_HERE", port: 47823 };
  service.tracker = {
    fileLoaded: true,
    properties: {},
    setLanguageOverride(languageCode) { currentLanguage = languageCode; return true; },
    snapshot() { return { languageCode: currentLanguage }; }
  };

  const result = service.setLanguage("en");
  assert.equal(result.ok, true);
  assert.equal(result.scope, "file-and-default");
  assert.equal(service.config.defaultLanguage, "en");
  assert.equal(result.state.languageCode, "en");
});
