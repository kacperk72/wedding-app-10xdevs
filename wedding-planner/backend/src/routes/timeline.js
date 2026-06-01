const express = require("express");
const { supabase } = require("../config/database");
const { BadRequestError, NotFoundError } = require("../errors/domain-errors");
const { requireWeddingMember } = require("../middleware/wedding-member");
const { mapTimeline, mapTimelineEvent, mapTimelineSong } = require("../utils/mappers");
const {
  enumValue,
  optionalBoolean,
  optionalEnum,
  optionalNullableInteger,
  optionalString,
  optionalTimeString,
  requireAtLeastOne,
  requireString,
} = require("../utils/request-validation");

const router = express.Router({ mergeParams: true });

const MUST_PLAY_LIMIT = 50;
const SONG_KINDS = ["must", "do_not"];

// Szablon przebiegu dnia z ankiety DJ-a — wstawiany na żądanie, gdy lista pusta.
const EVENT_TEMPLATE = [
  "Ślub",
  "Wejście na salę",
  "Życzenia",
  "Obiad",
  "Deser",
  "Pierwszy taniec",
  "Tort",
  "I gorące danie",
  "II gorące danie",
  "Oczepiny",
  "III gorące danie",
  "Podziękowania dla rodziców",
  "Pokaz zimnych ogni",
  "Sesja zdjęciowa",
];

// [camelKey, dbColumn, kind, enumValues?] — sterowanie walidacją pól skalarnych.
const TIMELINE_FIELDS = [
  ["ceremonyType", "ceremony_type", "enum", ["koscielny", "cywilny"]],
  ["ceremonyTime", "ceremony_time", "time"],
  ["travelMinutes", "travel_minutes", "intNN"],
  ["venueArrivalTime", "venue_arrival_time", "time"],
  ["entranceOrder", "entrance_order", "enum", ["goscie_pierwsi", "para_pierwsza"]],
  ["glassThrowing", "glass_throwing", "enum", ["nie", "zewnatrz", "wewnatrz"]],
  ["wishesLocation", "wishes_location", "enum", ["pod_koscielem", "lokal_przed_obiadem", "lokal_po_obiedzie"]],
  ["danceFloorGroundFloor", "dance_floor_ground_floor", "bool"],
  ["hasChildren", "has_children", "bool"],
  ["gorzkoTolerance", "gorzko_tolerance", "bool"],
  ["venueManagerName", "venue_manager_name", "string"],
  ["venueManagerPhone", "venue_manager_phone", "string"],
  ["witnesses", "witnesses", "string"],
  ["brideParents", "bride_parents", "string"],
  ["groomParents", "groom_parents", "string"],
  ["firstDanceTime", "first_dance_time", "time"],
  ["firstDanceSong", "first_dance_song", "string"],
  ["firstDanceFull", "first_dance_full", "bool"],
  ["parentsThanksEnabled", "parents_thanks_enabled", "bool"],
  ["parentsThanksTime", "parents_thanks_time", "time"],
  ["parentsThanksForm", "parents_thanks_form", "string"],
  ["parentsThanksSong", "parents_thanks_song", "string"],
  ["cakeTime", "cake_time", "time"],
  ["cakeEntrySong", "cake_entry_song", "string"],
  ["cakeCuttingSong", "cake_cutting_song", "string"],
  ["genrePreferences", "genre_preferences", "array"],
  ["musicPerStage", "music_per_stage", "object"],
  ["notes", "notes", "string"],
];

function optionalStringArray(body, key) {
  if (!body || body[key] === undefined) return undefined;
  const value = body[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new BadRequestError(`${key} must be an array of strings`);
  }
  return value;
}

function optionalPlainObject(body, key) {
  if (!body || body[key] === undefined) return undefined;
  const value = body[key];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestError(`${key} must be an object`);
  }
  return value;
}

