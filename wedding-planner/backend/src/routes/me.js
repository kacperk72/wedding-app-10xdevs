const express = require("express");
const { supabase } = require("../config/database");
const { ensureUserFromSsoPayload } = require("../services/users");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const user = await ensureUserFromSsoPayload(req.user);
    const { data: member, error: memberError } = await supabase
      .from("wedding_members")
      .select("wedding_id, role, linked_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError) throw memberError;

    let partner = null;
    if (member) {
      const { data: partnerMember, error: partnerError } = await supabase
        .from("wedding_members")
        .select("users(id, first_name, last_name, email)")
        .eq("wedding_id", member.wedding_id)
        .neq("user_id", user.id)
        .maybeSingle();
      if (partnerError) throw partnerError;
      if (partnerMember?.users) {
        partner = {
          id: partnerMember.users.id,
          firstName: partnerMember.users.first_name,
          lastName: partnerMember.users.last_name,
          email: partnerMember.users.email,
          linkStatus: "linked",
        };
      }
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      weddingId: member?.wedding_id || null,
      weddingMembership: member
        ? {
            weddingId: member.wedding_id,
            role: member.role,
            linkedAt: member.linked_at,
          }
        : null,
      partner,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
