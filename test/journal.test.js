"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PendingJournal } = require("../src/journal/journal");

function temporaryJournal() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "osmolog-journal-"));
  return { directory, file: path.join(directory, "pending.jsonl"), draftFile: path.join(directory, "active-segment.json") };
}

function event(id = "event-1") {
  return { eventId: id, segmentStartedAt: Date.now() - 1000, segmentEndedAt: Date.now(), realSeconds: 1 };
}

test("journal replays unacknowledged events exactly once", () => {
  const files = temporaryJournal();
  const first = new PendingJournal(files);
  first.open();
  assert.equal(first.append(event()), true);
  assert.equal(first.append(event()), false);
  const second = new PendingJournal(files);
  assert.equal(second.open().length, 1);
  assert.equal(second.acknowledge("event-1"), true);
  const third = new PendingJournal(files);
  assert.equal(third.open().length, 0);
});

test("an in-progress draft survives a hard-stop simulation", () => {
  const files = temporaryJournal();
  const first = new PendingJournal(files);
  first.open();
  first.saveDraft(event("draft-event"));
  const restarted = new PendingJournal(files);
  restarted.open();
  const recovered = restarted.consumeDraft();
  assert.equal(recovered.eventId, "draft-event");
  restarted.append(recovered);
  assert.equal(restarted.list().length, 1);
});
