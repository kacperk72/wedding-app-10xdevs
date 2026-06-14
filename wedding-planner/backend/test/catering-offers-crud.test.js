const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

describe("catering offers", () => {
  let server;
  let db;

  beforeEach(async () => {
    const app = await createTestServer({
      vendors: [
        { id: "vendor-1", wedding_id: "wedding-1", category: "sala", company_name: "Palac Polanka", status: "zarezerwowany" },
        { id: "foreign-vendor", wedding_id: "wedding-2", category: "sala", company_name: "Foreign", status: "zarezerwowany" },
      ],
    });
    server = app.server;
    db = app.db;
  });

  afterEach(async () => {
    if (server) await close(server);
    clearAppCache();
  });

  it("creates an empty offer", async () => {
    const response = await request(server, "POST", "/api/weddings/wedding-1/catering/offers", {
      name: "Oferta testowa",
      vendorId: "vendor-1",
      validThrough: "2026-12-31",
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.name, "Oferta testowa");
    assert.equal(response.body.vendorName, "Palac Polanka");
  });

  it("loads the Palac Polanka 2026 preset", async () => {
    const response = await request(server, "POST", "/api/weddings/wedding-1/catering/offers", {
      name: "Palac Polanka 2026",
      preset: "palac-polanka-2026",
    });

    assert.equal(response.status, 201);
    assert.equal(db.catering_packages.length, 4);
    assert.ok(db.catering_dishes.length >= 50);
    assert.ok(db.catering_courses.length >= 25);
    assert.equal(db.catering_addons.length, 7);
    assert.equal(response.body.packages.length, 4);
  });

  it("rejects loading the same preset name twice", async () => {
    await request(server, "POST", "/api/weddings/wedding-1/catering/offers", {
      name: "Palac Polanka 2026",
      preset: "palac-polanka-2026",
    });
    const response = await request(server, "POST", "/api/weddings/wedding-1/catering/offers", {
      name: "Palac Polanka 2026",
      preset: "palac-polanka-2026",
    });

    assert.equal(response.status, 409);
  });

  it("rejects an unknown preset", async () => {
    const response = await request(server, "POST", "/api/weddings/wedding-1/catering/offers", {
      name: "Unknown",
      preset: "unknown",
    });

    assert.equal(response.status, 400);
  });

  it("returns a nested offer structure", async () => {
    const created = await request(server, "POST", "/api/weddings/wedding-1/catering/offers", {
      name: "Palac Polanka 2026",
      preset: "palac-polanka-2026",
    });

    const response = await request(
      server,
      "GET",
      `/api/weddings/wedding-1/catering/offers/${created.body.id}`,
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.packages.length, 4);
    const gold = response.body.packages.find((pkg) => pkg.name === "Złoty");
    assert.ok(gold.courses.length > 0);
    // Złoty = 2 ciepłe kolacje + 1 ostatnia kolacja (zgodnie z PDF Pałac Polanka)
    const warmDinners = gold.courses.filter((course) => course.title.startsWith("Kolacja ciepła"));
    const lastDinner = gold.courses.find((course) => course.title === "Ostatnia kolacja");
    assert.equal(warmDinners.length, 2);
    assert.ok(lastDinner, "Złoty powinien mieć kurs 'Ostatnia kolacja'");
    assert.equal(lastDinner.dishes.length, 4);
    assert.equal(response.body.addons.length, 7);
  });

  it("rejects deleting an offer with active selection", async () => {
    const created = await request(server, "POST", "/api/weddings/wedding-1/catering/offers", {
      name: "Palac Polanka 2026",
      preset: "palac-polanka-2026",
    });
    const gold = db.catering_packages.find((pkg) => pkg.name === "Złoty");
    await request(server, "PUT", "/api/weddings/wedding-1/catering/selection", {
      packageId: gold.id,
      guestCountEstimate: 100,
    });

    const response = await request(
      server,
      "DELETE",
      `/api/weddings/wedding-1/catering/offers/${created.body.id}`,
    );

    assert.equal(response.status, 409);
  });

  it("rejects cross-wedding vendor ids", async () => {
    const response = await request(server, "POST", "/api/weddings/wedding-1/catering/offers", {
      name: "Bad vendor",
      vendorId: "foreign-vendor",
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "vendorId does not belong to this wedding");
  });
});
