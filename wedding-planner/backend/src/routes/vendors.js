const express = require("express");
const { supabase } = require("../config/database");
const { BadRequestError, NotFoundError } = require("../errors/domain-errors");
const { requireWeddingMember } = require("../middleware/wedding-member");
const { mapVendor } = require("../utils/mappers");
const {
  enumValue,
  optionalEnum,
  optionalNonEmptyString,
  optionalString,
  requireAtLeastOne,
  requireString,
} = require("../utils/request-validation");

const router = express.Router({ mergeParams: true });

const VENDOR_CATEGORIES = [
  "sala",
  "catering",
  "fotograf",
  "dj",
  "kwiaciarz",
  "usc",
  "ksiadz",
  "makijaz",
  "dekoracje",
  "tort",
];
const VENDOR_STATUSES = ["rozwazany", "spotkanie", "zarezerwowany", "zaplacony", "wykonany"];
const SECURED_STATUSES = ["zarezerwowany", "zaplacony", "wykonany"];

function optionalAmount(body, key) {
  if (!body || body[key] === undefined) return undefined;
  if (body[key] === null) return null;
  if (typeof body[key] !== "number" || !Number.isFinite(body[key]) || body[key] < 0) {
    throw new BadRequestError(`${key} must be a non-negative number`);
  }
  return body[key];
}

function buildVendorPatch(body) {
  body = body || {};
  const patch = {};
  const category = optionalEnum(body, "category", VENDOR_CATEGORIES);
  const companyName = optionalNonEmptyString(body, "companyName");
  const contactPerson = optionalString(body, "contactPerson");
  const phone = optionalString(body, "phone");
  const email = optionalString(body, "email");
  const status = optionalEnum(body, "status", VENDOR_STATUSES);
  const contractAmount = optionalAmount(body, "contractAmount");
  const notes = optionalString(body, "notes");

  if (category !== undefined) patch.category = category;
  if (companyName !== undefined) patch.company_name = companyName;
  if (contactPerson !== undefined) patch.contact_person = contactPerson;
  if (phone !== undefined) patch.phone = phone;
  if (email !== undefined) patch.email = email;
  if (status !== undefined) patch.status = status;
  if (contractAmount !== undefined) patch.contract_amount = contractAmount;
  if (notes !== undefined) patch.notes = notes;

  return requireAtLeastOne(patch);
}

async function attachContractFlags(vendors) {
  const ids = vendors.map((vendor) => vendor.id);
  if (ids.length === 0) return vendors;

  const { data, error } = await supabase
    .from("contracts")
    .select("id, vendor_id")
    .in("vendor_id", ids);
  if (error) throw error;
  const contractVendorIds = new Set(data.map((contract) => contract.vendor_id));
  return vendors.map((vendor) => ({ ...vendor, has_contract: contractVendorIds.has(vendor.id) }));
}

router.use(requireWeddingMember());

router.get("/missing", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("vendors")
      .select("category, status")
      .eq("wedding_id", req.params.weddingId);

    if (error) throw error;
    const secured = new Set(
      data
        .filter((vendor) => SECURED_STATUSES.includes(vendor.status))
        .map((vendor) => vendor.category),
    );
    res.json(VENDOR_CATEGORIES.filter((category) => !secured.has(category)));
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    let query = supabase
      .from("vendors")
      .select("*")
      .eq("wedding_id", req.params.weddingId)
      .order("category", { ascending: true })
      .order("company_name", { ascending: true });

    if (req.query.status) query = query.eq("status", req.query.status);
    if (req.query.category) query = query.eq("category", req.query.category);

    const { data, error } = await query;
    if (error) throw error;
    res.json((await attachContractFlags(data)).map(mapVendor));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const insert = {
      wedding_id: req.params.weddingId,
      category: enumValue(requireString(req.body, "category"), VENDOR_CATEGORIES, "category"),
      company_name: requireString(req.body, "companyName"),
      contact_person: optionalString(req.body, "contactPerson") ?? null,
      phone: optionalString(req.body, "phone") ?? null,
      email: optionalString(req.body, "email") ?? null,
      // New leads start as considered until the couple books or rejects them.
      status: optionalEnum(req.body, "status", VENDOR_STATUSES) ?? "rozwazany",
      contract_amount: optionalAmount(req.body, "contractAmount") ?? null,
      notes: optionalString(req.body, "notes") ?? null,
    };

    const { data, error } = await supabase.from("vendors").insert(insert).select("*").single();
    if (error) throw error;
    res.status(201).json(mapVendor((await attachContractFlags([data]))[0]));
  } catch (err) {
    next(err);
  }
});

router.patch("/:vendorId", async (req, res, next) => {
  try {
    const patch = buildVendorPatch(req.body);
    const { data, error } = await supabase
      .from("vendors")
      .update(patch)
      .eq("id", req.params.vendorId)
      .eq("wedding_id", req.params.weddingId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Vendor not found");
    res.json(mapVendor((await attachContractFlags([data]))[0]));
  } catch (err) {
    next(err);
  }
});

router.delete("/:vendorId", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("vendors")
      .delete()
      .eq("id", req.params.vendorId)
      .eq("wedding_id", req.params.weddingId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Vendor not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
