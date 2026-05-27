const express = require("express");
const { supabase } = require("../config/database");
const { BadRequestError, NotFoundError } = require("../errors/domain-errors");
const { requireWeddingMember } = require("../middleware/wedding-member");
const { assertWeddingRecordExists } = require("../utils/cross-wedding");
const { mapSeatingConflict } = require("../utils/mappers");
const { requireAtLeastOne, requireString } = require("../utils/request-validation");

const router = express.Router({ mergeParams: true });

router.use(requireWeddingMember());

function guestMap(guests) {
  return new Map(guests.map((guest) => [guest.id, guest]));
}

async function loadGuestsByIds(ids, weddingId) {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("guests")
    .select("id,first_name,last_name")
    .eq("wedding_id", weddingId)
    .in("id", ids);

  if (error) throw error;
  return guestMap(data);
}

async function loadConflictForWedding(id, weddingId) {
  const { data, error } = await supabase
    .from("seating_conflicts")
    .select("*")
    .eq("id", id)
    .eq("wedding_id", weddingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new NotFoundError("Seating conflict not found");
  return data;
}

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("seating_conflicts")
      .select("*")
      .eq("wedding_id", req.params.weddingId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const ids = [...new Set(data.flatMap((conflict) => [conflict.guest_a_id, conflict.guest_b_id]))];
    const guests = await loadGuestsByIds(ids, req.params.weddingId);

    res.json(
      data.map((conflict) =>
        mapSeatingConflict(
          conflict,
          guests.get(conflict.guest_a_id) || null,
          guests.get(conflict.guest_b_id) || null,
        ),
      ),
    );
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const guestAId = requireString(req.body, "guestAId");
    const guestBId = requireString(req.body, "guestBId");
    if (guestAId === guestBId) {
      throw new BadRequestError("guestAId and guestBId must differ");
    }

    await assertWeddingRecordExists("guests", guestAId, req.params.weddingId, "guestAId");
    await assertWeddingRecordExists("guests", guestBId, req.params.weddingId, "guestBId");

    const insert = {
      wedding_id: req.params.weddingId,
      guest_a_id: guestAId,
      guest_b_id: guestBId,
      reason: requireString(req.body, "reason"),
    };

    const { data, error } = await supabase
      .from("seating_conflicts")
      .insert(insert)
      .select("*")
      .single();

    if (error) throw error;

    const guests = await loadGuestsByIds([guestAId, guestBId], req.params.weddingId);
    res.status(201).json(
      mapSeatingConflict(data, guests.get(guestAId) || null, guests.get(guestBId) || null),
    );
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    await loadConflictForWedding(req.params.id, req.params.weddingId);
    const patch = requireAtLeastOne({
      ...(req.body?.reason !== undefined ? { reason: requireString(req.body, "reason") } : {}),
    });

    const { data, error } = await supabase
      .from("seating_conflicts")
      .update(patch)
      .eq("id", req.params.id)
      .eq("wedding_id", req.params.weddingId)
      .select("*")
      .single();

    if (error) throw error;
    const guests = await loadGuestsByIds([data.guest_a_id, data.guest_b_id], req.params.weddingId);
    res.json(
      mapSeatingConflict(
        data,
        guests.get(data.guest_a_id) || null,
        guests.get(data.guest_b_id) || null,
      ),
    );
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("seating_conflicts")
      .delete()
      .eq("id", req.params.id)
      .eq("wedding_id", req.params.weddingId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Seating conflict not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
