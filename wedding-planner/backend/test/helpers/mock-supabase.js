const USER_IDS = {
  "sso-a": "user-a",
  "sso-b": "user-b",
  "sso-c": "user-c",
};

function makeAuthMock(req, _res, next) {
  const token = (req.header("Authorization") || "").replace("Bearer ", "");
  const ssoUserId = token || "sso-a";
  req.user = {
    userId: ssoUserId,
    email: `${ssoUserId}@example.com`,
    firstName: ssoUserId,
    lastName: "Test",
  };
  next();
}

function clone(row) {
  return row ? { ...row } : row;
}

function rowMatches(row, filters) {
  return filters.every((filter) => {
    if (filter.operator === "neq") return row[filter.column] !== filter.value;
    if (filter.operator === "in") return filter.values.includes(row[filter.column]);
    return row[filter.column] === filter.value;
  });
}

class QueryBuilder {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.operation = "select";
    this.payload = null;
    this.onConflict = null;
    this.selected = null;
  }

  select(columns) {
    this.selected = columns || null;
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, value, operator: "eq" });
    return this;
  }

  neq(column, value) {
    this.filters.push({ column, value, operator: "neq" });
    return this;
  }

  in(column, values) {
    this.filters.push({ column, values, operator: "in" });
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  insert(payload) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  update(payload) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  upsert(payload, options = {}) {
    this.operation = "upsert";
    this.payload = payload;
    this.onConflict = options.onConflict;
    return this;
  }

  maybeSingle() {
    return Promise.resolve({ data: this.execute()[0] || null, error: null });
  }

  single() {
    return Promise.resolve({ data: this.execute()[0] || null, error: null });
  }

  then(resolve, reject) {
    return Promise.resolve({ data: this.execute(), error: null }).then(resolve, reject);
  }

  execute() {
    if (this.operation === "insert") return this.executeInsert();
    if (this.operation === "update") return this.executeUpdate();
    if (this.operation === "delete") return this.executeDelete();
    if (this.operation === "upsert") return this.executeUpsert();
    return this.rows().map((row) => this.formatRow(row));
  }

  rows() {
    return this.db[this.table].filter((row) => rowMatches(row, this.filters));
  }

  formatRow(row) {
    const result = clone(row);
    if (this.table === "weddings" && this.selected?.includes("wedding_members(")) {
      result.wedding_members = this.db.wedding_members
        .filter((member) => member.wedding_id === row.id)
        .map((member) => ({
          ...clone(member),
          users: this.db.users.find((user) => user.id === member.user_id) || null,
        }));
    }
    if (this.table === "wedding_members" && this.selected?.includes("users(")) {
      result.users =
        row.users ||
        this.db.users.find((user) => user.id === row.user_id) ||
        null;
    }
    if (this.selected && !this.selected.includes("*") && !this.selected.includes("(")) {
      return this.selected
        .split(",")
        .map((column) => column.trim())
        .filter(Boolean)
        .reduce((projected, column) => {
          projected[column] = result[column];
          return projected;
        }, {});
    }
    return result;
  }

  executeInsert() {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
    return rows.map((row) => {
      const record = {
        id: row.id || `${this.table}-${this.db[this.table].length + 1}`,
        ...row,
      };
      if (this.table === "wedding_members") {
        record.linked_at = record.linked_at || "2026-05-24T10:00:00.000Z";
      }
      this.db[this.table].push(record);
      return clone(record);
    });
  }

  executeUpdate() {
    const updated = [];
    for (const row of this.rows()) {
      Object.assign(row, this.payload);
      updated.push(clone(row));
    }
    return updated;
  }

  executeDelete() {
    const deleted = [];
    this.db[this.table] = this.db[this.table].filter((row) => {
      if (!rowMatches(row, this.filters)) return true;
      deleted.push(clone(row));
      return false;
    });
    if (this.table === "weddings") {
      for (const wedding of deleted) this.cascadeWeddingDelete(wedding.id);
    }
    return deleted;
  }

  cascadeWeddingDelete(weddingId) {
    const contractIds = new Set(
      (this.db.contracts || [])
        .filter((contract) => contract.wedding_id === weddingId)
        .map((contract) => contract.id),
    );
    const weddingScopedTables = [
      "wedding_members",
      "partner_invitations",
      "guests",
      "meal_options",
      "tables",
      "vendors",
      "contracts",
      "budget_categories",
      "expenses",
      "tasks",
      "meetings",
      "catering_offers",
      "wedding_catering_selection",
    ];
    for (const table of weddingScopedTables) {
      if (this.db[table]) this.db[table] = this.db[table].filter((row) => row.wedding_id !== weddingId);
    }
    if (this.db.payments) {
      this.db.payments = this.db.payments.filter((payment) => !contractIds.has(payment.contract_id));
    }
  }

  executeUpsert() {
    if (this.table === "users") {
      const existing = this.db.users.find(
        (user) => user.sso_user_id === this.payload.sso_user_id,
      );
      if (existing) {
        Object.assign(existing, this.payload);
        return [clone(existing)];
      }
      const user = {
        id: USER_IDS[this.payload.sso_user_id] || `user-${this.db.users.length + 1}`,
        ...this.payload,
      };
      this.db.users.push(user);
      return [clone(user)];
    }

    const conflictColumns = (this.onConflict || "")
      .split(",")
      .map((column) => column.trim())
      .filter(Boolean);
    const existing = this.db[this.table].find((row) =>
      conflictColumns.every((column) => row[column] === this.payload[column]),
    );

    if (existing) {
      Object.assign(existing, this.payload);
      return [clone(existing)];
    }

    return this.executeInsert();
  }
}

