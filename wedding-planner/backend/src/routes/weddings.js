const crypto = require("node:crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const { supabase } = require("../config/database");
const { ensureUserFromSsoPayload } = require("../services/users");
const { requireWeddingMember } = require("../middleware/wedding-member");
const {
  BadRequestError,
  ConflictError,
  NotFoundError,
} = require("../errors/domain-errors");
const { mapWedding } = require("../utils/mappers");
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
  "id, partner_a_name, partner_b_name, wedding_date, ceremony_location, created_by_user_id, wedding_members(user_id, role, linked_at, users(email, first_name, last_name))";
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

  if (partnerAName !== undefined) patch.partner_a_name = partnerAName;
  if (partnerBName !== undefined) patch.partner_b_name = partnerBName;
  if (weddingDate !== undefined) patch.wedding_date = weddingDate;
  if (ceremonyLocation !== undefined) patch.ceremony_location = ceremonyLocation;

  return requireAtLeastOne(patch);
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
