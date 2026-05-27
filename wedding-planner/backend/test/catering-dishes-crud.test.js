const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

describe("catering dishes", () => {
  let server;
  let db;

  beforeEach(async () => {
    const app = await createTestServer({
      catering_offers: [
        { id: "offer-1", wedding_id: "wedding-1", name: "Oferta", vendor_id: null },
        { id: "foreign-offer", wedding_id: "wedding-2", name: "Foreign", vendor_id: null },
      ],
      catering_packages: [
        { id: "package-1", catering_offer_id: "offer-1", name: "Pakiet", price_per_person: 100, is_modifiable: true, sort_order: 1 },
      ],
      catering_courses: [
        { id: "course-1", catering_package_id: "package-1", course_type: "obiad_danie_glowne", title: "Danie", selection_mode: "guest_picks", choice_limit: 3, sort_order: 1 },
      ],
      catering_dishes: [
        { id: "dish-1", catering_offer_id: "offer-1", name: "Danie bazowe", is_vegetarian: false, is_vegan: false, is_gluten_free: false, allergens: [] },
      ],
      catering_course_dishes: [
        { catering_course_id: "course-1", catering_dish_id: "dish-1", sort_order: 1 },
      ],
    });
    server = app.server;
    db = app.db;
  });

  afterEach(async () => {
    if (server) await close(server);
    clearAppCache();
  });

  it("creates a custom vegetarian dish with flags", async () => {
    const response = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/catering/dishes/offers/offer-1/dishes",
      {
        name: "Roladka z baklazana",
        description: "Ricotta i szpinak",
        isVegetarian: true,
        isVegan: false,
        isGlutenFree: true,
        allergens: ["mleko"],
      },
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.isVegetarian, true);
    assert.equal(response.body.isGlutenFree, true);
    assert.deepEqual(response.body.allergens, ["mleko"]);
  });

  it("links a custom vegetarian dish to a course", async () => {
    const created = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/catering/dishes/offers/offer-1/dishes",
      {
        name: "Kotlety z ciecierzycy",
        isVegetarian: true,
        isVegan: true,
        isGlutenFree: false,
      },
    );

    const linked = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/catering/courses/course-1/dishes",
      { cateringDishId: created.body.dishId },
    );

    assert.equal(linked.status, 201);
    assert.equal(
      db.catering_course_dishes.some(
        (link) => link.catering_course_id === "course-1" && link.catering_dish_id === created.body.dishId,
      ),
      true,
    );
  });

  it("deletes a dish and unlinks it from courses", async () => {
    const response = await request(
      server,
      "DELETE",
      "/api/weddings/wedding-1/catering/dishes/dish-1",
    );

    assert.equal(response.status, 204);
    assert.equal(db.catering_dishes.some((dish) => dish.id === "dish-1"), false);
    assert.equal(db.catering_course_dishes.length, 0);
  });

  it("rejects writes through a cross-wedding offer", async () => {
    const response = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/catering/dishes/offers/foreign-offer/dishes",
      { name: "Bad" },
    );

    assert.equal(response.status, 404);
  });
});
