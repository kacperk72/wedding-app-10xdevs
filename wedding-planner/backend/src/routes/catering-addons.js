const express = require("express");
const { supabase } = require("../config/database");
const { BadRequestError, NotFoundError } = require("../errors/domain-errors");
const { requireWeddingMember } = require("../middleware/wedding-member");
const { loadAddonForWedding, loadOfferForWedding } = require("../utils/catering-guards");
const { mapCateringAddon } = require("../utils/mappers");
const {
  enumValue,
  optionalInteger,
  optionalString,
  requireAtLeastOne,
  requireString,
} = require("../utils/request-validation");

const router = express.Router({ mergeParams: true });
const PRICING_UNITS = ["per_person", "per_event", "per_bottle", "per_hour", "per_unit"];

router.use(requireWeddingMember());

function requireAmount(body, key) {
  if (!body || typeof body[key] !== "number" || !Number.isFinite(body[key]) || body[key] < 0) {
    throw new BadRequestError(`${key} must be a non-negative number`);
  }
  return body[key];
}

function optionalAmount(body, key) {
  if (!body || body[key] === undefined) return undefined;
  return requireAmount(body, key);
}

function buildAddonPatch(body) {
  body = body || {};
  const patch = {};
  const name = optionalString(body, "name");
  const price = optionalAmount(body, "price");
  const pricingUnit = optionalString(body, "pricingUnit");
  const description = optionalString(body, "description");
  const sortOrder = optionalInteger(body, "sortOrder");

  if (name !== undefined) patch.name = name;
  if (price !== undefined) patch.price = price;
  if (pricingUnit !== undefined) patch.pricing_unit = enumValue(pricingUnit, PRICING_UNITS, "pricingUnit");
  if (description !== undefined) patch.description = description;
  if (sortOrder !== undefined) patch.sort_order = sortOrder;

  return requireAtLeastOne(patch);
}

router.get("/offers/:offerId/addons", async (req, res, next) => {
  try {
    await loadOfferForWedding(req.params.offerId, req.params.weddingId);
    const { data, error } = await supabase
      .from("catering_addons")
      .select("*")
      .eq("catering_offer_id", req.params.offerId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    res.json(data.map(mapCateringAddon));
  } catch (err) {
    next(err);
  }
});

router.post("/offers/:offerId/addons", async (req, res, next) => {
  try {
    await loadOfferForWedding(req.params.offerId, req.params.weddingId);
    const insert = {
      catering_offer_id: req.params.offerId,
      name: requireString(req.body, "name"),
      price: requireAmount(req.body, "price"),
      pricing_unit: enumValue(requireString(req.body, "pricingUnit"), PRICING_UNITS, "pricingUnit"),
      description: optionalString(req.body, "description") ?? null,
      sort_order: optionalInteger(req.body, "sortOrder") ?? 0,
    };

    const { data, error } = await supabase
      .from("catering_addons")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json(mapCateringAddon(data));
  } catch (err) {
    next(err);
  }
});

router.patch("/:addonId", async (req, res, next) => {
  try {
    await loadAddonForWedding(req.params.addonId, req.params.weddingId);
    const { data, error } = await supabase
      .from("catering_addons")
      .update(buildAddonPatch(req.body))
      .eq("id", req.params.addonId)
      .select("*")
      .single();
    if (error) throw error;
    res.json(mapCateringAddon(data));
  } catch (err) {
    next(err);
  }
});

router.delete("/:addonId", async (req, res, next) => {
  try {
    await loadAddonForWedding(req.params.addonId, req.params.weddingId);
    await supabase.from("wedding_catering_addon_picks").delete().eq("catering_addon_id", req.params.addonId);
    const { data, error } = await supabase
      .from("catering_addons")
      .delete()
      .eq("id", req.params.addonId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Catering addon not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
