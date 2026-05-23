const express = require("express");
const requireSsoAuth = require("../middleware/jwks-auth");
const { supabase } = require("../config/database");
const { ensureUserFromSsoPayload } = require("../services/users");

const router = express.Router();

function requireString(body, key) {
  if (!body[key] || typeof body[key] !== "string") {
    const error = new Error(`${key} is required`);
    error.status = 400;
    throw error;
  }
  return body[key].trim();
}

router.post("/", requireSsoAuth, async (req, res, next) => {
  try {
    const user = await ensureUserFromSsoPayload(req.user);
    const { data: existingMember, error: memberError } = await supabase
      .from("wedding_members")
      .select("wedding_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberError) throw memberError;
    if (existingMember) {
      const error = new Error("User already belongs to a wedding");
      error.status = 409;
      throw error;
    }

    const { data: wedding, error: rpcError } = await supabase.rpc(
      "create_wedding_with_bootstrap",
      {
        p_creator_user_id: user.id,
        p_partner_a_name: requireString(req.body, "partnerAName"),
        p_partner_b_name: requireString(req.body, "partnerBName"),
        p_wedding_date: requireString(req.body, "weddingDate"),
        p_ceremony_location: req.body.ceremonyLocation || null,
      },
    );

    if (rpcError) {
      if (rpcError.message?.includes("already belongs")) rpcError.status = 409;
      throw rpcError;
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

router.get("/:id", requireSsoAuth, async (req, res, next) => {
  try {
    const user = await ensureUserFromSsoPayload(req.user);
    const { data: member, error: memberError } = await supabase
      .from("wedding_members")
      .select("wedding_id")
      .eq("wedding_id", req.params.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member) {
      return res.status(404).json({ error: "Wedding not found" });
    }

    const { data: wedding, error: weddingError } = await supabase
      .from("weddings")
      .select(
        "id, partner_a_name, partner_b_name, wedding_date, ceremony_location, created_by_user_id, wedding_members(user_id, role, linked_at, users(email, first_name, last_name))",
      )
      .eq("id", req.params.id)
      .single();
    if (weddingError) throw weddingError;
    if (!wedding) return res.status(404).json({ error: "Wedding not found" });

    const today = new Date();
    const weddingDate = new Date(`${wedding.wedding_date}T00:00:00.000Z`);
    const daysUntilWedding = Math.ceil((weddingDate - today) / 86400000);

    res.json({
      id: wedding.id,
      partnerAName: wedding.partner_a_name,
      partnerBName: wedding.partner_b_name,
      weddingDate: wedding.wedding_date,
      ceremonyLocation: wedding.ceremony_location,
      createdByUserId: wedding.created_by_user_id,
      daysUntilWedding,
      members: wedding.wedding_members.map((weddingMember) => ({
        userId: weddingMember.user_id,
        email: weddingMember.users?.email || null,
        firstName: weddingMember.users?.first_name || null,
        lastName: weddingMember.users?.last_name || null,
        role: weddingMember.role,
        linkedAt: weddingMember.linked_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
