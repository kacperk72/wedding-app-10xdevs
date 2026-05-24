const { supabase } = require("../config/database");
const { NotMemberError, BadRequestError } = require("../errors/domain-errors");
const { ensureUserFromSsoPayload } = require("../services/users");

async function getCurrentUser(req) {
  if (!req.currentUser) {
    req.currentUser = await ensureUserFromSsoPayload(req.user);
  }
  return req.currentUser;
}

async function loadWeddingMembership(weddingId, userId) {
  const { data: membership, error } = await supabase
    .from("wedding_members")
    .select("wedding_id, user_id, role, linked_at")
    .eq("wedding_id", weddingId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return membership;
}

function requireWeddingMember({ paramName = "weddingId" } = {}) {
  return async (req, _res, next) => {
    try {
      const weddingId = req.params[paramName];
      if (!weddingId) throw new BadRequestError("Wedding id is required");

      const user = await getCurrentUser(req);
      const membership = await loadWeddingMembership(weddingId, user.id);
      if (!membership) throw new NotMemberError();

      req.weddingMembership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  getCurrentUser,
  loadWeddingMembership,
  requireWeddingMember,
};
