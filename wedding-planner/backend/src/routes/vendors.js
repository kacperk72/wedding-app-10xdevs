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
  "dekoratorka",
  "kosciol",
  "makijaz",
  "dekoracje",
  "slodki_stol_tort",
  "ciasta_pozegnalne",
];
const VENDOR_STATUSES = [
  "rozwazany",
  "spotkanie",
  "zarezerwowany",
  "umowa_podpisana",
  "zaliczka_wplacona",
  "oplacony",
  "zrealizowany",
];
const PAYMENT_METHODS = ["gotowka", "przelew"];

function optionalAmount(body, key) {
  if (!body || body[key] === undefined) return undefined;
  if (body[key] === null) return null;
  if (typeof body[key] !== "number" || !Number.isFinite(body[key]) || body[key] < 0) {
    throw new BadRequestError(`${key} must be a non-negative number`);
  }
  return body[key];
}

function requireAmount(value, key) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new BadRequestError(`${key} must be a non-negative number`);
  }
  return value;
}

function parsePaymentLeg(input, label) {
  if (!input || typeof input !== "object") {
    throw new BadRequestError(`${label} must be an object`);
  }
  const amount = requireAmount(input.amount, `${label}.amount`);
  const dueDate = requireString(input, "dueDate");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new BadRequestError(`${label}.dueDate must be YYYY-MM-DD`);
  }
  const method = input.method;
  if (!PAYMENT_METHODS.includes(method)) {
    throw new BadRequestError(`${label}.method must be one of: ${PAYMENT_METHODS.join(", ")}`);
  }
  return { amount, dueDate, method };
}

// Optional contract bundle: { totalAmount, signedDate?, deposit?, finalPayment? }
// At least one of deposit/finalPayment must be present when contract is provided.
function parseContractBundle(body) {
  if (!body || body.contract === undefined) return null;
  const raw = body.contract;
  if (!raw || typeof raw !== "object") {
    throw new BadRequestError("contract must be an object");
  }
  const totalAmount = requireAmount(raw.totalAmount, "contract.totalAmount");
  const signedDate = raw.signedDate || null;
  if (signedDate && !/^\d{4}-\d{2}-\d{2}$/.test(signedDate)) {
    throw new BadRequestError("contract.signedDate must be YYYY-MM-DD");
  }

  const deposit = raw.deposit !== undefined && raw.deposit !== null
    ? parsePaymentLeg(raw.deposit, "contract.deposit")
    : null;
  const finalPayment = raw.finalPayment !== undefined && raw.finalPayment !== null
    ? parsePaymentLeg(raw.finalPayment, "contract.finalPayment")
    : null;

  if (!deposit && !finalPayment) {
    throw new BadRequestError("contract requires at least one of deposit / finalPayment");
  }

  const sum = (deposit?.amount || 0) + (finalPayment?.amount || 0);
  if (Math.abs(sum - totalAmount) > 0.01) {
    throw new BadRequestError(
      `contract.deposit.amount + contract.finalPayment.amount must equal contract.totalAmount`,
    );
  }

  return { totalAmount, signedDate, deposit, finalPayment };
}

async function createContractWithPayments(weddingId, vendorId, bundle) {
  const contractInsert = {
    wedding_id: weddingId,
    vendor_id: vendorId,
    total_amount: bundle.totalAmount,
    signed_date: bundle.signedDate,
    status: "pending",
  };
  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .insert(contractInsert)
    .select("*")
    .single();
  if (contractError) throw contractError;

  const paymentRows = [];
  if (bundle.deposit) {
    paymentRows.push({
      contract_id: contract.id,
      kind: "zaliczka",
      due_date: bundle.deposit.dueDate,
      amount: bundle.deposit.amount,
      status: "planned",
      method: bundle.deposit.method,
    });
  }
  if (bundle.finalPayment) {
    paymentRows.push({
      contract_id: contract.id,
      kind: "final",
      due_date: bundle.finalPayment.dueDate,
      amount: bundle.finalPayment.amount,
      status: "planned",
      method: bundle.finalPayment.method,
    });
  }

  if (paymentRows.length > 0) {
    const { error: paymentError } = await supabase.from("payments").insert(paymentRows);
    if (paymentError) {
      await supabase.from("contracts").delete().eq("id", contract.id);
      throw paymentError;
    }
  }

  return contract.id;
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
    const contractBundle = parseContractBundle(req.body);
    // If contract bundle present, mirror totalAmount onto vendors.contract_amount
    // for the denormalized card view (per resolved decision 2026-05-26).
    const insert = {
      wedding_id: req.params.weddingId,
      category: enumValue(requireString(req.body, "category"), VENDOR_CATEGORIES, "category"),
      company_name: requireString(req.body, "companyName"),
      contact_person: optionalString(req.body, "contactPerson") ?? null,
      phone: optionalString(req.body, "phone") ?? null,
      email: optionalString(req.body, "email") ?? null,
      // New leads start as considered until the couple books or rejects them.
      status: optionalEnum(req.body, "status", VENDOR_STATUSES) ?? "rozwazany",
      contract_amount:
        contractBundle?.totalAmount ?? optionalAmount(req.body, "contractAmount") ?? null,
      notes: optionalString(req.body, "notes") ?? null,
    };

    const { data, error } = await supabase.from("vendors").insert(insert).select("*").single();
    if (error) throw error;

    if (contractBundle) {
      try {
        await createContractWithPayments(req.params.weddingId, data.id, contractBundle);
      } catch (bundleErr) {
        // Rollback: contract+payments cleanup happens inside createContractWithPayments;
        // vendor we just inserted has to be undone here.
        await supabase.from("vendors").delete().eq("id", data.id);
        throw bundleErr;
      }
    }

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
