const express = require("express");
const { supabase } = require("../config/database");
const { BadRequestError, NotFoundError } = require("../errors/domain-errors");
const { requireWeddingMember } = require("../middleware/wedding-member");
const { mapContract, mapPayment } = require("../utils/mappers");
const {
  optionalDateString,
  optionalEnum,
  optionalString,
  requireAtLeastOne,
  requireString,
} = require("../utils/request-validation");

const router = express.Router({ mergeParams: true });

const CONTRACT_STATUSES = ["pending", "in_progress", "deposit_paid", "paid_in_full"];

function optionalAmount(body, key) {
  if (!body || body[key] === undefined) return undefined;
  if (typeof body[key] !== "number" || !Number.isFinite(body[key]) || body[key] < 0) {
    throw new BadRequestError(`${key} must be a non-negative number`);
  }
  return body[key];
}

async function assertVendorBelongsToWedding(vendorId, weddingId) {
  const { data, error } = await supabase
    .from("vendors")
    .select("id")
    .eq("id", vendorId)
    .eq("wedding_id", weddingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new BadRequestError("vendorId does not belong to this wedding");
}

async function loadContracts(weddingId, status) {
  let query = supabase
    .from("contracts")
    .select("*")
    .eq("wedding_id", weddingId)
    .order("signed_date", { ascending: false });

  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  const contractIds = data.map((contract) => contract.id);

  const [vendorsResult, paymentsResult] = await Promise.all([
    supabase.from("vendors").select("*").eq("wedding_id", weddingId),
    contractIds.length > 0
      ? supabase.from("payments").select("*").in("contract_id", contractIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (vendorsResult.error) throw vendorsResult.error;
  if (paymentsResult.error) throw paymentsResult.error;

  const vendorsById = new Map(vendorsResult.data.map((vendor) => [vendor.id, vendor]));
  return data.map((contract) => ({
    ...contract,
    vendors: vendorsById.get(contract.vendor_id) || null,
    payments: paymentsResult.data
      .filter((payment) => payment.contract_id === contract.id)
      .sort((a, b) => a.due_date.localeCompare(b.due_date)),
  }));
}

function buildContractPatch(body) {
  body = body || {};
  const patch = {};
  const vendorId = optionalString(body, "vendorId");
  const totalAmount = optionalAmount(body, "totalAmount");
  const signedDate = optionalDateString(body, "signedDate");
  const status = optionalEnum(body, "status", CONTRACT_STATUSES);

  if (vendorId !== undefined) patch.vendor_id = vendorId;
  if (totalAmount !== undefined) patch.total_amount = totalAmount;
  if (signedDate !== undefined) patch.signed_date = signedDate;
  if (status !== undefined) patch.status = status;

  return requireAtLeastOne(patch);
}

router.use(requireWeddingMember());

router.get("/upcoming-payments", async (req, res, next) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const inThirtyDays = new Date(today);
    inThirtyDays.setUTCDate(today.getUTCDate() + 30);

    const contracts = await loadContracts(req.params.weddingId);
    const upcoming = contracts.flatMap((contract) =>
      contract.payments
        .filter((payment) => {
          const due = new Date(`${payment.due_date}T00:00:00.000Z`);
          return payment.status === "planned" && due >= today && due <= inThirtyDays;
        })
        .map((payment) => mapPayment(payment, contract.vendors)),
    );

    res.json(upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    res.json((await loadContracts(req.params.weddingId, status)).map(mapContract));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const vendorId = requireString(req.body, "vendorId");
    await assertVendorBelongsToWedding(vendorId, req.params.weddingId);

    const insert = {
      wedding_id: req.params.weddingId,
      vendor_id: vendorId,
      total_amount: optionalAmount(req.body, "totalAmount") ?? 0,
      signed_date: optionalDateString(req.body, "signedDate") ?? null,
      status: optionalEnum(req.body, "status", CONTRACT_STATUSES) ?? "pending",
    };

    const { data, error } = await supabase.from("contracts").insert(insert).select("*").single();
    if (error) throw error;
    const loaded = (await loadContracts(req.params.weddingId)).find((contract) => contract.id === data.id);
    res.status(201).json(mapContract(loaded || data));
  } catch (err) {
    next(err);
  }
});

router.patch("/:contractId", async (req, res, next) => {
  try {
    const patch = buildContractPatch(req.body);
    if (patch.vendor_id !== undefined) {
      await assertVendorBelongsToWedding(patch.vendor_id, req.params.weddingId);
    }

    const { data, error } = await supabase
      .from("contracts")
      .update(patch)
      .eq("id", req.params.contractId)
      .eq("wedding_id", req.params.weddingId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Contract not found");
    const loaded = (await loadContracts(req.params.weddingId)).find((contract) => contract.id === data.id);
    res.json(mapContract(loaded || data));
  } catch (err) {
    next(err);
  }
});

router.delete("/:contractId", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("contracts")
      .delete()
      .eq("id", req.params.contractId)
      .eq("wedding_id", req.params.weddingId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Contract not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
