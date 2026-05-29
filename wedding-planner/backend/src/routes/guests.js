const express = require("express");
const { supabase } = require("../config/database");
const { BadRequestError, NotFoundError } = require("../errors/domain-errors");
const { requireWeddingMember } = require("../middleware/wedding-member");
const { assertWeddingRecordExists } = require("../utils/cross-wedding");
const { mapGuest } = require("../utils/mappers");
const {
  enumValue,
  optionalBoolean,
  optionalEnum,
  optionalNonEmptyString,
  optionalNullableInteger,
  optionalString,
  requireAtLeastOne,
  requireString,
} = require("../utils/request-validation");

const router = express.Router({ mergeParams: true });

const RELATIONS = [
  "rodzina_panny_mlodej",
  "rodzina_pana_mlodego",
  "przyjaciele_panny_mlodej",
  "przyjaciele_pana_mlodego",
  "znajomi_z_pracy",
  "wspolni_znajomi",
];
const RSVP_STATUSES = ["pending", "confirmed", "declined"];
const DIETS = ["pending", "standard", "vege", "vegan", "gluten_free"];

function buildGuestInsert(body, weddingId) {
  return {
    wedding_id: weddingId,
    first_name: requireString(body, "firstName"),
    last_name: requireString(body, "lastName"),
    relation: enumValue(requireString(body, "relation"), RELATIONS, "relation"),
    rsvp_status: optionalEnum(body, "rsvpStatus", RSVP_STATUSES) || "pending",
    diet: optionalEnum(body, "diet", DIETS) || "pending",
    has_plus_one: optionalBoolean(body, "hasPlusOne") ?? false,
    is_child: optionalBoolean(body, "isChild") ?? false,
    meal_option_id: optionalString(body, "mealOptionId") ?? null,
    table_id: optionalString(body, "tableId") ?? null,
    contact_phone: optionalString(body, "contactPhone") ?? null,
    contact_email: optionalString(body, "contactEmail") ?? null,
  };
}

function buildGuestPatch(body) {
  body = body || {};
  const patch = {};
  const fieldMap = [
    ["firstName", "first_name", optionalNonEmptyString],
    ["lastName", "last_name", optionalNonEmptyString],
    ["contactPhone", "contact_phone", optionalString],
    ["contactEmail", "contact_email", optionalString],
  ];

  for (const [inputKey, column, reader] of fieldMap) {
    const value = reader(body, inputKey);
    if (value !== undefined) patch[column] = value;
  }

  const relation = optionalEnum(body, "relation", RELATIONS);
  const rsvpStatus = optionalEnum(body, "rsvpStatus", RSVP_STATUSES);
  const diet = optionalEnum(body, "diet", DIETS);
  const hasPlusOne = optionalBoolean(body, "hasPlusOne");
  const isChild = optionalBoolean(body, "isChild");
  const mealOptionId = optionalString(body, "mealOptionId");
  const tableId = optionalString(body, "tableId");
  const seatNumber = optionalNullableInteger(body, "seatNumber");

  if (relation !== undefined) patch.relation = relation;
  if (rsvpStatus !== undefined) patch.rsvp_status = rsvpStatus;
  if (diet !== undefined) patch.diet = diet;
  if (hasPlusOne !== undefined) patch.has_plus_one = hasPlusOne;
  if (isChild !== undefined) patch.is_child = isChild;
  if (mealOptionId !== undefined) patch.meal_option_id = mealOptionId;
  if (tableId !== undefined) patch.table_id = tableId;
  if (seatNumber !== undefined) patch.seat_number = seatNumber;
  // Zmiana stołu (lub odpięcie) unieważnia dotychczasowe krzesło, o ile nowego
  // nie podano wprost — krzesło jest sensowne tylko w kontekście bieżącego stołu.
  if (patch.table_id !== undefined && patch.seat_number === undefined) {
    patch.seat_number = null;
  }

  return requireAtLeastOne(patch);
}

// Krzesło można nadać tylko gościowi przy stole i tylko w zakresie liczby miejsc.
// Unikat (jedno krzesło = jeden gość) pilnuje indeks uq_guests_table_seat.
async function assertSeatNumberValid(patch, guest, weddingId) {
  if (patch.seat_number === undefined || patch.seat_number === null) return;

  const tableId = patch.table_id !== undefined ? patch.table_id : guest.table_id;
  if (!tableId) {
    throw new BadRequestError("Nie można przypisać krzesła gościowi bez stołu");
  }

  const table = await loadTableForWedding(tableId, weddingId);
  if (patch.seat_number > Number(table.seats_count)) {
    throw new BadRequestError(
      `Numer krzesła przekracza liczbę miejsc przy stole (${table.seats_count})`,
    );
  }
}

async function assertGuestRelationsBelongToWedding(payload, weddingId) {
  await assertWeddingRecordExists("meal_options", payload.meal_option_id, weddingId, "mealOptionId");
  await assertWeddingRecordExists("tables", payload.table_id, weddingId, "tableId");
}

