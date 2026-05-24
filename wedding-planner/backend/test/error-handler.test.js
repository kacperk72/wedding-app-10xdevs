const assert = require("node:assert/strict");
const { describe, it, mock } = require("node:test");
const { BadRequestError } = require("../src/errors/domain-errors");
const errorHandler = require("../src/middleware/error-handler");

function callErrorHandler(err, env = "test") {
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = env;
  const response = {
    body: null,
    statusCode: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  const consoleError = mock.method(console, "error", () => {});
  try {
    errorHandler(err, {}, response, () => {});
  } finally {
    consoleError.mock.restore();
    process.env.NODE_ENV = previousEnv;
  }
  return response;
}

describe("error handler", () => {
  it("maps domain errors without logging them as server failures", () => {
    const response = callErrorHandler(new BadRequestError("Invalid input"));

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, { error: "Invalid input", details: [] });
  });

  it("maps PostgreSQL and PostgREST codes to API statuses", () => {
    const foreignKey = callErrorHandler({
      code: "23503",
      message: "violates foreign key",
      details: "missing parent",
    });
    assert.equal(foreignKey.statusCode, 400);
    assert.equal(foreignKey.body.error, "violates foreign key");

    const unique = callErrorHandler({
      code: "23505",
      message: "duplicate key",
      details: "already exists",
    });
    assert.equal(unique.statusCode, 409);

    const missing = callErrorHandler({
      code: "PGRST116",
      message: "single row not found",
    });
    assert.equal(missing.statusCode, 404);
  });

  it("keeps unexpected errors generic outside development", () => {
    const response = callErrorHandler(new Error("boom"), "production");

    assert.equal(response.statusCode, 500);
    assert.equal(response.body.error, "Internal server error");
    assert.deepEqual(response.body.details, ["Something went wrong on our end"]);
  });
});
