const express = require("express");
const { supabase } = require("../config/database");
const { BadRequestError, NotFoundError } = require("../errors/domain-errors");
const { requireWeddingMember } = require("../middleware/wedding-member");
const { loadDishForWedding, loadOfferForWedding } = require("../utils/catering-guards");
const { mapCateringDish } = require("../utils/mappers");
const {
  optionalBoolean,
  optionalString,
  requireAtLeastOne,
  requireString,
} = require("../utils/request-validation");

const router = express.Router({ mergeParams: true });

router.use(requireWeddingMember());

function optionalStringArray(body, key) {
  if (!body || body[key] === undefined) return undefined;
  if (!Array.isArray(body[key])) throw new BadRequestError(`${key} must be an array`);
  return body[key].map((item) => String(item).trim()).filter(Boolean);
}

function buildDishPatch(body) {
  body = body || {};
  const patch = {};
  const name = optionalString(body, "name");
  const description = optionalString(body, "description");
  const isVegetarian = optionalBoolean(body, "isVegetarian");
  const isVegan = optionalBoolean(body, "isVegan");
  const isGlutenFree = optionalBoolean(body, "isGlutenFree");
  const allergens = optionalStringArray(body, "allergens");

  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description;
  if (isVegetarian !== undefined) patch.is_vegetarian = isVegetarian;
  if (isVegan !== undefined) patch.is_vegan = isVegan;
  if (isGlutenFree !== undefined) patch.is_gluten_free = isGlutenFree;
  if (allergens !== undefined) patch.allergens = allergens;

  return requireAtLeastOne(patch);
}

router.get("/offers/:offerId/dishes", async (req, res, next) => {
  try {
    await loadOfferForWedding(req.params.offerId, req.params.weddingId);
    const { data, error } = await supabase
      .from("catering_dishes")
      .select("*")
      .eq("catering_offer_id", req.params.offerId)
      .order("name", { ascending: true });
    if (error) throw error;
    res.json(data.map((dish) => mapCateringDish(dish)));
  } catch (err) {
    next(err);
  }
});

router.post("/offers/:offerId/dishes", async (req, res, next) => {
  try {
    await loadOfferForWedding(req.params.offerId, req.params.weddingId);
    const insert = {
      catering_offer_id: req.params.offerId,
      name: requireString(req.body, "name"),
      description: optionalString(req.body, "description") ?? null,
      is_vegetarian: optionalBoolean(req.body, "isVegetarian") ?? false,
      is_vegan: optionalBoolean(req.body, "isVegan") ?? false,
      is_gluten_free: optionalBoolean(req.body, "isGlutenFree") ?? false,
      allergens: optionalStringArray(req.body, "allergens") ?? [],
    };

    const { data, error } = await supabase
      .from("catering_dishes")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json(mapCateringDish(data));
  } catch (err) {
    next(err);
  }
});

router.patch("/:dishId", async (req, res, next) => {
  try {
    await loadDishForWedding(req.params.dishId, req.params.weddingId);
    const { data, error } = await supabase
      .from("catering_dishes")
      .update(buildDishPatch(req.body))
      .eq("id", req.params.dishId)
      .select("*")
      .single();
    if (error) throw error;
    res.json(mapCateringDish(data));
  } catch (err) {
    next(err);
  }
});

router.delete("/:dishId", async (req, res, next) => {
  try {
    await loadDishForWedding(req.params.dishId, req.params.weddingId);
    await supabase.from("catering_course_dishes").delete().eq("catering_dish_id", req.params.dishId);
    const { data, error } = await supabase
      .from("catering_dishes")
      .delete()
      .eq("id", req.params.dishId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Catering dish not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
