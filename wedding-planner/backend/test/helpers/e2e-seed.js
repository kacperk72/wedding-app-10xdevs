// Shared in-memory seed for the hermetic e2e backend (DB_TEST_MODE=1).
// Two members of ONE wedding so the cross-account golden flow (Phase 4) can
// prove partner B sees partner A's write. Local ids match the auth mock's
// token→user map (sso-a→user-a, sso-b→user-b) so ensureUserFromSsoPayload
// resolves the SSO payload to a seeded member.
function e2eSeed() {
  return {
    users: [
      {
        id: "user-a",
        sso_user_id: "sso-a",
        email: "ania@example.com",
        first_name: "Ania",
        last_name: "Nowak",
        email_verified: true,
      },
      {
        id: "user-b",
        sso_user_id: "sso-b",
        email: "bartek@example.com",
        first_name: "Bartek",
        last_name: "Kowalski",
        email_verified: true,
      },
    ],
    weddings: [
      {
        id: "wedding-1",
        partner_a_name: "Ania",
        partner_b_name: "Bartek",
        // Fixed future date — rendered as 12.09.2026; deterministic for the
        // DD.MM.YYYY DOM assertion in Phase 4. Not used in any "upcoming" window.
        wedding_date: "2026-09-12",
        ceremony_location: "Pałac Polanka",
        budget_total: 80000,
        created_by_user_id: "user-a",
      },
    ],
    wedding_members: [
      {
        wedding_id: "wedding-1",
        user_id: "user-a",
        role: "partner_a",
        linked_at: "2026-05-24T09:00:00.000Z",
      },
      {
        wedding_id: "wedding-1",
        user_id: "user-b",
        role: "partner_b",
        linked_at: "2026-05-24T09:30:00.000Z",
      },
    ],
  };
}

module.exports = { e2eSeed };
