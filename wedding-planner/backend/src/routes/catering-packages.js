const express = require("express");
const { supabase } = require("../config/database");
const { BadRequestError, NotFoundError } = require("../errors/domain-errors");
const { requireWeddingMember } = require("../middleware/wedding-member");
const {
  loadCourseForWedding,
  loadDishForWedding,
  loadOfferForWedding,
  loadPackageForWedding,
} = require("../utils/catering-guards");
const { mapCateringCourse, mapCateringPackage } = require("../utils/mappers");
const {
  enumValue,
  optionalBoolean,
  optionalInteger,
  optionalNonEmptyString,
  optionalString,
  requireAtLeastOne,
  requireString,
} = require("../utils/request-validation");

const router = express.Router({ mergeParams: true });

const COURSE_TYPES = [
  "obiad_zupa",
  "obiad_danie_glowne",
  "obiad_deser",
  "przystawka",
  "kolacja_ciepla",
  "deser_serwowany",
  "bufet_zimny",
  "bufet_salatkowy",
  "dodatki",
  "surowki",
  "wiejski_stol",
  "slodki_stol",
  "napoje",
  "inne",
];
const SELECTION_MODES = ["all_served", "couple_picks", "guest_picks"];

function requireAmount(body, key) {
  if (!body || typeof body[key] !== "number" || !Number.isFinite(body[key]) || body[key] < 0) {
    throw new BadRequestError(`${key} must be a non-negative number`);
  }
  return body[key];
}

function optionalAmount(body, key) {
  if (!body || body[key] === undefined) return undefined;
  if (typeof body[key] !== "number" || !Number.isFinite(body[key]) || body[key] < 0) {
    throw new BadRequestError(`${key} must be a non-negative number`);
  }
  return body[key];
}

function buildPackagePatch(body) {
  body = body || {};
  const patch = {};
  const name = optionalNonEmptyString(body, "name");
  const price = optionalAmount(body, "pricePerPerson");
  const isModifiable = optionalBoolean(body, "isModifiable");
  const description = optionalString(body, "description");
  const sortOrder = optionalInteger(body, "sortOrder");

  if (name !== undefined) patch.name = name;
  if (price !== undefined) patch.price_per_person = price;
  if (isModifiable !== undefined) patch.is_modifiable = isModifiable;
  if (description !== undefined) patch.description = description;
  if (sortOrder !== undefined) patch.sort_order = sortOrder;

  return requireAtLeastOne(patch);
}

function normalizeCoursePatch(patch) {
  if (patch.selection_mode === "all_served") patch.choice_limit = null;
  if (patch.selection_mode && patch.selection_mode !== "all_served" && patch.choice_limit == null) {
    throw new BadRequestError("choiceLimit is required unless selectionMode is all_served");
  }
  if (patch.choice_limit !== undefined && patch.choice_limit !== null && patch.choice_limit < 1) {
    throw new BadRequestError("choiceLimit must be greater than 0");
  }
  return patch;
}

function buildCoursePatch(body) {
  body = body || {};
  const patch = {};
  const courseType = optionalString(body, "courseType");
  const title = optionalNonEmptyString(body, "title");
  const selectionMode = optionalString(body, "selectionMode");
  const choiceLimit = optionalInteger(body, "choiceLimit");
  const sortOrder = optionalInteger(body, "sortOrder");

  if (courseType !== undefined) patch.course_type = enumValue(courseType, COURSE_TYPES, "courseType");
  if (title !== undefined) patch.title = title;
  if (selectionMode !== undefined) {
    patch.selection_mode = enumValue(selectionMode, SELECTION_MODES, "selectionMode");
  }
  if (choiceLimit !== undefined) patch.choice_limit = choiceLimit;
  if (sortOrder !== undefined) patch.sort_order = sortOrder;

  return normalizeCoursePatch(requireAtLeastOne(patch));
}

router.use(requireWeddingMember());

