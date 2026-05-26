const express = require("express");
const { supabase } = require("../config/database");
const { BadRequestError, NotFoundError } = require("../errors/domain-errors");
const { requireWeddingMember } = require("../middleware/wedding-member");
const { assertWeddingRecordExists } = require("../utils/cross-wedding");
const { mapExpense } = require("../utils/mappers");
const {
  optionalDateString,
  optionalNonEmptyString,
  optionalString,
  requireAtLeastOne,
  requireDateString,
  requireString,
} = require("../utils/request-validation");

const router = express.Router({ mergeParams: true });

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

function buildExpensePatch(body) {
  body = body || {};
  const patch = {};
  const categoryId = optionalString(body, "categoryId");
  const vendorId = optionalString(body, "vendorId");
  const amount = optionalAmount(body, "amount");
  const spentOn = optionalDateString(body, "spentOn");
  const description = optionalNonEmptyString(body, "description");

  if (categoryId === null) throw new BadRequestError("categoryId must be a valid id");
  if (categoryId !== undefined) patch.category_id = categoryId;
  if (vendorId !== undefined) patch.vendor_id = vendorId;
  if (amount !== undefined) patch.amount = amount;
  if (spentOn !== undefined) patch.spent_on = spentOn;
  if (description !== undefined) patch.description = description;

  return requireAtLeastOne(patch);
}

async function assertExpenseRelationsBelongToWedding(payload, weddingId) {
  await assertWeddingRecordExists("budget_categories", payload.category_id, weddingId, "categoryId");
  await assertWeddingRecordExists("vendors", payload.vendor_id, weddingId, "vendorId");
}

async function loadVendorsById(weddingId) {
  const { data, error } = await supabase
    .from("vendors")
    .select("id, company_name")
    .eq("wedding_id", weddingId);
  if (error) throw error;
  return new Map(data.map((vendor) => [vendor.id, vendor]));
}

router.use(requireWeddingMember());

router.get("/", async (req, res, next) => {
  try {
    let query = supabase
      .from("expenses")
      .select("*")
      .eq("wedding_id", req.params.weddingId)
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false });

    if (req.query.categoryId) query = query.eq("category_id", String(req.query.categoryId));

    const { data, error } = await query;
    if (error) throw error;
    const vendorsById = await loadVendorsById(req.params.weddingId);
    res.json(data.map((expense) => mapExpense(expense, vendorsById.get(expense.vendor_id) || null)));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const insert = {
      wedding_id: req.params.weddingId,
      category_id: requireString(req.body, "categoryId"),
      vendor_id: optionalString(req.body, "vendorId") ?? null,
      amount: requireAmount(req.body, "amount"),
      spent_on: requireDateString(req.body, "spentOn"),
      description: requireString(req.body, "description"),
    };
    await assertExpenseRelationsBelongToWedding(insert, req.params.weddingId);

    const { data, error } = await supabase.from("expenses").insert(insert).select("*").single();
    if (error) throw error;
    const vendorsById = await loadVendorsById(req.params.weddingId);
    res.status(201).json(mapExpense(data, vendorsById.get(data.vendor_id) || null));
  } catch (err) {
    next(err);
  }
});

router.patch("/:expenseId", async (req, res, next) => {
  try {
    const patch = buildExpensePatch(req.body);
    await assertExpenseRelationsBelongToWedding(patch, req.params.weddingId);

    const { data, error } = await supabase
      .from("expenses")
      .update(patch)
      .eq("id", req.params.expenseId)
      .eq("wedding_id", req.params.weddingId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Expense not found");
    const vendorsById = await loadVendorsById(req.params.weddingId);
    res.json(mapExpense(data, vendorsById.get(data.vendor_id) || null));
  } catch (err) {
    next(err);
  }
});

router.delete("/:expenseId", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", req.params.expenseId)
      .eq("wedding_id", req.params.weddingId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Expense not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
