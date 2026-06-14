const express = require("express");
const { supabase } = require("../config/database");
const { BadRequestError, NotFoundError } = require("../errors/domain-errors");
const { requireWeddingMember } = require("../middleware/wedding-member");
const { mapTable } = require("../utils/mappers");
const {
  optionalInteger,
  optionalNonEmptyString,
  requireAtLeastOne,
  requireString,
} = require("../utils/request-validation");

const router = express.Router({ mergeParams: true });

function validateSeatsCount(value) {
  if (value === undefined) return undefined;
  if (value < 1 || value > 24) {
    throw new BadRequestError("seatsCount must be between 1 and 24");
  }
  return value;
}

function buildTablePatch(body) {
  body = body || {};
  const patch = {};
  const name = optionalNonEmptyString(body, "name");
  const seatsCount = validateSeatsCount(optionalInteger(body, "seatsCount"));
  const sortOrder = optionalInteger(body, "sortOrder");
  const positionX = optionalInteger(body, "positionX");
  const positionY = optionalInteger(body, "positionY");

  if (name !== undefined) patch.name = name;
  if (seatsCount !== undefined) patch.seats_count = seatsCount;
  if (sortOrder !== undefined) patch.sort_order = sortOrder;
  if (positionX !== undefined) patch.position_x = positionX;
  if (positionY !== undefined) patch.position_y = positionY;

  return requireAtLeastOne(patch);
}

router.use(requireWeddingMember());

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("tables")
      .select("*")
      .eq("wedding_id", req.params.weddingId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    res.json(data.map(mapTable));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const insert = {
      wedding_id: req.params.weddingId,
      name: requireString(req.body, "name"),
      seats_count: validateSeatsCount(optionalInteger(req.body, "seatsCount")) ?? 8,
      sort_order: optionalInteger(req.body, "sortOrder") ?? 0,
      position_x: optionalInteger(req.body, "positionX") ?? null,
      position_y: optionalInteger(req.body, "positionY") ?? null,
    };

    const { data, error } = await supabase
      .from("tables")
      .insert(insert)
      .select("*")
      .single();

    if (error) throw error;
    res.status(201).json(mapTable(data));
  } catch (err) {
    next(err);
  }
});

router.patch("/:tableId", async (req, res, next) => {
  try {
    const patch = buildTablePatch(req.body);

    // Nie pozwól zmniejszyć liczby miejsc poniżej zajętego krzesła —
    // najpierw trzeba zwolnić krzesła o numerze > nowej liczby miejsc.
    if (patch.seats_count !== undefined) {
      const { data: occupied, error: occupiedError } = await supabase
        .from("guests")
        .select("seat_number")
        .eq("wedding_id", req.params.weddingId)
        .eq("table_id", req.params.tableId)
        .gt("seat_number", patch.seats_count)
        .order("seat_number", { ascending: false })
        .limit(1);

      if (occupiedError) throw occupiedError;
      if (occupied && occupied.length > 0) {
        throw new BadRequestError(
          `Najpierw zwolnij krzesła o numerze większym niż ${patch.seats_count}`,
        );
      }
    }

    const { data, error } = await supabase
      .from("tables")
      .update(patch)
      .eq("id", req.params.tableId)
      .eq("wedding_id", req.params.weddingId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Table not found");
    res.json(mapTable(data));
  } catch (err) {
    next(err);
  }
});

// Zwolnij stół — usuwa z miejsc wszystkich przypisanych gości naraz
// (czyści table_id i seat_number). Nie kasuje stołu.
router.post("/:tableId/release", async (req, res, next) => {
  try {
    const { weddingId, tableId } = req.params;

    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("id")
      .eq("id", tableId)
      .eq("wedding_id", weddingId)
      .maybeSingle();

    if (tableError) throw tableError;
    if (!table) throw new NotFoundError("Table not found");

    const { data: seated, error: seatedError } = await supabase
      .from("guests")
      .select("id")
      .eq("wedding_id", weddingId)
      .eq("table_id", tableId);

    if (seatedError) throw seatedError;

    if (seated.length > 0) {
      const { error: updateError } = await supabase
        .from("guests")
        .update({ table_id: null, seat_number: null })
        .eq("wedding_id", weddingId)
        .eq("table_id", tableId);

      if (updateError) throw updateError;
    }

    res.json({ released: seated.length });
  } catch (err) {
    next(err);
  }
});

router.delete("/:tableId", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("tables")
      .delete()
      .eq("id", req.params.tableId)
      .eq("wedding_id", req.params.weddingId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Table not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