router.post("/offers/:offerId/packages", async (req, res, next) => {
  try {
    const offer = await loadOfferForWedding(req.params.offerId, req.params.weddingId);
    const insert = {
      catering_offer_id: offer.id,
      name: requireString(req.body, "name"),
      price_per_person: requireAmount(req.body, "pricePerPerson"),
      is_modifiable: optionalBoolean(req.body, "isModifiable") ?? true,
      description: optionalString(req.body, "description") ?? null,
      sort_order: optionalInteger(req.body, "sortOrder") ?? 0,
    };

    const { data, error } = await supabase
      .from("catering_packages")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json(mapCateringPackage(data));
  } catch (err) {
    next(err);
  }
});

router.patch("/:packageId", async (req, res, next) => {
  try {
    await loadPackageForWedding(req.params.packageId, req.params.weddingId);
    const { data, error } = await supabase
      .from("catering_packages")
      .update(buildPackagePatch(req.body))
      .eq("id", req.params.packageId)
      .select("*")
      .single();
    if (error) throw error;
    res.json(mapCateringPackage(data));
  } catch (err) {
    next(err);
  }
});

router.delete("/:packageId", async (req, res, next) => {
  try {
    await loadPackageForWedding(req.params.packageId, req.params.weddingId);
    const { data, error } = await supabase
      .from("catering_packages")
      .delete()
      .eq("id", req.params.packageId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Catering package not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/:packageId/courses", async (req, res, next) => {
  try {
    const pkg = await loadPackageForWedding(req.params.packageId, req.params.weddingId);
    const selectionMode = enumValue(requireString(req.body, "selectionMode"), SELECTION_MODES, "selectionMode");
    const choiceLimit =
      selectionMode === "all_served" ? null : optionalInteger(req.body, "choiceLimit") ?? 1;
    const insert = normalizeCoursePatch({
      catering_package_id: pkg.id,
      course_type: enumValue(requireString(req.body, "courseType"), COURSE_TYPES, "courseType"),
      title: requireString(req.body, "title"),
      selection_mode: selectionMode,
      choice_limit: choiceLimit,
      sort_order: optionalInteger(req.body, "sortOrder") ?? 0,
    });

    const { data, error } = await supabase
      .from("catering_courses")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json(mapCateringCourse(data));
  } catch (err) {
    next(err);
  }
});

router.patch("/:courseId", async (req, res, next) => {
  try {
    await loadCourseForWedding(req.params.courseId, req.params.weddingId);
    const { data, error } = await supabase
      .from("catering_courses")
      .update(buildCoursePatch(req.body))
      .eq("id", req.params.courseId)
      .select("*")
      .single();
    if (error) throw error;
    res.json(mapCateringCourse(data));
  } catch (err) {
    next(err);
  }
});

router.delete("/:courseId", async (req, res, next) => {
  try {
    await loadCourseForWedding(req.params.courseId, req.params.weddingId);
    await supabase.from("catering_course_dishes").delete().eq("catering_course_id", req.params.courseId);
    const { data, error } = await supabase
      .from("catering_courses")
      .delete()
      .eq("id", req.params.courseId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Catering course not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/:courseId/dishes", async (req, res, next) => {
  try {
    const course = await loadCourseForWedding(req.params.courseId, req.params.weddingId);
    const dishId = requireString(req.body, "cateringDishId");
    const dish = await loadDishForWedding(dishId, req.params.weddingId);
    if (dish.catering_offer_id !== course.package.catering_offer_id) {
      throw new BadRequestError("dish does not belong to this catering offer");
    }

    const { data, error } = await supabase
      .from("catering_course_dishes")
      .insert({
        catering_course_id: course.id,
        catering_dish_id: dish.id,
        sort_order: optionalInteger(req.body, "sortOrder") ?? 0,
      })
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.delete("/:courseId/dishes/:dishId", async (req, res, next) => {
  try {
    await loadCourseForWedding(req.params.courseId, req.params.weddingId);
    await loadDishForWedding(req.params.dishId, req.params.weddingId);

    const { data, error } = await supabase
      .from("catering_course_dishes")
      .delete()
      .eq("catering_course_id", req.params.courseId)
      .eq("catering_dish_id", req.params.dishId)
      .select("catering_course_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Course dish link not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
