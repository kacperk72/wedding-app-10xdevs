const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

describe("catering selection", () => {
  let server;
  let db;

  beforeEach(async () => {
    const app = await createTestServer({
      vendors: [
        { id: "vendor-1", wedding_id: "wedding-1", category: "sala", company_name: "Palac Polanka", status: "zarezerwowany" },
        { id: "photo-1", wedding_id: "wedding-1", category: "fotograf", company_name: "Foto", status: "zarezerwowany" },
      ],
    });
    server = app.server;
    db = app.db;
    await request(server, "POST", "/api/weddings/wedding-1/catering/offers", {
      name: "Palac Polanka 2026",
      preset: "palac-polanka-2026",
    });
  });

  afterEach(async () => {
    if (server) await close(server);
    clearAppCache();
  });

  function pkg(name) {
    return db.catering_packages.find((item) => item.name === name);
  }

  function course(packageId, type, titlePart = "") {
    return db.catering_courses.find(
      (item) =>
        item.catering_package_id === packageId &&
        item.course_type === type &&
        item.title.includes(titlePart),
    );
  }

  function linkedDishes(courseId) {
    return db.catering_course_dishes
      .filter((link) => link.catering_course_id === courseId)
      .map((link) => db.catering_dishes.find((dish) => dish.id === link.catering_dish_id));
  }

  async function selectPackage(packageName = "Złoty", guests = 100) {
    const response = await request(server, "PUT", "/api/weddings/wedding-1/catering/selection", {
      packageId: pkg(packageName).id,
      guestCountEstimate: guests,
    });
    assert.equal(response.status, 200);
    return response.body;
  }

  it("upserts selection on a new package and removes old picks", async () => {
    await selectPackage("Srebrny", 80);
    const soup = course(pkg("Srebrny").id, "obiad_zupa");
    const dish = linkedDishes(soup.id)[0];
    await request(server, "POST", "/api/weddings/wedding-1/catering/selection/dish-picks", {
      courseId: soup.id,
      dishId: dish.id,
    });

    const response = await selectPackage("Złoty", 100);

    assert.equal(response.packageName, "Złoty");
    assert.equal(db.wedding_catering_dish_picks.length, 0);
    assert.equal(db.wedding_catering_addon_picks.length, 0);
  });

  it("rejects dish picks over a course choice limit", async () => {
    await selectPackage("Złoty");
    const soup = course(pkg("Złoty").id, "obiad_zupa");
    const dishes = linkedDishes(soup.id);
    await request(server, "POST", "/api/weddings/wedding-1/catering/selection/dish-picks", {
      courseId: soup.id,
      dishId: dishes[0].id,
    });

    const response = await request(server, "POST", "/api/weddings/wedding-1/catering/selection/dish-picks", {
      courseId: soup.id,
      dishId: dishes[1].id,
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "course choice limit reached");
  });

  it("rejects dish picks with a dish from another offer", async () => {
    await selectPackage("Złoty");
    db.catering_offers.push({ id: "other-offer", wedding_id: "wedding-1", name: "Other" });
    db.catering_dishes.push({
      id: "other-dish",
      catering_offer_id: "other-offer",
      name: "Foreign dish",
      is_vegetarian: false,
      is_vegan: false,
      is_gluten_free: false,
      allergens: [],
    });

    const main = course(pkg("Złoty").id, "obiad_danie_glowne");
    const response = await request(server, "POST", "/api/weddings/wedding-1/catering/selection/dish-picks", {
      courseId: main.id,
      dishId: "other-dish",
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "dish does not belong to selected offer");
  });

  it("rejects dish picks on all_served courses", async () => {
    await selectPackage("Szefa Kuchni");
    const soup = course(pkg("Szefa Kuchni").id, "obiad_zupa");
    const dish = linkedDishes(soup.id)[0];
    const response = await request(server, "POST", "/api/weddings/wedding-1/catering/selection/dish-picks", {
      courseId: soup.id,
      dishId: dish.id,
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "course does not accept picks");
  });

  it("returns a price breakdown for per_event, per_person, and per_bottle addons", async () => {
    await selectPackage("Złoty", 100);
    const covers = db.catering_addons.find((addon) => addon.name === "Pokrowce na krzesla");
    const country = db.catering_addons.find((addon) => addon.name === "Wiejski stół");
    const corkage = db.catering_addons.find((addon) => addon.name === "Korkowe");
    await request(server, "PUT", `/api/weddings/wedding-1/catering/selection/addon-picks/${covers.id}`, { quantity: 1 });
    await request(server, "PUT", `/api/weddings/wedding-1/catering/selection/addon-picks/${country.id}`, { quantity: 1 });
    await request(server, "PUT", `/api/weddings/wedding-1/catering/selection/addon-picks/${corkage.id}`, { quantity: 2 });

    const response = await request(server, "GET", "/api/weddings/wedding-1/catering/selection/price");

    assert.equal(response.status, 200);
    assert.equal(response.body.packageSubtotal, 37400);
    assert.equal(response.body.addonsSubtotal, 3350);
    assert.equal(response.body.total, 40750);
  });

  it("syncs meal options idempotently", async () => {
    await selectPackage("Złoty", 100);
    const main = course(pkg("Złoty").id, "obiad_danie_glowne");
    for (const dish of linkedDishes(main.id).slice(0, 3)) {
      await request(server, "POST", "/api/weddings/wedding-1/catering/selection/dish-picks", {
        courseId: main.id,
        dishId: dish.id,
      });
    }

    const first = await request(server, "POST", "/api/weddings/wedding-1/catering/selection/sync-meal-options");
    const second = await request(server, "POST", "/api/weddings/wedding-1/catering/selection/sync-meal-options");

    assert.equal(first.status, 200);
    assert.equal(first.body.created, 3);
    assert.equal(second.body.created, 0);
    assert.equal(db.meal_options.length, 3);
  });

  it("freezes the selection into a contract with two payments", async () => {
    await selectPackage("Złoty", 100);
    const covers = db.catering_addons.find((addon) => addon.name === "Pokrowce na krzesla");
    const country = db.catering_addons.find((addon) => addon.name === "Wiejski stół");
    await request(server, "PUT", `/api/weddings/wedding-1/catering/selection/addon-picks/${covers.id}`, { quantity: 1 });
    await request(server, "PUT", `/api/weddings/wedding-1/catering/selection/addon-picks/${country.id}`, { quantity: 1 });

    const response = await request(server, "POST", "/api/weddings/wedding-1/catering/selection/freeze-into-contract", {
      vendorId: "vendor-1",
      signedDate: "2026-05-27",
      deposit: { amount: 10000, dueDate: "2026-06-01", method: "przelew" },
      finalPayment: { amount: 30700, dueDate: "2026-07-20", method: "przelew" },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.contract.totalAmount, 40700);
    assert.equal(response.body.payments.length, 2);
    assert.equal(db.contracts.length, 1);
    assert.equal(db.payments.length, 2);
  });

  it("rejects freeze with a non-catering vendor category", async () => {
    await selectPackage("Złoty", 100);
    const response = await request(server, "POST", "/api/weddings/wedding-1/catering/selection/freeze-into-contract", {
      vendorId: "photo-1",
    });

    assert.equal(response.status, 400);
  });

  it("rejects freeze when deposit and final payment do not match total", async () => {
    await selectPackage("Złoty", 100);
    const response = await request(server, "POST", "/api/weddings/wedding-1/catering/selection/freeze-into-contract", {
      vendorId: "vendor-1",
      deposit: { amount: 100, dueDate: "2026-06-01", method: "przelew" },
      finalPayment: { amount: 100, dueDate: "2026-07-20", method: "przelew" },
    });

    assert.equal(response.status, 400);
    assert.equal(db.contracts.length, 0);
    assert.equal(db.payments.length, 0);
  });
});
