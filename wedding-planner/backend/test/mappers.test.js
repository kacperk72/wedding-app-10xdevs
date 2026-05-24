const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { mapWedding } = require("../src/utils/mappers");

describe("mappers", () => {
  it("maps wedding daysUntilWedding from an injected clock", () => {
    const mapped = mapWedding(
      {
        id: "wedding-1",
        partner_a_name: "A",
        partner_b_name: "B",
        wedding_date: "2026-06-03",
        ceremony_location: null,
        created_by_user_id: "user-a",
        wedding_members: [],
      },
      { now: new Date("2026-05-24T00:00:00.000Z") },
    );

    assert.equal(mapped.daysUntilWedding, 10);
  });
});
