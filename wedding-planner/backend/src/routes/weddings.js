const crypto = require("node:crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const { supabase } = require("../config/database");
const { ensureUserFromSsoPayload } = require("../services/users");
const { requireWeddingMember } = require("../middleware/wedding-member");
const {
  DomainError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} = require("../errors/domain-errors");
const { mapMeeting, mapWedding } = require("../utils/mappers");
const {
  dateString,
  optionalDateString,
  optionalNonEmptyString,
  optionalString,
  requireAtLeastOne,
  requireString,
} = require("../utils/request-validation");

const router = express.Router();

const WEDDING_SELECT =
  "id, partner_a_name, partner_b_name, wedding_date, ceremony_location, budget_total, created_by_user_id, wedding_members(user_id, role, linked_at, users(email, first_name, last_name))";
const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const acceptInviteLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const invitePartnerLimit = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

function buildWeddingPatch(body) {
  body = body || {};
  const patch = {};
  const partnerAName = optionalNonEmptyString(body, "partnerAName");
  const partnerBName = optionalNonEmptyString(body, "partnerBName");
  const weddingDate = optionalDateString(body, "weddingDate");
  const ceremonyLocation = optionalString(body, "ceremonyLocation");
  const budgetTotal = optionalAmount(body, "budgetTotal");

  if (partnerAName !== undefined) patch.partner_a_name = partnerAName;
  if (partnerBName !== undefined) patch.partner_b_name = partnerBName;
  if (weddingDate !== undefined) patch.wedding_date = weddingDate;
  if (ceremonyLocation !== undefined) patch.ceremony_location = ceremonyLocation;
  if (budgetTotal !== undefined) patch.budget_total = budgetTotal;

  return requireAtLeastOne(patch);
}

function optionalAmount(body, key) {
  if (!body || body[key] === undefined) return undefined;
  if (body[key] === null) return null;
  if (typeof body[key] !== "number" || !Number.isFinite(body[key]) || body[key] < 0) {
    throw new BadRequestError(`${key} must be a non-negative number`);
  }
  return body[key];
}

function dateOnly(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

async function listWeddingRows(table, weddingId, columns = "*") {
  const { data, error } = await supabase.from(table).select(columns).eq("wedding_id", weddingId);
  if (error) throw error;
  return data || [];
}

async function loadContractsAndPayments(weddingId) {
  const contracts = await listWeddingRows("contracts", weddingId);
  if (contracts.length === 0) return { contracts, payments: [] };

  const { data: payments, error } = await supabase
    .from("payments")
    .select("*")
    .in("contract_id", contracts.map((contract) => contract.id));
  if (error) throw error;
  return { contracts, payments: payments || [] };
}

async function buildDashboard(weddingId) {
  const now = new Date();
  const today = dateOnly(now);
  const inThirtyDays = new Date(now);
  inThirtyDays.setUTCDate(now.getUTCDate() + 30);
  const inFourteenDays = new Date(now);
  inFourteenDays.setUTCDate(now.getUTCDate() + 14);

  const [
    guests,
    tasks,
    vendors,
    wedding,
    expenses,
    meetings,
    contractsAndPayments,
  ] = await Promise.all([
    listWeddingRows("guests", weddingId),
    listWeddingRows("tasks", weddingId),
    listWeddingRows("vendors", weddingId),
    supabase.from("weddings").select("budget_total").eq("id", weddingId).single(),
    listWeddingRows("expenses", weddingId),
    listWeddingRows("meetings", weddingId),
    loadContractsAndPayments(weddingId),
  ]);

  const { contracts, payments } = contractsAndPayments;
  if (wedding.error) throw wedding.error;
  const contractsById = new Map(contracts.map((contract) => [contract.id, contract]));
  const vendorsById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const activeTasks = tasks.filter((task) => !task.done);
  const overdueTasks = activeTasks
    .filter((task) => task.due_date < today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const plannedPayments = payments.filter((payment) => payment.status !== "paid");
  const overduePayments = plannedPayments
    .filter((payment) => payment.status === "overdue" || payment.due_date < today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const upcomingPayments = plannedPayments
    .filter((payment) => payment.due_date >= today && payment.due_date <= dateOnly(inThirtyDays))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const attentionItems = [
    ...overdueTasks.map((task) => ({
      type: "task",
      title: task.title,
      meta: `Termin: ${task.due_date}`,
      route: "/app/zadania",
    })),
    ...overduePayments.map((payment) => {
      const contract = contractsById.get(payment.contract_id);
      return {
        type: "payment",
        title: `Platnosc po terminie: ${Number(payment.amount || 0).toFixed(2)} PLN`,
        meta: `${vendorsById.get(contract?.vendor_id)?.company_name || "Kontrahent"} - ${payment.due_date}`,
        route: "/app/umowy",
      };
    }),
  ].slice(0, 5);

  const upcomingMeetings = meetings
    .filter((meeting) => {
      const startsAt = new Date(meeting.starts_at);
      return startsAt >= now && startsAt <= inFourteenDays;
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((meeting) => mapMeeting(meeting, vendorsById.get(meeting.vendor_id) || null));

  return {
    kpis: {
      guests: {
        invited: guests.length,
        confirmed: guests.filter((guest) => guest.rsvp_status === "confirmed").length,
        pending: guests.filter((guest) => guest.rsvp_status === "pending").length,
        declined: guests.filter((guest) => guest.rsvp_status === "declined").length,
      },
      budget: {
        plannedTotal: wedding.data?.budget_total == null ? 0 : Number(wedding.data.budget_total),
        spentTotal: sum(expenses, "amount"),
      },
      payments: {
        upcomingCount: upcomingPayments.length,
        upcomingAmount: sum(upcomingPayments, "amount"),
        overdueCount: overduePayments.length,
        overdueAmount: sum(overduePayments, "amount"),
      },
      tasks: {
        activeCount: activeTasks.length,
        overdueCount: overdueTasks.length,
      },
    },
    attentionItems,
    upcomingMeetings,
  };
}

async function buildWeddingExport(weddingId) {
  const { data: wedding, error: weddingError } = await supabase
    .from("weddings")
    .select("*")
    .eq("id", weddingId)
    .single();
  if (weddingError) throw weddingError;
  if (!wedding) throw new NotFoundError("Wedding not found");

  const [
    weddingMembers,
    partnerInvitations,
    guests,
    mealOptions,
    tables,
    vendors,
    budgetCategories,
    expenses,
    tasks,
    meetings,
    cateringOffers,
    weddingCateringSelection,
    contractsAndPayments,
  ] = await Promise.all([
    listWeddingRows("wedding_members", weddingId),
    listWeddingRows(
      "partner_invitations",
      weddingId,
      "id, wedding_id, invited_by_user_id, email, status, expires_at, accepted_at, created_at",
    ),
    listWeddingRows("guests", weddingId),
    listWeddingRows("meal_options", weddingId),
    listWeddingRows("tables", weddingId),
    listWeddingRows("vendors", weddingId),
    listWeddingRows("budget_categories", weddingId),
    listWeddingRows("expenses", weddingId),
    listWeddingRows("tasks", weddingId),
    listWeddingRows("meetings", weddingId),
    listWeddingRows("catering_offers", weddingId),
    listWeddingRows("wedding_catering_selection", weddingId),
    loadContractsAndPayments(weddingId),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    wedding,
    weddingMembers,
    partnerInvitations,
    guests,
    mealOptions,
    tables,
    vendors,
    contracts: contractsAndPayments.contracts,
    payments: contractsAndPayments.payments,
    budgetCategories,
    expenses,
    tasks,
    meetings,
    cateringOffers,
    weddingCateringSelection,
  };
}

router.post("/accept-invite", acceptInviteLimit, async (req, res, next) => {
  try {
    const token = requireString(req.body, "token");
    const user = await ensureUserFromSsoPayload(req.user);

    const { data, error } = await supabase.rpc("accept_partner_invite", {
      p_token: token,
      p_user_id: user.id,
    });
    if (error) {
      if (error.code === "23505") error.status = 409;
      throw error;
    }
    if (data?.error) {
      if (data.status === 409) throw new ConflictError(data.error);
      throw new BadRequestError(data.error);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const user = await ensureUserFromSsoPayload(req.user);
    const { data: existingMember, error: memberError } = await supabase
      .from("wedding_members")
      .select("wedding_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberError) throw memberError;
    if (existingMember) throw new ConflictError("User already belongs to a wedding");

    const { data: wedding, error: rpcError } = await supabase.rpc(
      "create_wedding_with_bootstrap",
      {
        p_creator_user_id: user.id,
        p_partner_a_name: requireString(req.body, "partnerAName"),
        p_partner_b_name: requireString(req.body, "partnerBName"),
        p_wedding_date: dateString(requireString(req.body, "weddingDate"), "weddingDate"),
        p_ceremony_location: req.body.ceremonyLocation || null,
      },
    );

    if (rpcError) throw rpcError;
    if (wedding?.error) {
      if (wedding.status === 409) throw new ConflictError(wedding.error);
      throw new BadRequestError(wedding.error);
    }

    res.status(201).json({
      id: wedding.id,
      partnerAName: wedding.partnerAName,
      partnerBName: wedding.partnerBName,
      weddingDate: wedding.weddingDate,
      ceremonyLocation: wedding.ceremonyLocation,
      createdByUserId: wedding.createdByUserId,
      bootstrap: wedding.bootstrap,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireWeddingMember({ paramName: "id" }), async (req, res, next) => {
  try {
    const { data: wedding, error: weddingError } = await supabase
      .from("weddings")
      .select(WEDDING_SELECT)
      .eq("id", req.params.id)
      .single();
    if (weddingError) throw weddingError;
    if (!wedding) throw new NotFoundError("Wedding not found");

    res.json(mapWedding(wedding));
  } catch (err) {
    next(err);
  }
});

router.get("/:id/dashboard", requireWeddingMember({ paramName: "id" }), async (req, res, next) => {
  try {
    res.json(await buildDashboard(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get("/:id/export", requireWeddingMember({ paramName: "id" }), async (req, res, next) => {
  try {
    res
      .attachment(`wedding-${req.params.id}-export.json`)
      .json(await buildWeddingExport(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireWeddingMember({ paramName: "id" }), async (req, res, next) => {
  try {
    const patch = buildWeddingPatch(req.body);
    const { data: wedding, error } = await supabase
      .from("weddings")
      .update(patch)
      .eq("id", req.params.id)
      .select(WEDDING_SELECT)
      .single();

    if (error) throw error;
    res.json(mapWedding(wedding));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireWeddingMember({ paramName: "id" }), async (req, res, next) => {
  try {
    const { data: wedding, error: weddingError } = await supabase
      .from("weddings")
      .select("id, created_by_user_id")
      .eq("id", req.params.id)
      .single();
    if (weddingError) throw weddingError;
    if (!wedding) throw new NotFoundError("Wedding not found");
    if (wedding.created_by_user_id !== req.currentUser.id) {
      throw new DomainError("Only the wedding founder can delete this wedding", 403);
    }

    const { data, error } = await supabase
      .from("weddings")
      .delete()
      .eq("id", req.params.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Wedding not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post(
  "/:id/invite-partner",
  invitePartnerLimit,
  requireWeddingMember({ paramName: "id" }),
  async (req, res, next) => {
    try {
      const invitedEmail = requireString(req.body, "email").toLowerCase();

      const { data: partnerB, error: partnerBError } = await supabase
        .from("wedding_members")
        .select("user_id")
        .eq("wedding_id", req.params.id)
        .eq("role", "partner_b")
        .maybeSingle();
      if (partnerBError) throw partnerBError;
      if (partnerB) throw new ConflictError("Wedding already has partner_b linked");

      const { data: existingInvitation, error: existingInvitationError } = await supabase
        .from("partner_invitations")
        .select("id, status")
        .eq("wedding_id", req.params.id)
        .eq("email", invitedEmail)
        .maybeSingle();
      if (existingInvitationError) throw existingInvitationError;
      if (existingInvitation && !["pending", "expired"].includes(existingInvitation.status)) {
        throw new ConflictError("Invite cannot be reissued after final status");
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
      const invitationQuery = supabase
        .from("partner_invitations")
        .upsert(
          {
            wedding_id: req.params.id,
            invited_by_user_id: req.currentUser.id,
            email: invitedEmail,
            token,
            status: "pending",
            expires_at: expiresAt,
            accepted_at: null,
          },
          { onConflict: "wedding_id,email" },
        )
        .select("id, wedding_id, email, status, expires_at, created_at");

      const { data: invitation, error } = await invitationQuery.single();
      if (error) throw error;

      const inviteLink = `${process.env.FRONTEND_ORIGIN || "http://localhost:4200"}/accept-invite?token=${token}`;
      console.log(`Partner invite link for wedding ${req.params.id}: ${inviteLink}`);

      res.status(201).json({
        id: invitation.id,
        weddingId: invitation.wedding_id,
        email: invitation.email,
        status: invitation.status,
        expiresAt: invitation.expires_at,
      });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
