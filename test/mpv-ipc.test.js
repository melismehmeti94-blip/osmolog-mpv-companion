"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { MpvIpcClient, OBSERVED_PROPERTIES } = require("../src/mpv/ipc-client");
const { MockMpvServer } = require("./mock-mpv");

test("real IPC client observes the verified mpv contract and refreshes track languages", async t => {
  const server = new MockMpvServer();
  await server.start();
  t.after(() => server.close());
  const client = new MpvIpcClient({ pipePath: server.pipePath, logger: { warn() {} } });
  t.after(() => client.stop());
  const loaded = once(client, "file-loaded");
  client.start();
  const [snapshot] = await loaded;
  assert.equal(snapshot.properties["current-tracks/audio/lang"], "jpn");
  assert.equal(snapshot.properties["current-tracks/sub/lang"], "eng");
  const observed = new Set(server.commands.filter(Array.isArray).filter(command => command[0] === "observe_property").map(command => command[2]));
  for (const property of OBSERVED_PROPERTIES) assert.ok(observed.has(property), `${property} should be observed`);
  const change = once(client, "property");
  server.setProperty("pause", true);
  const [name, value] = await change;
  assert.equal(name, "pause");
  assert.equal(value, true);
});
