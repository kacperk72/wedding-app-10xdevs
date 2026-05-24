const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { BadRequestError } = require("../src/errors/domain-errors");
const {
  dateString,
  optionalEnum,
  optionalInteger,
  optionalNonEmptyString,
  optionalString,
  requireAtLeastOne,
  requireString,
} = require("../src/utils/request-validation");

describe("request validation helpers", () => {
  it("accepts valid YYYY-MM-DD dates and rejects malformed or impossible dates", () => {
    assert.equal(dateString("2026-05-24", "weddingDate"), "2026-05-24");

    for (const value of ["2026-5-24", "2026-02-30", "not-a-date", null]) {
      assert.throws(() => dateString(value, "weddingDate"), BadRequestError);
    }
  });

  it("distinguishes required, optional, null, and empty strings", () => {
    assert.equal(requireString({ name: " Ala " }, "name"), "Ala");
    assert.equal(optionalString({}, "name"), undefined);
    assert.equal(optionalString({ name: null }, "name"), null);
    assert.equal(optionalString({ name: " " }, "name"), "");

    assert.throws(() => requireString({}, "name"), BadRequestError);
    assert.throws(() => requireString({ name: " " }, "name"), BadRequestError);
    assert.throws(() => optionalNonEmptyString({ name: " " }, "name"), BadRequestError);
  });

  it("validates optional enums without rejecting missing or null fields", () => {
    const allowed = ["pending", "confirmed"];

    assert.equal(optionalEnum({}, "status", allowed), undefined);
    assert.equal(optionalEnum({ status: null }, "status", allowed), null);
    assert.equal(optionalEnum({ status: "pending" }, "status", allowed), "pending");
    assert.throws(() => optionalEnum({ status: "declined" }, "status", allowed), BadRequestError);
  });

  it("accepts integers only", () => {
    assert.equal(optionalInteger({}, "sortOrder"), undefined);
    assert.equal(optionalInteger({ sortOrder: 0 }, "sortOrder"), 0);
    assert.equal(optionalInteger({ sortOrder: 12 }, "sortOrder"), 12);

    for (const value of [1.5, "1", null, Number.NaN]) {
      assert.throws(() => optionalInteger({ sortOrder: value }, "sortOrder"), BadRequestError);
    }
  });

  it("rejects empty patch payloads", () => {
    assert.deepEqual(requireAtLeastOne({ name: "A" }), { name: "A" });
    assert.throws(() => requireAtLeastOne({}), BadRequestError);
  });
});
