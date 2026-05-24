const express = require("express");
const { supabase } = require("../config/database");
const { BadRequestError, NotFoundError } = require("../errors/domain-errors");
const { requireWeddingMember } = require("../middleware/wedding-member");
const { mapGuest } = require("../utils/mappers");
const {
  enumValue,
  optionalBoolean,
  optionalEnum,
  optionalNonEmptyString,
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

  if (relation !== undefined) patch.relation = relation;
  if (rsvpStatus !== undefined) patch.rsvp_status = rsvpStatus;
  if (diet !== undefined) patch.diet = diet;
  if (hasPlusOne !== undefined) patch.has_plus_one = hasPlusOne;
  if (isChild !== undefined) patch.is_child = isChild;
  if (mealOptionId !== undefined) patch.meal_option_id = mealOptionId;
  if (tableId !== undefined) patch.table_id = tableId;

  return requireAtLeastOne(patch);
}

async function assertWeddingRecordExists(tableName, id, weddingId, label) {
  if (id === null || id === undefined) return;
  if (typeof id !== "string" || id.trim() === "") {
    throw new BadRequestError(`${label} must be a valid id`);
  }

  const { data, error } = await supabase
    .from(tableName)
    .select("id")
    .eq("id", id)
    .eq("wedding_id", weddingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new BadRequestError(`${label} does not belong to this wedding`);
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

router.use(requireWeddingMember());

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

router.patch("/:guestId", async (req, res, next) => {
  try {
    await loadGuestForWedding(req.params.guestId, req.params.weddingId);
    const patch = buildGuestPatch(req.body);
    await assertGuestRelationsBelongToWedding(patch, req.params.weddingId);

    const { data, error } = await supabase
      .from("guests")
      .update(patch)
      .eq("id", req.params.guestId)
      .eq("wedding_id", req.params.weddingId)
      .select("*, meal_options(label), tables(name)")
      .single();

    if (error) throw error;
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
