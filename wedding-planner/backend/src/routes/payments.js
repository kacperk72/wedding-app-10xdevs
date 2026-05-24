const express = require("express");
const { supabase } = require("../config/database");
const { BadRequestError, NotFoundError } = require("../errors/domain-errors");
const { requireWeddingMember } = require("../middleware/wedding-member");
const { mapPayment } = require("../utils/mappers");
const {
  dateString,
  optionalDateString,
  optionalEnum,
  requireAtLeastOne,
  requireString,
} = require("../utils/request-validation");

const router = express.Router({ mergeParams: true });

const PAYMENT_KINDS = ["zaliczka", "rata", "final", "ofiara"];
const PAYMENT_STATUSES = ["planned", "paid", "overdue"];

function optionalAmount(body, key) {
  if (!body || body[key] === undefined) return undefined;
  if (typeof body[key] !== "number" || !Number.isFinite(body[key]) || body[key] < 0) {
    throw new BadRequestError(`${key} must be a non-negative number`);
  }
  return body[key];
}

async function loadContractForWedding(contractId, weddingId) {
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .eq("wedding_id", weddingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new NotFoundError("Contract not found");
  return data;
}

function buildPaymentPatch(body) {
  body = body || {};
  const patch = {};
  const kind = optionalEnum(body, "kind", PAYMENT_KINDS);
  const dueDate = optionalDateString(body, "dueDate");
  const amount = optionalAmount(body, "amount");
  const status = optionalEnum(body, "status", PAYMENT_STATUSES);
  const paidAt = optionalDateString(body, "paidAt");

  if (kind !== undefined) patch.kind = kind;
  if (dueDate !== undefined) patch.due_date = dueDate;
  if (amount !== undefined) patch.amount = amount;
  if (status !== undefined) patch.status = status;
  if (paidAt !== undefined) patch.paid_at = paidAt;

  return requireAtLeastOne(patch);
}

async function syncContractStatus(contractId) {
  const { data, error } = await supabase.from("payments").select("*").eq("contract_id", contractId);
  if (error) throw error;

  let status = "pending";
  if (data.length > 0) {
    status = "in_progress";
    if (data.every((payment) => payment.status === "paid")) status = "paid_in_full";
    else if (data.some((payment) => payment.kind === "zaliczka" && payment.status === "paid")) {
      status = "deposit_paid";
    }
  }

  const { error: updateError } = await supabase
    .from("contracts")
    .update({ status })
    .eq("id", contractId);
  if (updateError) throw updateError;
}

router.use(requireWeddingMember());

router.post("/", async (req, res, next) => {
  try {
    await loadContractForWedding(req.params.contractId, req.params.weddingId);
    const insert = {
      contract_id: req.params.contractId,
      kind: optionalEnum(req.body, "kind", PAYMENT_KINDS) ?? "rata",
      due_date: dateString(requireString(req.body, "dueDate"), "dueDate"),
      amount: optionalAmount(req.body, "amount") ?? 0,
      status: optionalEnum(req.body, "status", PAYMENT_STATUSES) ?? "planned",
      paid_at: optionalDateString(req.body, "paidAt") ?? null,
    };

    const { data, error } = await supabase.from("payments").insert(insert).select("*").single();
    if (error) throw error;
    await syncContractStatus(req.params.contractId);
    res.status(201).json(mapPayment(data));
  } catch (err) {
    next(err);
  }
});

router.patch("/:paymentId", async (req, res, next) => {
  try {
    await loadContractForWedding(req.params.contractId, req.params.weddingId);
    const patch = buildPaymentPatch(req.body);
    const { data, error } = await supabase
      .from("payments")
      .update(patch)
      .eq("id", req.params.paymentId)
      .eq("contract_id", req.params.contractId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Payment not found");
    await syncContractStatus(req.params.contractId);
    res.json(mapPayment(data));
  } catch (err) {
    next(err);
  }
});

router.delete("/:paymentId", async (req, res, next) => {
  try {
    await loadContractForWedding(req.params.contractId, req.params.weddingId);
    const { data, error } = await supabase
      .from("payments")
      .delete()
      .eq("id", req.params.paymentId)
      .eq("contract_id", req.params.contractId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Payment not found");
    await syncContractStatus(req.params.contractId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
