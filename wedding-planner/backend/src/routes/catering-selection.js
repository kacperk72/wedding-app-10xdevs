const express = require("express");
const { supabase } = require("../config/database");
const { BadRequestError, NotFoundError } = require("../errors/domain-errors");
const { requireWeddingMember } = require("../middleware/wedding-member");
const {
  loadAddonForWedding,
  loadCourseForWedding,
  loadDishForWedding,
  loadPackageForWedding,
  loadSelectionForWedding,
} = require("../utils/catering-guards");
const { mapCateringSelection, mapContract, mapPayment, mapPriceBreakdown } = require("../utils/mappers");
const {
  dateString,
  enumValue,
  optionalDateString,
  optionalInteger,
  optionalString,
  requireString,
} = require("../utils/request-validation");

const router = express.Router({ mergeParams: true });
const PAYMENT_METHODS = ["gotowka", "przelew"];

router.use(requireWeddingMember());

function requireAmount(value, key) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new BadRequestError(`${key} must be a non-negative number`);
  }
  return value;
}

function requirePositiveInteger(body, key) {
  const value = optionalInteger(body, key);
  if (value === undefined || value < 1) throw new BadRequestError(`${key} must be a positive integer`);
  return value;
}

async function deleteSelectionRows(selectionId) {
  await supabase.from("wedding_catering_dish_picks").delete().eq("wedding_catering_selection_id", selectionId);
  await supabase.from("wedding_catering_addon_picks").delete().eq("wedding_catering_selection_id", selectionId);
  await supabase.from("wedding_catering_selection").delete().eq("id", selectionId);
}

