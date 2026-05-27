const express = require("express");
const { supabase } = require("../config/database");
const { BadRequestError, ConflictError, NotFoundError } = require("../errors/domain-errors");
const { requireWeddingMember } = require("../middleware/wedding-member");
const presets = require("../seed/presets");
const { assertWeddingRecordExists } = require("../utils/cross-wedding");
const { loadOfferForWedding, assertOfferNameAvailable } = require("../utils/catering-guards");
const { mapCateringOffer, mapCateringOfferFull } = require("../utils/mappers");
const {
  optionalDateString,
  optionalString,
  requireAtLeastOne,
  requireString,
} = require("../utils/request-validation");

const router = express.Router({ mergeParams: true });

router.use(requireWeddingMember());

async function loadVendorsById(weddingId, vendorIds) {
  const ids = [...new Set(vendorIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("vendors")
    .select("id,company_name")
    .eq("wedding_id", weddingId)
    .in("id", ids);
  if (error) throw error;
  return new Map(data.map((vendor) => [vendor.id, vendor]));
}

async function loadOfferCounts(offers) {
  const offerIds = offers.map((offer) => offer.id);
  if (offerIds.length === 0) return new Map();
  const [packagesResult, dishesResult, addonsResult] = await Promise.all([
    supabase.from("catering_packages").select("id,catering_offer_id").in("catering_offer_id", offerIds),
    supabase.from("catering_dishes").select("id,catering_offer_id").in("catering_offer_id", offerIds),
    supabase.from("catering_addons").select("id,catering_offer_id").in("catering_offer_id", offerIds),
  ]);
  if (packagesResult.error) throw packagesResult.error;
  if (dishesResult.error) throw dishesResult.error;
  if (addonsResult.error) throw addonsResult.error;

  const counts = new Map(offerIds.map((id) => [id, { packagesCount: 0, dishesCount: 0, addonsCount: 0 }]));
  for (const row of packagesResult.data) counts.get(row.catering_offer_id).packagesCount += 1;
  for (const row of dishesResult.data) counts.get(row.catering_offer_id).dishesCount += 1;
  for (const row of addonsResult.data) counts.get(row.catering_offer_id).addonsCount += 1;
  return counts;
}

async function loadOfferFull(offer, weddingId) {
  const { data: packages, error: packagesError } = await supabase
    .from("catering_packages")
    .select("*")
    .eq("catering_offer_id", offer.id)
    .order("sort_order", { ascending: true });
  if (packagesError) throw packagesError;

  const packageIds = packages.map((pkg) => pkg.id);
  const [coursesResult, dishesResult, addonsResult] = await Promise.all([
    packageIds.length > 0
      ? supabase.from("catering_courses").select("*").in("catering_package_id", packageIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("catering_dishes").select("*").eq("catering_offer_id", offer.id),
    supabase.from("catering_addons").select("*").eq("catering_offer_id", offer.id),
  ]);
  if (coursesResult.error) throw coursesResult.error;
  if (dishesResult.error) throw dishesResult.error;
  if (addonsResult.error) throw addonsResult.error;

  const courseIds = coursesResult.data.map((course) => course.id);
  const linksResult =
    courseIds.length > 0
      ? await supabase.from("catering_course_dishes").select("*").in("catering_course_id", courseIds)
      : { data: [], error: null };
  if (linksResult.error) throw linksResult.error;

  const vendorsById = await loadVendorsById(weddingId, [offer.vendor_id]);
  return mapCateringOfferFull(
    offer,
    packages,
    coursesResult.data,
    dishesResult.data,
    linksResult.data,
    addonsResult.data,
    vendorsById.get(offer.vendor_id) || null,
  );
}

function buildOfferInsert(body, weddingId) {
  const vendorId = optionalString(body, "vendorId") ?? null;
  return {
    wedding_id: weddingId,
    vendor_id: vendorId,
    name: requireString(body, "name"),
    valid_through: optionalDateString(body, "validThrough") ?? null,
    notes: optionalString(body, "notes") ?? null,
  };
}

function buildOfferPatch(body) {
  body = body || {};
  const patch = {};
  const name = optionalString(body, "name");
  const vendorId = optionalString(body, "vendorId");
  const validThrough = optionalDateString(body, "validThrough");
  const notes = optionalString(body, "notes");

  if (name !== undefined) patch.name = name;
  if (vendorId !== undefined) patch.vendor_id = vendorId;
  if (validThrough !== undefined) patch.valid_through = validThrough;
  if (notes !== undefined) patch.notes = notes;

  return requireAtLeastOne(patch);
}

async function insertRows(table, rows) {
  if (rows.length === 0) return [];
  const { data, error } = await supabase.from(table).insert(rows).select("*");
  if (error) throw error;
  return data;
}

async function createPresetOffer(weddingId, body) {
  const preset = presets[body.preset];
  if (!preset) throw new BadRequestError("unknown catering preset");

  const offerInsert = buildOfferInsert(body, weddingId);
  await assertOfferNameAvailable(weddingId, offerInsert.name);
  await assertWeddingRecordExists("vendors", offerInsert.vendor_id, weddingId, "vendorId");

  const { data: offer, error: offerError } = await supabase
    .from("catering_offers")
    .insert(offerInsert)
    .select("*")
    .single();
  if (offerError) throw offerError;

  try {
    const dishRows = preset.dishes.map((dish) => ({
      catering_offer_id: offer.id,
      name: dish.name,
      description: dish.description || null,
      is_vegetarian: Boolean(dish.isVegetarian),
      is_vegan: Boolean(dish.isVegan),
      is_gluten_free: Boolean(dish.isGlutenFree),
      allergens: dish.allergens || [],
    }));
    const dishes = await insertRows("catering_dishes", dishRows);
    const dishByKey = new Map(preset.dishes.map((dish, index) => [dish.key, dishes[index]]));

    const packageRows = preset.packages.map((pkg) => ({
      catering_offer_id: offer.id,
      name: pkg.name,
      price_per_person: pkg.pricePerPerson,
      is_modifiable: pkg.isModifiable,
      description: pkg.description || null,
      sort_order: pkg.sortOrder,
    }));
    const packages = await insertRows("catering_packages", packageRows);
    const packageByKey = new Map(preset.packages.map((pkg, index) => [pkg.key, packages[index]]));

    const courseRows = preset.courses.map((course) => ({
      catering_package_id: packageByKey.get(course.packageKey).id,
      course_type: course.courseType,
      title: course.title,
      selection_mode: course.selectionMode,
      choice_limit: course.choiceLimit,
      sort_order: course.sortOrder,
    }));
    const courses = await insertRows("catering_courses", courseRows);
    const courseByKey = new Map(preset.courses.map((course, index) => [course.key, courses[index]]));

    await insertRows(
      "catering_course_dishes",
      preset.links.map((link) => ({
        catering_course_id: courseByKey.get(link.courseKey).id,
        catering_dish_id: dishByKey.get(link.dishKey).id,
        sort_order: link.sortOrder,
      })),
    );

    await insertRows(
      "catering_addons",
      preset.addons.map((addon) => ({
        catering_offer_id: offer.id,
        name: addon.name,
        price: addon.price,
        pricing_unit: addon.pricingUnit,
        description: addon.description || null,
        sort_order: addon.sortOrder,
      })),
    );
  } catch (err) {
    await supabase.from("catering_offers").delete().eq("id", offer.id);
    throw err;
  }

  return loadOfferFull(offer, weddingId);
}

async function cascadeOfferDelete(offerId) {
  const { data: packages } = await supabase
    .from("catering_packages")
    .select("id")
    .eq("catering_offer_id", offerId);
  const packageIds = (packages || []).map((pkg) => pkg.id);
  const { data: courses } =
    packageIds.length > 0
      ? await supabase.from("catering_courses").select("id").in("catering_package_id", packageIds)
      : { data: [] };
  const courseIds = (courses || []).map((course) => course.id);

  if (courseIds.length > 0) {
    await supabase.from("catering_course_dishes").delete().in("catering_course_id", courseIds);
    await supabase.from("catering_courses").delete().in("id", courseIds);
  }
  await supabase.from("catering_dishes").delete().eq("catering_offer_id", offerId);
  await supabase.from("catering_addons").delete().eq("catering_offer_id", offerId);
  if (packageIds.length > 0) await supabase.from("catering_packages").delete().in("id", packageIds);
}

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("catering_offers")
      .select("*")
      .eq("wedding_id", req.params.weddingId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    const [vendorsById, counts] = await Promise.all([
      loadVendorsById(req.params.weddingId, data.map((offer) => offer.vendor_id)),
      loadOfferCounts(data),
    ]);

    res.json(
      data.map((offer) =>
        mapCateringOffer(offer, vendorsById.get(offer.vendor_id) || null, counts.get(offer.id)),
      ),
    );
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (req.body?.preset) {
      res.status(201).json(await createPresetOffer(req.params.weddingId, req.body));
      return;
    }

    const insert = buildOfferInsert(req.body, req.params.weddingId);
    await assertOfferNameAvailable(req.params.weddingId, insert.name);
    await assertWeddingRecordExists("vendors", insert.vendor_id, req.params.weddingId, "vendorId");

    const { data, error } = await supabase.from("catering_offers").insert(insert).select("*").single();
    if (error) throw error;
    const vendorsById = await loadVendorsById(req.params.weddingId, [data.vendor_id]);
    res.status(201).json(mapCateringOffer(data, vendorsById.get(data.vendor_id) || null));
  } catch (err) {
    next(err);
  }
});

router.get("/:offerId", async (req, res, next) => {
  try {
    const offer = await loadOfferForWedding(req.params.offerId, req.params.weddingId);
    res.json(await loadOfferFull(offer, req.params.weddingId));
  } catch (err) {
    next(err);
  }
});

router.patch("/:offerId", async (req, res, next) => {
  try {
    await loadOfferForWedding(req.params.offerId, req.params.weddingId);
    const patch = buildOfferPatch(req.body);
    await assertWeddingRecordExists("vendors", patch.vendor_id, req.params.weddingId, "vendorId");

    const { data, error } = await supabase
      .from("catering_offers")
      .update(patch)
      .eq("id", req.params.offerId)
      .eq("wedding_id", req.params.weddingId)
      .select("*")
      .single();

    if (error) throw error;
    const vendorsById = await loadVendorsById(req.params.weddingId, [data.vendor_id]);
    res.json(mapCateringOffer(data, vendorsById.get(data.vendor_id) || null));
  } catch (err) {
    next(err);
  }
});

router.delete("/:offerId", async (req, res, next) => {
  try {
    const offer = await loadOfferForWedding(req.params.offerId, req.params.weddingId);
    const { data: packages, error: packagesError } = await supabase
      .from("catering_packages")
      .select("id")
      .eq("catering_offer_id", offer.id);
    if (packagesError) throw packagesError;

    const packageIds = packages.map((pkg) => pkg.id);
    if (packageIds.length > 0) {
      const { data: selections, error: selectionError } = await supabase
        .from("wedding_catering_selection")
        .select("id,catering_package_id")
        .eq("wedding_id", req.params.weddingId)
        .in("catering_package_id", packageIds);
      if (selectionError) throw selectionError;
      if (selections.length > 0) throw new ConflictError("catering offer has active selection");
    }

    const { data, error } = await supabase
      .from("catering_offers")
      .delete()
      .eq("id", offer.id)
      .eq("wedding_id", req.params.weddingId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Catering offer not found");
    await cascadeOfferDelete(offer.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
