const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

const BASE = "/api/weddings/wedding-1/timeline";

describe("timeline CRUD", () => {
  let server;
  let db;

  beforeEach(async () => {
    const app = await createTestServer({
      weddings: [
        {
          id: "wedding-1",
          partner_a_name: "Ala",
          partner_b_name: "Jan",
          wedding_date: "2026-07-25",
          ceremony_location: null,
          created_by_user_id: "user-a",
        },
      ],
    });
    db = app.db;
    server = app.server;
  });

  afterEach(async () => {
    if (server) await close(server);
    clearAppCache();
  });

  it("GET returns a synthetic empty timeline without creating a row", async () => {
    const response = await request(server, "GET", BASE);

    assert.equal(response.status, 200);
    assert.equal(response.body.id, null);
    assert.equal(response.body.weddingId, "wedding-1");
    assert.deepEqual(response.body.genrePreferences, []);
    assert.deepEqual(response.body.musicPerStage, {});
    assert.deepEqual(response.body.events, []);
    assert.deepEqual(response.body.mustPlay, []);
    assert.deepEqual(response.body.doNotPlay, []);
    assert.equal(db.wedding_timeline.length, 0, "GET must not persist a row");
  });

  it("PATCH lazy-creates the row on first write and persists fields", async () => {
    const response = await request(server, "PATCH", BASE, {
      ceremonyType: "koscielny",
      ceremonyTime: "14:30",
      genrePreferences: ["disco_polo", "biesiada"],
      musicPerStage: { wejscie: "Marsz weselny" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.ceremonyType, "koscielny");
    assert.equal(response.body.ceremonyTime, "14:30");
    assert.deepEqual(response.body.genrePreferences, ["disco_polo", "biesiada"]);
    assert.deepEqual(response.body.musicPerStage, { wejscie: "Marsz weselny" });
    assert.equal(db.wedding_timeline.length, 1);
    assert.equal(db.wedding_timeline[0].wedding_id, "wedding-1");
  });

  it("PATCH with no recognized fields returns 400", async () => {
    const response = await request(server, "PATCH", BASE, { unknown: "x" });
    assert.equal(response.status, 400);
  });

  it("truncates Postgres time 'HH:MM:SS' to 'HH:MM' on read (round-trip safety)", async () => {
    db.wedding_timeline.push({
      id: "timeline-1",
      wedding_id: "wedding-1",
      ceremony_time: "14:30:00",
      genre_preferences: [],
      music_per_stage: {},
    });

    const read = await request(server, "GET", BASE);
    assert.equal(read.body.ceremonyTime, "14:30");

    // Re-PATCHing the value returned by GET must not 400.
    const rePatch = await request(server, "PATCH", BASE, { ceremonyTime: "14:30" });
    assert.equal(rePatch.status, 200);
    assert.equal(rePatch.body.ceremonyTime, "14:30");
  });

  it("rejects malformed HH:MM times", async () => {
    const badField = await request(server, "PATCH", BASE, { ceremonyTime: "25:00" });
    assert.equal(badField.status, 400);

    const badEvent = await request(server, "POST", `${BASE}/events`, {
      label: "Obiad",
      eventTime: "12:60",
    });
    assert.equal(badEvent.status, 400);
  });

  it("creates, updates and deletes events", async () => {
    const created = await request(server, "POST", `${BASE}/events`, {
      label: "Pierwszy taniec",
      eventTime: "20:00",
      sortOrder: 5,
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.label, "Pierwszy taniec");
    assert.equal(created.body.eventTime, "20:00");

    const id = created.body.id;
    const patched = await request(server, "PATCH", `${BASE}/events/${id}`, { eventTime: "20:15" });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.eventTime, "20:15");

    const removed = await request(server, "DELETE", `${BASE}/events/${id}`);
    assert.equal(removed.status, 204);
    assert.equal(db.timeline_events.length, 0);
  });

  it("seeds the DJ template only when the list is empty (idempotent)", async () => {
    const first = await request(server, "POST", `${BASE}/events/seed-template`);
    assert.equal(first.status, 201);
    assert.equal(first.body.length, 14);
    assert.equal(db.timeline_events.length, 14);

    const second = await request(server, "POST", `${BASE}/events/seed-template`);
    assert.equal(second.status, 200);
    assert.equal(second.body.length, 14);
    assert.equal(db.timeline_events.length, 14, "re-seeding must not duplicate rows");
  });

  it("creates must-play and do-not-play songs", async () => {
    const must = await request(server, "POST", `${BASE}/songs`, {
      kind: "must",
      title: "Despacito",
      artist: "Luis Fonsi",
    });
    assert.equal(must.status, 201);
    assert.equal(must.body.kind, "must");

    const doNot = await request(server, "POST", `${BASE}/songs`, {
      kind: "do_not",
      title: "Coś czego nie chcemy",
    });
    assert.equal(doNot.status, 201);

    const list = await request(server, "GET", BASE);
    assert.equal(list.body.mustPlay.length, 1);
    assert.equal(list.body.doNotPlay.length, 1);
  });

  it("enforces the 50-song must-play limit but not for do-not-play", async () => {
    for (let i = 0; i < 50; i += 1) {
      db.timeline_songs.push({
        id: `must-${i}`,
        wedding_id: "wedding-1",
        kind: "must",
        title: `Utwór ${i}`,
        artist: null,
        sort_order: i,
      });
    }

    const overLimit = await request(server, "POST", `${BASE}/songs`, {
      kind: "must",
      title: "Utwór 51",
    });
    assert.equal(overLimit.status, 400);

    const doNot = await request(server, "POST", `${BASE}/songs`, {
      kind: "do_not",
      title: "Bez limitu",
    });
    assert.equal(doNot.status, 201);
  });

  it("rejects access to events from another wedding", async () => {
    db.timeline_events.push({
      id: "foreign-event",
      wedding_id: "wedding-2",
      label: "Obcy",
      event_time: null,
      sort_order: 0,
      notes: null,
    });

    const patched = await request(server, "PATCH", `${BASE}/events/foreign-event`, {
      label: "Zmiana",
    });
    assert.equal(patched.status, 404);

    const removed = await request(server, "DELETE", `${BASE}/events/foreign-event`);
    assert.equal(removed.status, 404);
    assert.equal(db.timeline_events.length, 1, "foreign row must remain untouched");
  });
});