async function loadSelectionResolved(weddingId, { required = true } = {}) {
  const selection = await loadSelectionForWedding(weddingId, { required });
  if (!selection) return null;

  const pkg = await loadPackageForWedding(selection.catering_package_id, weddingId);
  const [dishPicksResult, addonPicksResult] = await Promise.all([
    supabase
      .from("wedding_catering_dish_picks")
      .select("*")
      .eq("wedding_catering_selection_id", selection.id),
    supabase
      .from("wedding_catering_addon_picks")
      .select("*")
      .eq("wedding_catering_selection_id", selection.id),
  ]);
  if (dishPicksResult.error) throw dishPicksResult.error;
  if (addonPicksResult.error) throw addonPicksResult.error;

  const dishIds = [...new Set(dishPicksResult.data.map((pick) => pick.catering_dish_id))];
  const addonIds = [...new Set(addonPicksResult.data.map((pick) => pick.catering_addon_id))];
  const [dishesResult, addonsResult] = await Promise.all([
    dishIds.length > 0
      ? supabase.from("catering_dishes").select("*").in("id", dishIds)
      : Promise.resolve({ data: [], error: null }),
    addonIds.length > 0
      ? supabase.from("catering_addons").select("*").in("id", addonIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (dishesResult.error) throw dishesResult.error;
  if (addonsResult.error) throw addonsResult.error;

  const dishesById = new Map(dishesResult.data.map((dish) => [dish.id, dish]));
  const addonsById = new Map(addonsResult.data.map((addon) => [addon.id, addon]));
  return mapCateringSelection(
    selection,
    dishPicksResult.data.map((pick) => ({ ...pick, dish: dishesById.get(pick.catering_dish_id) || null })),
    addonPicksResult.data.map((pick) => ({ ...pick, addon: addonsById.get(pick.catering_addon_id) || null })),
    pkg,
  );
}

async function computePrice(weddingId) {
  const selection = await loadSelectionForWedding(weddingId);
  const pkg = await loadPackageForWedding(selection.catering_package_id, weddingId);
  const { data: picks, error } = await supabase
    .from("wedding_catering_addon_picks")
    .select("*")
    .eq("wedding_catering_selection_id", selection.id);
  if (error) throw error;

  const addonIds = picks.map((pick) => pick.catering_addon_id);
  const { data: addons, error: addonsError } =
    addonIds.length > 0
      ? await supabase.from("catering_addons").select("*").in("id", addonIds)
      : { data: [], error: null };
  if (addonsError) throw addonsError;
  const addonsById = new Map(addons.map((addon) => [addon.id, addon]));

  return mapPriceBreakdown(
    pkg.price_per_person,
    selection.guest_count_estimate,
    picks
      .map((pick) => {
        const addon = addonsById.get(pick.catering_addon_id);
        if (!addon) return null;
        return {
          id: addon.id,
          name: addon.name,
          price: addon.price,
          pricingUnit: addon.pricing_unit,
          quantity: pick.quantity,
        };
      })
      .filter(Boolean),
  );
}

async function loadCourseDishLink(courseId, dishId) {
  const { data, error } = await supabase
    .from("catering_course_dishes")
    .select("catering_course_id,catering_dish_id")
    .eq("catering_course_id", courseId)
    .eq("catering_dish_id", dishId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadVendorForFreeze(vendorId, weddingId) {
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", vendorId)
    .eq("wedding_id", weddingId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new BadRequestError("vendorId does not belong to this wedding");
  if (!["sala", "catering"].includes(data.category)) {
    throw new BadRequestError("vendor category must be sala or catering");
  }
  return data;
}

function parsePaymentLeg(input, label) {
  if (!input) return null;
  return {
    amount: requireAmount(input.amount, `${label}.amount`),
    dueDate: dateString(requireString(input, "dueDate"), `${label}.dueDate`),
    method: enumValue(requireString(input, "method"), PAYMENT_METHODS, `${label}.method`),
  };
}

router.get("/", async (req, res, next) => {
  try {
    const selection = await loadSelectionResolved(req.params.weddingId, { required: false });
    if (!selection) {
      res.json(null);
      return;
    }
    res.json({ ...selection, price: await computePrice(req.params.weddingId) });
  } catch (err) {
    next(err);
  }
});

router.put("/", async (req, res, next) => {
  try {
    const packageId = requireString(req.body, "packageId");
    await loadPackageForWedding(packageId, req.params.weddingId);
    const guestCountEstimate = optionalInteger(req.body, "guestCountEstimate") ?? 0;
    if (guestCountEstimate < 0) throw new BadRequestError("guestCountEstimate must be greater than or equal to 0");

    const existing = await loadSelectionForWedding(req.params.weddingId, { required: false });
    if (existing && existing.catering_package_id !== packageId) {
      await deleteSelectionRows(existing.id);
    }

    let data;
    if (existing && existing.catering_package_id === packageId) {
      const result = await supabase
        .from("wedding_catering_selection")
        .update({
          guest_count_estimate: guestCountEstimate,
          notes: optionalString(req.body, "notes") ?? existing.notes,
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (result.error) throw result.error;
      data = result.data;
    } else {
      const result = await supabase
        .from("wedding_catering_selection")
        .insert({
          wedding_id: req.params.weddingId,
          catering_package_id: packageId,
          guest_count_estimate: guestCountEstimate,
          notes: optionalString(req.body, "notes") ?? null,
        })
        .select("*")
        .single();
      if (result.error) throw result.error;
      data = result.data;
    }

    const mapped = await loadSelectionResolved(req.params.weddingId);
    res.json({ ...mapped, id: data.id, price: await computePrice(req.params.weddingId) });
  } catch (err) {
    next(err);
  }
});

router.delete("/", async (req, res, next) => {
  try {
    const selection = await loadSelectionForWedding(req.params.weddingId);
    await deleteSelectionRows(selection.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/dish-picks", async (req, res, next) => {
  try {
    const selection = await loadSelectionForWedding(req.params.weddingId);
    const course = await loadCourseForWedding(requireString(req.body, "courseId"), req.params.weddingId);
    const dish = await loadDishForWedding(requireString(req.body, "dishId"), req.params.weddingId);

    if (course.catering_package_id !== selection.catering_package_id) {
      throw new BadRequestError("course does not belong to selected package");
    }
    if (course.selection_mode === "all_served") {
      throw new BadRequestError("course does not accept picks");
    }
    if (dish.catering_offer_id !== course.package.catering_offer_id) {
      throw new BadRequestError("dish does not belong to selected offer");
    }
    if (!(await loadCourseDishLink(course.id, dish.id))) {
      throw new BadRequestError("dish is not available in course");
    }

    const { data: existing, error: existingError } = await supabase
      .from("wedding_catering_dish_picks")
      .select("*")
      .eq("wedding_catering_selection_id", selection.id)
      .eq("catering_course_id", course.id);
    if (existingError) throw existingError;
    if (
      course.choice_limit !== null &&
      existing.length >= Number(course.choice_limit) &&
      !existing.some((pick) => pick.catering_dish_id === dish.id)
    ) {
      throw new BadRequestError("course choice limit reached");
    }

    const duplicate = existing.find((pick) => pick.catering_dish_id === dish.id);
    if (duplicate) {
      res.status(200).json(duplicate);
      return;
    }

    const { data, error } = await supabase
      .from("wedding_catering_dish_picks")
      .insert({
        wedding_catering_selection_id: selection.id,
        catering_course_id: course.id,
        catering_dish_id: dish.id,
      })
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.delete("/dish-picks/:courseId/:dishId", async (req, res, next) => {
  try {
    const selection = await loadSelectionForWedding(req.params.weddingId);
    const { data, error } = await supabase
      .from("wedding_catering_dish_picks")
      .delete()
      .eq("wedding_catering_selection_id", selection.id)
      .eq("catering_course_id", req.params.courseId)
      .eq("catering_dish_id", req.params.dishId)
      .select("catering_course_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Catering dish pick not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.put("/addon-picks/:addonId", async (req, res, next) => {
  try {
    const selection = await loadSelectionForWedding(req.params.weddingId);
    const pkg = await loadPackageForWedding(selection.catering_package_id, req.params.weddingId);
    const addon = await loadAddonForWedding(req.params.addonId, req.params.weddingId);
    if (addon.catering_offer_id !== pkg.catering_offer_id) {
      throw new BadRequestError("addon does not belong to selected offer");
    }
    const quantity = requirePositiveInteger(req.body, "quantity");

    const { data: existing, error: existingError } = await supabase
      .from("wedding_catering_addon_picks")
      .select("*")
      .eq("wedding_catering_selection_id", selection.id)
      .eq("catering_addon_id", addon.id)
      .maybeSingle();
    if (existingError) throw existingError;

    const query = existing
      ? supabase
          .from("wedding_catering_addon_picks")
          .update({ quantity })
          .eq("wedding_catering_selection_id", selection.id)
          .eq("catering_addon_id", addon.id)
      : supabase.from("wedding_catering_addon_picks").insert({
          wedding_catering_selection_id: selection.id,
          catering_addon_id: addon.id,
          quantity,
        });
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.delete("/addon-picks/:addonId", async (req, res, next) => {
  try {
    const selection = await loadSelectionForWedding(req.params.weddingId);
    const { data, error } = await supabase
      .from("wedding_catering_addon_picks")
      .delete()
      .eq("wedding_catering_selection_id", selection.id)
      .eq("catering_addon_id", req.params.addonId)
      .select("catering_addon_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Catering addon pick not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get("/price", async (req, res, next) => {
  try {
    res.json(await computePrice(req.params.weddingId));
  } catch (err) {
    next(err);
  }
});

router.post("/sync-meal-options", async (req, res, next) => {
  try {
    const selection = await loadSelectionForWedding(req.params.weddingId);
    const { data: courses, error: coursesError } = await supabase
      .from("catering_courses")
      .select("*")
      .eq("catering_package_id", selection.catering_package_id)
      .eq("selection_mode", "guest_picks");
    if (coursesError) throw coursesError;

    const courseIds = courses.map((course) => course.id);
    const { data: picks, error: picksError } =
      courseIds.length > 0
        ? await supabase
            .from("wedding_catering_dish_picks")
            .select("*")
            .eq("wedding_catering_selection_id", selection.id)
            .in("catering_course_id", courseIds)
        : { data: [], error: null };
    if (picksError) throw picksError;

    const dishIds = [...new Set(picks.map((pick) => pick.catering_dish_id))];
    const { data: dishes, error: dishesError } =
      dishIds.length > 0
        ? await supabase.from("catering_dishes").select("*").in("id", dishIds)
        : { data: [], error: null };
    if (dishesError) throw dishesError;
    const dishesById = new Map(dishes.map((dish) => [dish.id, dish]));

    const { data: mealOptions, error: mealError } = await supabase
      .from("meal_options")
      .select("*")
      .eq("wedding_id", req.params.weddingId);
    if (mealError) throw mealError;

    const existingByLabel = new Map(mealOptions.map((option) => [option.label, option]));
    let created = 0;
    let updated = 0;
    let sortOrder = 1;
    const desiredLabels = new Set();

    for (const pick of picks) {
      const dish = dishesById.get(pick.catering_dish_id);
      if (!dish) continue;
      desiredLabels.add(dish.name);
      const existing = existingByLabel.get(dish.name);
      if (existing) {
        if (Number(existing.sort_order) !== sortOrder) {
          const { error } = await supabase
            .from("meal_options")
            .update({ sort_order: sortOrder })
            .eq("id", existing.id)
            .eq("wedding_id", req.params.weddingId);
          if (error) throw error;
          updated += 1;
        }
      } else {
        const { error } = await supabase.from("meal_options").insert({
          wedding_id: req.params.weddingId,
          label: dish.name,
          sort_order: sortOrder,
        });
        if (error) throw error;
        created += 1;
      }
      sortOrder += 1;
    }

    res.json({
      created,
      updated,
      skippedManual: mealOptions.filter((option) => !desiredLabels.has(option.label)).length,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/freeze-into-contract", async (req, res, next) => {
  let contract = null;
  const payments = [];
  try {
    const selection = await loadSelectionForWedding(req.params.weddingId);
    const vendor = await loadVendorForFreeze(requireString(req.body, "vendorId"), req.params.weddingId);
    const price = await computePrice(req.params.weddingId);
    const deposit = parsePaymentLeg(req.body?.deposit, "deposit");
    const finalPayment = parsePaymentLeg(req.body?.finalPayment, "finalPayment");
    if (deposit && finalPayment && Math.abs(deposit.amount + finalPayment.amount - price.total) > 0.01) {
      throw new BadRequestError("deposit.amount + finalPayment.amount must equal computed total");
    }

    const contractResult = await supabase
      .from("contracts")
      .insert({
        wedding_id: req.params.weddingId,
        vendor_id: vendor.id,
        wedding_catering_selection_id: selection.id,
        total_amount: price.total,
        signed_date: optionalDateString(req.body, "signedDate") ?? null,
        status: "pending",
      })
      .select("*")
      .single();
    if (contractResult.error) throw contractResult.error;
    contract = contractResult.data;

    for (const [kind, leg] of [
      ["zaliczka", deposit],
      ["final", finalPayment],
    ]) {
      if (!leg) continue;
      const paymentResult = await supabase
        .from("payments")
        .insert({
          contract_id: contract.id,
          kind,
          due_date: leg.dueDate,
          amount: leg.amount,
          status: "planned",
          method: leg.method,
        })
        .select("*")
        .single();
      if (paymentResult.error) throw paymentResult.error;
      payments.push(paymentResult.data);
    }

    res.status(201).json({
      contract: mapContract({ ...contract, vendors: vendor, payments }),
      payments: payments.map((payment) => mapPayment(payment, vendor)),
    });
  } catch (err) {
    for (const payment of payments.reverse()) {
      await supabase.from("payments").delete().eq("id", payment.id);
    }
    if (contract) await supabase.from("contracts").delete().eq("id", contract.id);
    next(err);
  }
});

module.exports = router;