async function loadGuestForWedding(guestId, weddingId) {
  const { data, error } = await supabase
    .from("guests")
    .select("*, meal_options(label), tables(name)")
    .eq("id", guestId)
    .eq("wedding_id", weddingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new NotFoundError("Guest not found");
  return data;
}

async function loadTableForWedding(tableId, weddingId) {
  const { data, error } = await supabase
    .from("tables")
    .select("id,seats_count")
    .eq("id", tableId)
    .eq("wedding_id", weddingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new NotFoundError("Table not found");
  return data;
}

async function loadGuestsAtTable(tableId, weddingId, excludeGuestId = null) {
  let query = supabase
    .from("guests")
    .select("id,first_name,last_name,table_id")
    .eq("wedding_id", weddingId)
    .eq("table_id", tableId);

  if (excludeGuestId) query = query.neq("id", excludeGuestId);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function loadConflictWarnings(currentGuestId, seatedGuests, weddingId) {
  const otherGuestIds = seatedGuests.map((guest) => guest.id);
  if (otherGuestIds.length === 0) return [];

  const [{ data: aSide, error: aError }, { data: bSide, error: bError }] = await Promise.all([
    supabase
      .from("seating_conflicts")
      .select("guest_a_id,guest_b_id,reason")
      .eq("wedding_id", weddingId)
      .eq("guest_a_id", currentGuestId)
      .in("guest_b_id", otherGuestIds),
    supabase
      .from("seating_conflicts")
      .select("guest_a_id,guest_b_id,reason")
      .eq("wedding_id", weddingId)
      .eq("guest_b_id", currentGuestId)
      .in("guest_a_id", otherGuestIds),
  ]);

  if (aError) throw aError;
  if (bError) throw bError;

  const guestsById = new Map(seatedGuests.map((guest) => [guest.id, guest]));
  return [...aSide, ...bSide].map((conflict) => {
    const otherGuestId =
      conflict.guest_a_id === currentGuestId ? conflict.guest_b_id : conflict.guest_a_id;
    const otherGuest = guestsById.get(otherGuestId);
    return {
      otherGuestId,
      otherGuestName: otherGuest ? `${otherGuest.first_name} ${otherGuest.last_name}` : null,
      reason: conflict.reason,
    };
  });
}

router.use(requireWeddingMember());

router.get("/aggregates", async (req, res, next) => {
  try {
    const { data, error } = await supabase.rpc("guest_aggregates", {
      p_wedding_id: req.params.weddingId,
    });

    if (error) throw error;
    res.json(Array.isArray(data) ? data[0] : data);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const search = req.query.search ? String(req.query.search).trim().toLowerCase() : "";
    let query = supabase
      .from("guests")
      .select("*, meal_options(label), tables(name)")
      .eq("wedding_id", req.params.weddingId);

    if (req.query.rsvp) query = query.eq("rsvp_status", req.query.rsvp);
    if (req.query.diet) query = query.eq("diet", req.query.diet);
    if (req.query.relation) query = query.eq("relation", req.query.relation);

    const sort = req.query.sort === "firstName" ? "first_name" : "last_name";
    const ascending = req.query.direction !== "desc";
    const { data, error } = await query
      .order(sort, { ascending })
      .order(sort === "last_name" ? "first_name" : "last_name", { ascending: true });

    if (error) throw error;
    const mapped = data.map(mapGuest);
    res.json(
      search
        ? mapped.filter((guest) =>
            `${guest.firstName} ${guest.lastName}`.toLowerCase().includes(search),
          )
        : mapped,
    );
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const insert = buildGuestInsert(req.body, req.params.weddingId);
    await assertGuestRelationsBelongToWedding(insert, req.params.weddingId);

    const { data, error } = await supabase
      .from("guests")
      .insert(insert)
      .select("*, meal_options(label), tables(name)")
      .single();

    if (error) throw error;
    res.status(201).json(mapGuest(data));
  } catch (err) {
    next(err);
  }
});

router.post("/:guestId/assign-table", async (req, res, next) => {
  try {
    const weddingId = req.params.weddingId;
    const tableId = requireString(req.body, "tableId");

    await loadGuestForWedding(req.params.guestId, weddingId);
    await assertWeddingRecordExists("tables", tableId, weddingId, "tableId");

    const table = await loadTableForWedding(tableId, weddingId);
    const seatedGuests = await loadGuestsAtTable(tableId, weddingId, req.params.guestId);
    if (seatedGuests.length >= Number(table.seats_count)) {
      throw new BadRequestError("table is full");
    }

    const warnings = await loadConflictWarnings(req.params.guestId, seatedGuests, weddingId);
    const { data, error } = await supabase
      .from("guests")
      .update({ table_id: tableId, seat_number: null })
      .eq("id", req.params.guestId)
      .eq("wedding_id", weddingId)
      .select("*, meal_options(label), tables(name)")
      .single();

    if (error) throw error;
    res.json({ guest: mapGuest(data), warnings });
  } catch (err) {
    next(err);
  }
});

router.post("/:guestId/unassign-table", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("guests")
      .update({ table_id: null, seat_number: null })
      .eq("id", req.params.guestId)
      .eq("wedding_id", req.params.weddingId)
      .select("*, meal_options(label), tables(name)")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Guest not found");
    res.json(mapGuest(data));
  } catch (err) {
    next(err);
  }
});

router.patch("/:guestId", async (req, res, next) => {
  try {
    const guest = await loadGuestForWedding(req.params.guestId, req.params.weddingId);
    const patch = buildGuestPatch(req.body);
    await assertGuestRelationsBelongToWedding(patch, req.params.weddingId);
    await assertSeatNumberValid(patch, guest, req.params.weddingId);

    const { data, error } = await supabase
      .from("guests")
      .update(patch)
      .eq("id", req.params.guestId)
      .eq("wedding_id", req.params.weddingId)
      .select("*, meal_options(label), tables(name)")
      .single();

    if (error) {
      if (error.code === "23505") throw new BadRequestError("To krzesło jest już zajęte");
      throw error;
    }
    res.json(mapGuest(data));
  } catch (err) {
    next(err);
  }
});

router.delete("/:guestId", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("guests")
      .delete()
      .eq("id", req.params.guestId)
      .eq("wedding_id", req.params.weddingId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Guest not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