function readTimelineField(body, [camelKey, , kind, enumValues]) {
  switch (kind) {
    case "enum":
      return optionalEnum(body, camelKey, enumValues);
    case "time":
      return optionalTimeString(body, camelKey);
    case "bool":
      return optionalBoolean(body, camelKey);
    case "array":
      return optionalStringArray(body, camelKey);
    case "object":
      return optionalPlainObject(body, camelKey);
    case "intNN": {
      const value = optionalNullableInteger(body, camelKey);
      if (typeof value === "number" && value < 0) {
        throw new BadRequestError(`${camelKey} must be >= 0`);
      }
      return value;
    }
    default:
      return optionalString(body, camelKey);
  }
}

function buildTimelinePatch(body) {
  body = body || {};
  const patch = {};
  for (const field of TIMELINE_FIELDS) {
    const value = readTimelineField(body, field);
    if (value !== undefined) patch[field[1]] = value;
  }
  return requireAtLeastOne(patch);
}

async function loadTimelineRow(weddingId) {
  const { data, error } = await supabase
    .from("wedding_timeline")
    .select("*")
    .eq("wedding_id", weddingId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadEvents(weddingId) {
  const { data, error } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("wedding_id", weddingId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

async function loadSongs(weddingId) {
  const { data, error } = await supabase
    .from("timeline_songs")
    .select("*")
    .eq("wedding_id", weddingId)
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

async function buildPayload(weddingId, timelineRow) {
  const [events, songs] = await Promise.all([loadEvents(weddingId), loadSongs(weddingId)]);
  const mappedSongs = songs.map(mapTimelineSong);
  return {
    ...mapTimeline(timelineRow || { wedding_id: weddingId }),
    events: events.map(mapTimelineEvent),
    mustPlay: mappedSongs.filter((song) => song.kind === "must"),
    doNotPlay: mappedSongs.filter((song) => song.kind === "do_not"),
  };
}

async function loadEventForWedding(eventId, weddingId) {
  const { data, error } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("id", eventId)
    .eq("wedding_id", weddingId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError("Timeline event not found");
  return data;
}

async function loadSongForWedding(songId, weddingId) {
  const { data, error } = await supabase
    .from("timeline_songs")
    .select("*")
    .eq("id", songId)
    .eq("wedding_id", weddingId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError("Timeline song not found");
  return data;
}

router.use(requireWeddingMember());

// --- Rekord nadrzędny -------------------------------------------------------

// Czysty odczyt: brak rekordu → syntetyczny pusty obiekt, bez zapisu do bazy.
router.get("/", async (req, res, next) => {
  try {
    const timelineRow = await loadTimelineRow(req.params.weddingId);
    res.json(await buildPayload(req.params.weddingId, timelineRow));
  } catch (err) {
    next(err);
  }
});

// Lazy-create: jeśli rekordu brak, wstaw idempotentnie po wedding_id (unikat).
router.patch("/", async (req, res, next) => {
  try {
    const patch = buildTimelinePatch(req.body);
    const { data, error } = await supabase
      .from("wedding_timeline")
      .upsert({ wedding_id: req.params.weddingId, ...patch }, { onConflict: "wedding_id" })
      .select("*")
      .single();
    if (error) throw error;
    res.json(await buildPayload(req.params.weddingId, data));
  } catch (err) {
    next(err);
  }
});

// --- Zdarzenia (przebieg dnia) ---------------------------------------------

router.get("/events", async (req, res, next) => {
  try {
    const events = await loadEvents(req.params.weddingId);
    res.json(events.map(mapTimelineEvent));
  } catch (err) {
    next(err);
  }
});

router.post("/events", async (req, res, next) => {
  try {
    const insert = {
      wedding_id: req.params.weddingId,
      label: requireString(req.body, "label"),
      event_time: optionalTimeString(req.body, "eventTime") ?? null,
      sort_order: optionalNullableInteger(req.body, "sortOrder") ?? 0,
      notes: optionalString(req.body, "notes") ?? null,
    };
    const { data, error } = await supabase
      .from("timeline_events")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json(mapTimelineEvent(data));
  } catch (err) {
    next(err);
  }
});

// Nieniszczący seed: wstawia szablon DJ-a tylko gdy lista jest pusta.
router.post("/events/seed-template", async (req, res, next) => {
  try {
    const existing = await loadEvents(req.params.weddingId);
    if (existing.length > 0) {
      res.json(existing.map(mapTimelineEvent));
      return;
    }
    const rows = EVENT_TEMPLATE.map((label, index) => ({
      wedding_id: req.params.weddingId,
      label,
      event_time: null,
      sort_order: index,
      notes: null,
    }));
    const { data, error } = await supabase.from("timeline_events").insert(rows).select("*");
    if (error) throw error;
    res.status(201).json(data.map(mapTimelineEvent));
  } catch (err) {
    next(err);
  }
});

router.patch("/events/:eventId", async (req, res, next) => {
  try {
    await loadEventForWedding(req.params.eventId, req.params.weddingId);
    const patch = {};
    const label = optionalString(req.body, "label");
    const eventTime = optionalTimeString(req.body, "eventTime");
    const sortOrder = optionalNullableInteger(req.body, "sortOrder");
    const notes = optionalString(req.body, "notes");
    if (label !== undefined) {
      if (label === null || label.trim() === "") throw new BadRequestError("label cannot be empty");
      patch.label = label;
    }
    if (eventTime !== undefined) patch.event_time = eventTime;
    if (sortOrder !== undefined) patch.sort_order = sortOrder;
    if (notes !== undefined) patch.notes = notes;
    requireAtLeastOne(patch);

    const { data, error } = await supabase
      .from("timeline_events")
      .update(patch)
      .eq("id", req.params.eventId)
      .eq("wedding_id", req.params.weddingId)
      .select("*")
      .single();
    if (error) throw error;
    res.json(mapTimelineEvent(data));
  } catch (err) {
    next(err);
  }
});

router.delete("/events/:eventId", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("timeline_events")
      .delete()
      .eq("id", req.params.eventId)
      .eq("wedding_id", req.params.weddingId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Timeline event not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// --- Utwory (must-play / do-not-play) --------------------------------------

router.get("/songs", async (req, res, next) => {
  try {
    const songs = await loadSongs(req.params.weddingId);
    res.json(songs.map(mapTimelineSong));
  } catch (err) {
    next(err);
  }
});

router.post("/songs", async (req, res, next) => {
  try {
    const kind = enumValue(requireString(req.body, "kind"), SONG_KINDS, "kind");
    if (kind === "must") {
      const songs = await loadSongs(req.params.weddingId);
      const mustCount = songs.filter((song) => song.kind === "must").length;
      if (mustCount >= MUST_PLAY_LIMIT) {
        throw new BadRequestError(`Lista „must-play" może mieć maksymalnie ${MUST_PLAY_LIMIT} utworów`);
      }
    }
    const insert = {
      wedding_id: req.params.weddingId,
      kind,
      title: requireString(req.body, "title"),
      artist: optionalString(req.body, "artist") ?? null,
      sort_order: optionalNullableInteger(req.body, "sortOrder") ?? 0,
    };
    const { data, error } = await supabase
      .from("timeline_songs")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json(mapTimelineSong(data));
  } catch (err) {
    next(err);
  }
});

router.patch("/songs/:songId", async (req, res, next) => {
  try {
    await loadSongForWedding(req.params.songId, req.params.weddingId);
    const patch = {};
    const kind = optionalEnum(req.body, "kind", SONG_KINDS);
    const title = optionalString(req.body, "title");
    const artist = optionalString(req.body, "artist");
    const sortOrder = optionalNullableInteger(req.body, "sortOrder");
    if (kind !== undefined) patch.kind = kind;
    if (title !== undefined) {
      if (title === null || title.trim() === "") throw new BadRequestError("title cannot be empty");
      patch.title = title;
    }
    if (artist !== undefined) patch.artist = artist;
    if (sortOrder !== undefined) patch.sort_order = sortOrder;
    requireAtLeastOne(patch);

    const { data, error } = await supabase
      .from("timeline_songs")
      .update(patch)
      .eq("id", req.params.songId)
      .eq("wedding_id", req.params.weddingId)
      .select("*")
      .single();
    if (error) throw error;
    res.json(mapTimelineSong(data));
  } catch (err) {
    next(err);
  }
});

router.delete("/songs/:songId", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("timeline_songs")
      .delete()
      .eq("id", req.params.songId)
      .eq("wedding_id", req.params.weddingId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Timeline song not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
