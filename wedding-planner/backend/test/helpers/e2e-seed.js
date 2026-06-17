// Shared in-memory seed for the hermetic e2e backend (DB_TEST_MODE=1).
// Two members of ONE wedding so the cross-account golden flow (Phase 4) can
// prove partner B sees partner A's write. Local ids match the auth mock's
// token→user map (sso-a→user-a, sso-b→user-b) so ensureUserFromSsoPayload
// resolves the SSO payload to a seeded member.
function e2eSeed() {
  // Computed at server boot — a payment due ~10 days out so it lands inside the
  // dashboard/contracts "upcoming 30 days" window whenever the e2e run starts.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const dueSoon = new Date(Date.now() + 10 * DAY_MS).toISOString().slice(0, 10);
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
    // One "sala" vendor so the catering freeze-into-contract flow (Phase 6 e2e)
    // has a contractable party to bind the frozen contract to. The catering
    // offer/package/selection are built through the real preset API by the test
    // itself (the guards' join queries need genuine relationships), so only the
    // vendor needs hand-seeding here.
    vendors: [
      {
        id: "vendor-1",
        wedding_id: "wedding-1",
        category: "sala",
        company_name: "Pałac Polanka",
        contact_person: null,
        phone: null,
        email: null,
        status: "zarezerwowany",
        contract_amount: null,
        notes: null,
      },
    ],
    // One unseated guest + one table for the seating keyboard-fallback flow.
    guests: [
      {
        id: "seat-guest",
        wedding_id: "wedding-1",
        first_name: "Zofia",
        last_name: "Seatowa",
        relation: "wspolni_znajomi",
        rsvp_status: "confirmed",
        diet: "standard",
        has_plus_one: false,
        is_child: false,
        meal_option_id: null,
        table_id: null,
        seat_number: null,
        contact_phone: null,
        contact_email: null,
      },
    ],
    tables: [
      {
        id: "seat-table",
        wedding_id: "wedding-1",
        name: "Stół Testowy",
        seats_count: 8,
        sort_order: 1,
        position_x: null,
        position_y: null,
      },
    ],
    // A contract with a payment due ~10 days out, so the "upcoming 30 days"
    // card has something to render.
    contracts: [
      {
        id: "contract-seed",
        wedding_id: "wedding-1",
        vendor_id: "vendor-1",
        total_amount: 4000,
        signed_date: null,
        status: "pending",
      },
    ],
    payments: [
      {
        id: "pay-seed",
        contract_id: "contract-seed",
        kind: "rata",
        due_date: dueSoon,
        amount: 1500,
        status: "planned",
        method: "przelew",
      },
    ],
  };
}

module.exports = { e2eSeed };
