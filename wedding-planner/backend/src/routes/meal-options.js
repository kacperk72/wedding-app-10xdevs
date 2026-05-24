const express = require("express");
const { supabase } = require("../config/database");
const { NotFoundError } = require("../errors/domain-errors");
const { requireWeddingMember } = require("../middleware/wedding-member");
const { mapMealOption } = require("../utils/mappers");
const {
  optionalInteger,
  optionalNonEmptyString,
  requireAtLeastOne,
  requireString,
} = require("../utils/request-validation");

const router = express.Router({ mergeParams: true });

router.use(requireWeddingMember());

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("meal_options")
      .select("*")
      .eq("wedding_id", req.params.weddingId)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (error) throw error;
    res.json(data.map(mapMealOption));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const insert = {
      wedding_id: req.params.weddingId,
      label: requireString(req.body, "label"),
      sort_order: optionalInteger(req.body, "sortOrder") ?? 0,
    };

    const { data, error } = await supabase
      .from("meal_options")
      .insert(insert)
      .select("*")
      .single();

    if (error) throw error;
    res.status(201).json(mapMealOption(data));
  } catch (err) {
    next(err);
  }
});

router.patch("/:mealOptionId", async (req, res, next) => {
  try {
    const patch = {};
    const label = optionalNonEmptyString(req.body, "label");
    const sortOrder = optionalInteger(req.body, "sortOrder");
    if (label !== undefined) patch.label = label;
    if (sortOrder !== undefined) patch.sort_order = sortOrder;
    requireAtLeastOne(patch);

    const { data, error } = await supabase
      .from("meal_options")
      .update(patch)
      .eq("id", req.params.mealOptionId)
      .eq("wedding_id", req.params.weddingId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Meal option not found");
    res.json(mapMealOption(data));
  } catch (err) {
    next(err);
  }
});

router.delete("/:mealOptionId", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("meal_options")
      .delete()
      .eq("id", req.params.mealOptionId)
      .eq("wedding_id", req.params.weddingId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Meal option not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
