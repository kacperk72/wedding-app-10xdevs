const express = require("express");
const { supabase } = require("../config/database");
const { BadRequestError, NotFoundError } = require("../errors/domain-errors");
const { requireWeddingMember } = require("../middleware/wedding-member");
const { mapMeeting } = require("../utils/mappers");
const {
  optionalNonEmptyString,
  optionalString,
  requireAtLeastOne,
  requireString,
} = require("../utils/request-validation");

const router = express.Router({ mergeParams: true });

function dateTimeString(value, key) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new BadRequestError(`${key} is required`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError(`${key} must be a valid date-time`);
  }
  return parsed.toISOString();
}

function optionalDateTimeString(body, key) {
  if (!body || body[key] === undefined) return undefined;
  if (body[key] === null) return null;
  return dateTimeString(body[key], key);
}

async function assertVendorBelongsToWedding(vendorId, weddingId) {
  if (vendorId === null || vendorId === undefined) return;
  const { data, error } = await supabase
    .from("vendors")
    .select("id")
    .eq("id", vendorId)
    .eq("wedding_id", weddingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new BadRequestError("vendorId does not belong to this wedding");
}

async function loadVendorsById(weddingId) {
  const { data, error } = await supabase
    .from("vendors")
    .select("id, company_name")
    .eq("wedding_id", weddingId);
  if (error) throw error;
  return new Map(data.map((vendor) => [vendor.id, vendor]));
}

async function loadMeetings(weddingId) {
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("wedding_id", weddingId)
    .order("starts_at", { ascending: true });
  if (error) throw error;

  const vendorsById = await loadVendorsById(weddingId);
  return data.map((meeting) => mapMeeting(meeting, vendorsById.get(meeting.vendor_id) || null));
}

function buildMeetingPatch(body) {
  body = body || {};
  const patch = {};
  const title = optionalNonEmptyString(body, "title");
  const meetingDate = optionalDateTimeString(body, "meetingDate");
  const vendorId = optionalString(body, "vendorId");
  const notes = optionalString(body, "notes");

  if (title !== undefined) patch.title = title;
  if (meetingDate !== undefined) patch.starts_at = meetingDate;
  if (vendorId !== undefined) patch.vendor_id = vendorId;
  if (notes !== undefined) patch.notes = notes;

  return requireAtLeastOne(patch);
}

router.use(requireWeddingMember());

router.get("/upcoming", async (req, res, next) => {
  try {
    const now = new Date();
    const inFourteenDays = new Date(now);
    inFourteenDays.setUTCDate(now.getUTCDate() + 14);

    const meetings = (await loadMeetings(req.params.weddingId)).filter((meeting) => {
      const meetingDate = new Date(meeting.meetingDate);
      return meetingDate >= now && meetingDate <= inFourteenDays;
    });

    res.json(meetings);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    res.json(await loadMeetings(req.params.weddingId));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const vendorId = optionalString(req.body, "vendorId") ?? null;
    await assertVendorBelongsToWedding(vendorId, req.params.weddingId);

    const insert = {
      wedding_id: req.params.weddingId,
      title: requireString(req.body, "title"),
      starts_at: dateTimeString(requireString(req.body, "meetingDate"), "meetingDate"),
      vendor_id: vendorId,
      notes: optionalString(req.body, "notes") ?? null,
    };

    const { data, error } = await supabase.from("meetings").insert(insert).select("*").single();
    if (error) throw error;
    const vendorsById = await loadVendorsById(req.params.weddingId);
    res.status(201).json(mapMeeting(data, vendorsById.get(data.vendor_id) || null));
  } catch (err) {
    next(err);
  }
});

router.patch("/:meetingId", async (req, res, next) => {
  try {
    const patch = buildMeetingPatch(req.body);
    await assertVendorBelongsToWedding(patch.vendor_id, req.params.weddingId);

    const { data, error } = await supabase
      .from("meetings")
      .update(patch)
      .eq("id", req.params.meetingId)
      .eq("wedding_id", req.params.weddingId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Meeting not found");
    const vendorsById = await loadVendorsById(req.params.weddingId);
    res.json(mapMeeting(data, vendorsById.get(data.vendor_id) || null));
  } catch (err) {
    next(err);
  }
});

router.delete("/:meetingId", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("meetings")
      .delete()
      .eq("id", req.params.meetingId)
      .eq("wedding_id", req.params.weddingId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Meeting not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
