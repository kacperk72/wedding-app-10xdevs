const { supabase } = require("../config/database");
const { ConflictError, NotFoundError } = require("../errors/domain-errors");

async function loadOfferForWedding(offerId, weddingId) {
  const { data, error } = await supabase
    .from("catering_offers")
    .select("*")
    .eq("id", offerId)
    .eq("wedding_id", weddingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new NotFoundError("Catering offer not found");
  return data;
}

async function loadPackageForWedding(packageId, weddingId) {
  const { data, error } = await supabase
    .from("catering_packages")
    .select("*")
    .eq("id", packageId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new NotFoundError("Catering package not found");
  const offer = await loadOfferForWedding(data.catering_offer_id, weddingId);
  return { ...data, offer };
}

async function loadCourseForWedding(courseId, weddingId) {
  const { data, error } = await supabase
    .from("catering_courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new NotFoundError("Catering course not found");
  const pkg = await loadPackageForWedding(data.catering_package_id, weddingId);
  return { ...data, package: pkg };
}

async function loadDishForWedding(dishId, weddingId) {
  const { data, error } = await supabase
    .from("catering_dishes")
    .select("*")
    .eq("id", dishId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new NotFoundError("Catering dish not found");
  await loadOfferForWedding(data.catering_offer_id, weddingId);
  return data;
}

async function loadAddonForWedding(addonId, weddingId) {
  const { data, error } = await supabase
    .from("catering_addons")
    .select("*")
    .eq("id", addonId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new NotFoundError("Catering addon not found");
  await loadOfferForWedding(data.catering_offer_id, weddingId);
  return data;
}

async function loadSelectionForWedding(weddingId, { required = true } = {}) {
  const { data, error } = await supabase
    .from("wedding_catering_selection")
    .select("*")
    .eq("wedding_id", weddingId)
    .maybeSingle();

  if (error) throw error;
  if (!data && required) throw new NotFoundError("Catering selection not found");
  return data;
}

async function assertOfferNameAvailable(weddingId, name) {
  const { data, error } = await supabase
    .from("catering_offers")
    .select("id")
    .eq("wedding_id", weddingId)
    .eq("name", name)
    .maybeSingle();

  if (error) throw error;
  if (data) throw new ConflictError("catering offer with this name already exists");
}

module.exports = {
  assertOfferNameAvailable,
  loadAddonForWedding,
  loadCourseForWedding,
  loadDishForWedding,
  loadOfferForWedding,
  loadPackageForWedding,
  loadSelectionForWedding,
};