// MUST mirror supabase/migrations/20260524120000_accept_partner_invite_rpc.sql
// until a database-backed integration test replaces this in-memory RPC mock.
function acceptPartnerInvite(db, { p_token: token, p_user_id: userId }) {
  const invitation = db.partner_invitations.find((row) => row.token === token);
  if (!invitation) return { status: 400, error: "Invalid invite token" };
  if (invitation.status !== "pending") {
    return { status: 409, error: "Invite is no longer pending" };
  }
  if (new Date(invitation.expires_at) <= new Date()) {
    invitation.status = "expired";
    return { status: 400, error: "Invite token has expired" };
  }
  if (db.wedding_members.some((member) => member.user_id === userId)) {
    return { status: 409, error: "User already belongs to a wedding" };
  }
  if (
    db.wedding_members.some(
      (member) => member.wedding_id === invitation.wedding_id && member.role === "partner_b",
    )
  ) {
    return { status: 409, error: "Wedding already has partner_b linked" };
  }

  const membership = {
    wedding_id: invitation.wedding_id,
    user_id: userId,
    role: "partner_b",
    linked_at: "2026-05-24T10:00:00.000Z",
  };
  db.wedding_members.push(membership);
  invitation.status = "accepted";
  invitation.accepted_at = "2026-05-24T10:00:00.000Z";

  return {
    weddingId: membership.wedding_id,
    weddingMembership: {
      weddingId: membership.wedding_id,
      role: membership.role,
      linkedAt: membership.linked_at,
    },
  };
}

function createWeddingWithBootstrap(
  db,
  {
    p_creator_user_id: creatorUserId,
    p_partner_a_name: partnerAName,
    p_partner_b_name: partnerBName,
    p_wedding_date: weddingDate,
    p_ceremony_location: ceremonyLocation,
  },
) {
  if (db.wedding_members.some((member) => member.user_id === creatorUserId)) {
    return { status: 409, error: "User already belongs to a wedding" };
  }

  const wedding = {
    id: `wedding-${db.weddings.length + 1}`,
    partner_a_name: partnerAName,
    partner_b_name: partnerBName,
    wedding_date: weddingDate,
    ceremony_location: ceremonyLocation,
    created_by_user_id: creatorUserId,
  };
  db.weddings.push(wedding);
  db.wedding_members.push({
    wedding_id: wedding.id,
    user_id: creatorUserId,
    role: "partner_a",
    linked_at: "2026-05-24T10:00:00.000Z",
  });

  return {
    id: wedding.id,
    partnerAName,
    partnerBName,
    weddingDate,
    ceremonyLocation,
    createdByUserId: creatorUserId,
    bootstrap: {
      budgetCategories: 15,
      tables: 12,
      tasks: 13,
    },
  };
}

function guestAggregates(db, { p_wedding_id: weddingId }) {
  const guests = db.guests.filter((guest) => guest.wedding_id === weddingId);
  return {
    invited: guests.length,
    confirmed: guests.filter((guest) => guest.rsvp_status === "confirmed").length,
    pending: guests.filter((guest) => guest.rsvp_status === "pending").length,
    declined: guests.filter((guest) => guest.rsvp_status === "declined").length,
    vegeOrVegan: guests.filter((guest) => guest.diet === "vege" || guest.diet === "vegan").length,
    children: guests.filter((guest) => guest.is_child).length,
    noMealPick: guests.filter((guest) => guest.meal_option_id === null).length,
  };
}

function createMockSupabase(seed = {}) {
  const db = {
    users: [],
    weddings: [],
    wedding_members: [
      {
        wedding_id: "wedding-1",
        user_id: "user-a",
        role: "partner_a",
        linked_at: "2026-05-24T09:00:00.000Z",
      },
    ],
    partner_invitations: [],
    guests: [],
    meal_options: [],
    tables: [],
    vendors: [],
    contracts: [],
    payments: [],
    budget_categories: [],
    expenses: [],
    meetings: [],
    catering_offers: [],
    wedding_catering_selection: [],
    tasks: [],
    task_templates: [],
    ...seed,
  };

  return {
    db,
    supabase: {
      from(table) {
        if (!db[table]) db[table] = [];
        return new QueryBuilder(db, table);
      },
      rpc(name, params) {
        if (name === "accept_partner_invite") {
          return Promise.resolve({
            data: acceptPartnerInvite(db, params),
            error: null,
          });
        }
        if (name === "create_wedding_with_bootstrap") {
          return Promise.resolve({
            data: createWeddingWithBootstrap(db, params),
            error: null,
          });
        }
        if (name === "guest_aggregates") {
          return Promise.resolve({
            data: guestAggregates(db, params),
            error: null,
          });
        }
        throw new Error(`Unexpected RPC call: ${name}`);
      },
    },
  };
}

module.exports = {
  createMockSupabase,
  makeAuthMock,
};
