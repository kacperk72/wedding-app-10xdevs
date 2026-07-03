#!/usr/bin/env node
/**
 * Wypełnia KONTO DEMO (wesele "Maria & Piotr", użytkownik demo@wedding-planner.pll)
 * spójnym zestawem danych, aby każda zakładka prezentowała możliwości systemu.
 *
 * Uruchom z katalogu wedding-planner/backend/:
 *   node scripts/seed-demo.js            # zasiej (czyści dane domeny demo i wstawia od nowa)
 *   node scripts/seed-demo.js --dry-run  # tylko pokaż plan, nic nie zapisuj
 *
 * BEZPIECZEŃSTWO: skrypt twardo przerywa działanie, jeśli docelowe wesele
 * nie jest dokładnie demem (nazwy partnerów + twórca). NIGDY nie ruszy danych
 * realnej pary (Kacper & Weronika).
 */

process.chdir(require("path").resolve(__dirname, ".."));
require("dotenv").config();
const { supabase } = require("../src/config/database");

const DEMO_WEDDING_ID = "6ca567b1-0487-4830-b358-8824f4614e2f";
const DEMO_USER_ID = "056cc455-abaf-43db-a76b-19b556e83ec4";
const DRY = process.argv.includes("--dry-run");

// Daty względem dnia ślubu 2026-07-25 (dziś ~2026-06-21).
const d = (s) => s; // czytelność: 'YYYY-MM-DD'
const ts = (s) => s; // timestamptz ISO

async function ins(table, rows, returning = "id") {
  if (DRY) {
    console.log(`  [dry] insert ${rows.length} -> ${table}`);
    return rows.map((_, i) => ({ id: `dry-${table}-${i}` }));
  }
  const { data, error } = await supabase.from(table).insert(rows).select(returning);
  if (error) throw new Error(`insert ${table}: ${error.message}`);
  return data;
}

async function wipeDemoDomain() {
  // Kasujemy tylko dane domeny scope'owane wedding_id = DEMO.
  // contracts/payments kaskadują z vendors; catering_* kaskadują z catering_offers;
  // dish/addon picks kaskadują z wedding_catering_selection.
  const scoped = [
    "seating_conflicts",
    "expenses",
    "tasks",
    "meetings",
    "wedding_catering_selection",
    "catering_offers",
    "vendors",
    "guests",
    "meal_options",
  ];
  for (const t of scoped) {
    if (DRY) {
      console.log(`  [dry] delete where wedding_id=DEMO -> ${t}`);
      continue;
    }
    const { error } = await supabase.from(t).delete().eq("wedding_id", DEMO_WEDDING_ID);
    if (error) throw new Error(`delete ${t}: ${error.message}`);
  }
  // Goście odpięci od stołów — zerujemy ewentualne stare table_id (stoły zostają z bootstrapu).
}

async function main() {
  // --- TWARDA ASERCJA BEZPIECZEŃSTWA ---
  const { data: w, error: wErr } = await supabase
    .from("weddings")
    .select("id,partner_a_name,partner_b_name,created_by_user_id")
    .eq("id", DEMO_WEDDING_ID)
    .single();
  if (wErr || !w) throw new Error(`Nie znaleziono wesela demo: ${wErr?.message}`);
  if (
    w.partner_a_name !== "Maria" ||
    w.partner_b_name !== "Piotr" ||
    w.created_by_user_id !== DEMO_USER_ID
  ) {
    throw new Error(
      `STOP: wesele ${DEMO_WEDDING_ID} nie wygląda na demo ` +
        `(${w.partner_a_name} & ${w.partner_b_name}, twórca ${w.created_by_user_id}). Przerywam.`,
    );
  }
  console.log(`Cel: wesele DEMO ${w.partner_a_name} & ${w.partner_b_name} (${DEMO_WEDDING_ID})`);
  console.log(DRY ? "TRYB DRY-RUN — nic nie zapisuję.\n" : "Czyszczę i zasiewam dane demo...\n");

  await wipeDemoDomain();

  // --- weddings.budget_total (budżet planowany) ---
  if (!DRY) {
    const { error } = await supabase
      .from("weddings")
      .update({ budget_total: 85000 })
      .eq("id", DEMO_WEDDING_ID);
    if (error) throw new Error(`update budget_total: ${error.message}`);
  }
  console.log("budget_total = 85 000 zł");

  // --- istniejące stoły i kategorie budżetu (z bootstrapu) ---
  const { data: tablesRows } = await supabase
    .from("tables")
    .select("id,name,sort_order")
    .eq("wedding_id", DEMO_WEDDING_ID)
    .order("sort_order");
  const { data: catRows } = await supabase
    .from("budget_categories")
    .select("id,name")
    .eq("wedding_id", DEMO_WEDDING_ID);
  const cat = (name) => {
    const c = (catRows || []).find((x) => x.name === name);
    return c ? c.id : null;
  };
  const tableId = (i) => (tablesRows && tablesRows[i] ? tablesRows[i].id : null);

  // --- meal_options ---
  const meals = await ins("meal_options", [
    { wedding_id: DEMO_WEDDING_ID, label: "Danie mięsne (filet z kaczki)", sort_order: 1 },
    { wedding_id: DEMO_WEDDING_ID, label: "Danie rybne (sandacz)", sort_order: 2 },
    { wedding_id: DEMO_WEDDING_ID, label: "Wegetariańskie", sort_order: 3 },
    { wedding_id: DEMO_WEDDING_ID, label: "Wegańskie", sort_order: 4 },
    { wedding_id: DEMO_WEDDING_ID, label: "Menu dziecięce", sort_order: 5 },
  ]);
  const M = (i) => meals[i].id;
  console.log(`meal_options: ${meals.length}`);

  // --- guests (mix relacji / rsvp / diety; część rozsadzona przy stołach) ---
  const REL = {
    rpm: "rodzina_panny_mlodej",
    rpan: "rodzina_pana_mlodego",
    ppm: "przyjaciele_panny_mlodej",
    ppan: "przyjaciele_pana_mlodego",
    praca: "znajomi_z_pracy",
    wsp: "wspolni_znajomi",
  };
  const g = (first, last, relation, rsvp, diet, opts = {}) => ({
    wedding_id: DEMO_WEDDING_ID,
    first_name: first,
    last_name: last,
    relation,
    rsvp_status: rsvp,
    diet,
    has_plus_one: !!opts.plus,
    is_child: !!opts.child,
    meal_option_id: opts.meal ?? null,
    table_id: opts.table ?? null,
    seat_number: opts.seat ?? null,
    contact_phone: opts.phone ?? null,
    contact_email: opts.email ?? null,
  });
  const guestRows = [
    g("Anna", "Kowalska", REL.rpm, "confirmed", "standard", { meal: M(0), table: tableId(0), seat: 1, phone: "501 234 567" }),
    g("Marek", "Kowalski", REL.rpm, "confirmed", "standard", { meal: M(0), table: tableId(0), seat: 2 }),
    g("Ewa", "Nowak", REL.rpm, "confirmed", "vege", { meal: M(2), table: tableId(0), seat: 3 }),
    g("Tomasz", "Nowak", REL.rpm, "confirmed", "standard", { meal: M(0), table: tableId(0), seat: 4, plus: true }),
    g("Krystyna", "Wiśniewska", REL.rpan, "confirmed", "standard", { meal: M(1), table: tableId(1), seat: 1 }),
    g("Janusz", "Wiśniewski", REL.rpan, "confirmed", "standard", { meal: M(0), table: tableId(1), seat: 2 }),
    g("Paweł", "Zieliński", REL.rpan, "pending", "pending", {}),
    g("Magdalena", "Zielińska", REL.rpan, "declined", "pending", {}),
    g("Karolina", "Lewandowska", REL.ppm, "confirmed", "vegan", { meal: M(3), table: tableId(2), seat: 1, email: "karolina.l@example.com" }),
    g("Aleksandra", "Dąbrowska", REL.ppm, "confirmed", "standard", { meal: M(0), table: tableId(2), seat: 2, plus: true }),
    g("Natalia", "Kamińska", REL.ppm, "confirmed", "gluten_free", { meal: M(2), table: tableId(2), seat: 3 }),
    g("Zofia", "Kozłowska", REL.ppm, "pending", "pending", {}),
    g("Bartosz", "Wójcik", REL.ppan, "confirmed", "standard", { meal: M(0), table: tableId(3), seat: 1 }),
    g("Michał", "Kwiatkowski", REL.ppan, "confirmed", "standard", { meal: M(1), table: tableId(3), seat: 2 }),
    g("Grzegorz", "Mazur", REL.ppan, "confirmed", "standard", { meal: M(0), table: tableId(3), seat: 3, plus: true }),
    g("Damian", "Krawczyk", REL.ppan, "pending", "pending", {}),
    g("Agnieszka", "Piotrowska", REL.praca, "confirmed", "standard", { meal: M(0), table: tableId(4), seat: 1 }),
    g("Robert", "Grabowski", REL.praca, "confirmed", "vege", { meal: M(2), table: tableId(4), seat: 2 }),
    g("Joanna", "Pawłowska", REL.praca, "declined", "pending", {}),
    g("Kacper", "Michalski", REL.wsp, "confirmed", "standard", { meal: M(0), table: tableId(5), seat: 1 }),
    g("Weronika", "Jankowska", REL.wsp, "confirmed", "standard", { meal: M(1), table: tableId(5), seat: 2, plus: true }),
    g("Szymon", "Wojciechowski", REL.wsp, "pending", "pending", {}),
    g("Lena", "Kowalska", REL.rpm, "confirmed", "standard", { meal: M(4), table: tableId(0), seat: 5, child: true }),
    g("Filip", "Wiśniewski", REL.rpan, "confirmed", "standard", { meal: M(4), table: tableId(1), seat: 3, child: true }),
    g("Maria", "Adamczyk", REL.ppm, "pending", "pending", {}),
    g("Piotr", "Dudek", REL.wsp, "confirmed", "vegan", { meal: M(3), table: tableId(5), seat: 3 }),
  ];
  const guests = await ins("guests", guestRows, "id,first_name,last_name");
  console.log(`guests: ${guests.length}`);

  // --- vendors (jeden na kluczową kategorię, zróżnicowane statusy) ---
  const v = (category, company, status, amount, opts = {}) => ({
    wedding_id: DEMO_WEDDING_ID,
    category,
    company_name: company,
    contact_person: opts.person ?? null,
    phone: opts.phone ?? null,
    email: opts.email ?? null,
    status,
    contract_amount: amount,
    notes: opts.notes ?? null,
  });
  const vendorRows = [
    v("sala", "Pałac Polanka", "oplacony", 28000, { person: "Biuro Eventów", phone: "13 432 10 00", email: "rezerwacje@palacpolanka.pl", notes: "Sala na 120 osób, taras." }),
    v("catering", "Catering Pałac Polanka", "umowa_podpisana", 24000, { person: "Szef kuchni", email: "kuchnia@palacpolanka.pl" }),
    v("fotograf", "Foto Studio Klisza", "zarezerwowany", 6500, { person: "Adam Klisza", phone: "600 100 200" }),
    v("dj", "DJ Maestro", "zaliczka_wplacona", 4500, { person: "Łukasz", phone: "660 700 800" }),
    v("dekoratorka", "Kwiatowy Zakątek", "spotkanie", 5200, { person: "Iwona", notes: "Dekoracje sali + bukiet." }),
    v("kosciol", "Parafia św. Anny w Krośnie", "zarezerwowany", 1500, { notes: "Ofiara + organista." }),
    v("makijaz", "Make-up by Ania", "rozwazany", 900, { phone: "722 333 444" }),
    v("slodki_stol_tort", "Cukiernia Słodki Sen", "umowa_podpisana", 2800, { person: "Beata", notes: "Tort 3-piętrowy + słodki stół." }),
  ];
  const vendors = await ins("vendors", vendorRows, "id,category,company_name");
  const V = (category) => vendors.find((x) => x.category === category)?.id;
  console.log(`vendors: ${vendors.length}`);

  // --- contracts (dla części kontrahentów) + payments ---
  const contractRows = [
    { wedding_id: DEMO_WEDDING_ID, vendor_id: V("sala"), total_amount: 28000, signed_date: d("2026-02-10"), status: "paid_in_full" },
    { wedding_id: DEMO_WEDDING_ID, vendor_id: V("catering"), total_amount: 24000, signed_date: d("2026-03-05"), status: "deposit_paid" },
    { wedding_id: DEMO_WEDDING_ID, vendor_id: V("fotograf"), total_amount: 6500, signed_date: d("2026-04-12"), status: "in_progress" },
    { wedding_id: DEMO_WEDDING_ID, vendor_id: V("dj"), total_amount: 4500, signed_date: d("2026-04-20"), status: "deposit_paid" },
    { wedding_id: DEMO_WEDDING_ID, vendor_id: V("slodki_stol_tort"), total_amount: 2800, signed_date: d("2026-05-02"), status: "in_progress" },
  ];
  const contracts = await ins("contracts", contractRows, "id,vendor_id");
  const C = (category) => contracts.find((x) => x.vendor_id === V(category))?.id;
  console.log(`contracts: ${contracts.length}`);

  const pay = (cid, kind, due, amount, status, method, paid_at = null) => ({
    contract_id: cid,
    kind,
    due_date: due,
    amount,
    status,
    method,
    paid_at,
  });
  const paymentRows = [
    // Sala — opłacone w całości
    pay(C("sala"), "zaliczka", d("2026-02-15"), 8000, "paid", "przelew", d("2026-02-15")),
    pay(C("sala"), "final", d("2026-06-01"), 20000, "paid", "przelew", d("2026-06-01")),
    // Catering — zaliczka zapłacona, reszta nadchodzi (w oknie 30 dni)
    pay(C("catering"), "zaliczka", d("2026-03-10"), 6000, "paid", "przelew", d("2026-03-10")),
    pay(C("catering"), "final", d("2026-07-15"), 18000, "planned", "przelew"),
    // Fotograf — zaliczka nadchodzi
    pay(C("fotograf"), "zaliczka", d("2026-06-30"), 2000, "planned", "przelew"),
    pay(C("fotograf"), "final", d("2026-08-05"), 4500, "planned", "przelew"),
    // DJ — zaliczka zapłacona gotówką, final nadchodzi
    pay(C("dj"), "zaliczka", d("2026-04-25"), 1500, "paid", "gotowka", d("2026-04-25")),
    pay(C("dj"), "final", d("2026-07-20"), 3000, "planned", "przelew"),
    // Tort — zaliczka po terminie (overdue) — pokazuje alert
    pay(C("slodki_stol_tort"), "zaliczka", d("2026-06-10"), 800, "overdue", "przelew"),
    pay(C("slodki_stol_tort"), "final", d("2026-07-22"), 2000, "planned", "gotowka"),
  ];
  const payments = await ins("payments", paymentRows, "id");
  console.log(`payments: ${payments.length}`);

  // --- expenses (budżet rzeczywisty; część powiązana z kontrahentem) ---
  const e = (categoryName, description, amount, spent_on, vendorCat = null) => ({
    wedding_id: DEMO_WEDDING_ID,
    category_id: cat(categoryName),
    vendor_id: vendorCat ? V(vendorCat) : null,
    description,
    amount,
    spent_on,
  });
  const expenseRows = [
    e("Sala weselna", "Pałac Polanka — całość", 28000, d("2026-06-01"), "sala"),
    e("Catering", "Zaliczka catering", 6000, d("2026-03-10"), "catering"),
    e("Fotograf", "Sesja narzeczeńska", 800, d("2026-05-15"), "fotograf"),
    e("Muzyka / DJ", "Zaliczka DJ", 1500, d("2026-04-25"), "dj"),
    e("Obrączki", "Obrączki — jubiler", 3200, d("2026-04-02")),
    e("Zaproszenia i papeteria", "Zaproszenia (60 szt.)", 720, d("2026-03-20")),
    e("Dekoracje", "Zaliczka dekoracje", 1000, d("2026-05-28"), "dekoratorka"),
    e("Tort", "Zaliczka tort + słodki stół", 800, d("2026-06-10"), "slodki_stol_tort"),
    e("Stylizacja panny młodej", "Suknia ślubna", 4500, d("2026-04-18")),
    e("Stylizacja pana młodego", "Garnitur", 2200, d("2026-05-05")),
  ].filter((row) => row.category_id);
  const expenses = await ins("expenses", expenseRows, "id");
  console.log(`expenses: ${expenses.length}`);

  // --- tasks (część zrobiona, część nadchodząca) ---
  const t = (title, category, due, done, description = null) => ({
    wedding_id: DEMO_WEDDING_ID,
    title,
    description,
    category,
    due_date: due,
    done,
    done_at: done ? ts("2026-05-01T10:00:00Z") : null,
  });
  const taskRows = [
    t("Zarezerwować salę weselną", "kontrahent", d("2026-02-01"), true),
    t("Podpisać umowę z cateringiem", "kontrahent", d("2026-03-05"), true),
    t("Wybrać fotografa", "kontrahent", d("2026-04-10"), true),
    t("Zamówić zaproszenia", "goscie", d("2026-03-15"), true),
    t("Wysłać zaproszenia do gości", "goscie", d("2026-06-25"), false, "Dopnij adresy 3 brakujących gości."),
    t("Przymiarka sukni — termin finalny", "stroj", d("2026-07-01"), false),
    t("Spotkanie z dekoratorką", "kontrahent", d("2026-06-28"), false),
    t("Potwierdzić ostateczną liczbę gości", "goscie", d("2026-07-18"), false),
    t("Dostarczyć dokumenty do USC", "formalnosci", d("2026-07-05"), false),
    t("Ustalić przebieg dnia z DJ-em", "kontrahent", d("2026-07-20"), false),
  ];
  const tasks = await ins("tasks", taskRows, "id");
  console.log(`tasks: ${tasks.length}`);

  // --- meetings (nadchodzące — pokażą się na dashboardzie) ---
  const mtg = (title, starts_at, vendorCat, location, notes = null) => ({
    wedding_id: DEMO_WEDDING_ID,
    vendor_id: vendorCat ? V(vendorCat) : null,
    title,
    starts_at,
    location,
    notes,
  });
  const meetingRows = [
    mtg("Degustacja menu", ts("2026-06-28T12:00:00Z"), "catering", "Pałac Polanka", "Wybór dań głównych i deseru."),
    mtg("Spotkanie z dekoratorką", ts("2026-07-02T16:00:00Z"), "dekoratorka", "Kwiatowy Zakątek", "Kolorystyka + bukiet."),
    mtg("Próba z DJ-em", ts("2026-07-15T18:00:00Z"), "dj", "Online", "Lista utworów, przebieg wieczoru."),
    mtg("Spotkanie w USC", ts("2026-07-08T10:30:00Z"), null, "USC Krosno", "Formalności przedślubne."),
  ];
  const meetings = await ins("meetings", meetingRows, "id");
  console.log(`meetings: ${meetings.length}`);

  // --- seating_conflicts (free text) ---
  const byName = (f, l) => guests.find((x) => x.first_name === f && x.last_name === l)?.id;
  const conflictRows = [
    {
      wedding_id: DEMO_WEDDING_ID,
      guest_a_id: byName("Magdalena", "Zielińska"),
      guest_b_id: byName("Paweł", "Zieliński"),
      reason: "Po rozwodzie — nie sadzać przy jednym stole.",
    },
    {
      wedding_id: DEMO_WEDDING_ID,
      guest_a_id: byName("Robert", "Grabowski"),
      guest_b_id: byName("Agnieszka", "Piotrowska"),
      reason: "Konflikt w pracy — najlepiej osobne stoły.",
    },
  ].filter((r) => r.guest_a_id && r.guest_b_id);
  const conflicts = await ins("seating_conflicts", conflictRows, "id");
  console.log(`seating_conflicts: ${conflicts.length}`);

  // --- CATERING: offer -> package -> courses -> dishes -> links -> addons -> selection -> picks ---
  const [offer] = await ins(
    "catering_offers",
    [
      {
        wedding_id: DEMO_WEDDING_ID,
        vendor_id: V("catering"),
        name: "Oferta Pałac Polanka 2026",
        valid_through: d("2026-12-31"),
        notes: "Pakiety weselne — model z katalogu Pałac Polanka.",
      },
    ],
    "id",
  );
  const offerId = offer.id;

  const [pkg] = await ins(
    "catering_packages",
    [
      {
        catering_offer_id: offerId,
        name: "Pakiet Srebrny",
        price_per_person: 320,
        is_modifiable: true,
        description: "Obiad 3-daniowy, bufet zimny, tort, napoje bez limitu.",
        sort_order: 1,
      },
    ],
    "id",
  );
  const pkgId = pkg.id;

  // Dania (należą do oferty)
  const dishRows = [
    { catering_offer_id: offerId, name: "Rosół z domowym makaronem", description: "Tradycyjny rosół.", is_vegetarian: false, is_vegan: false, is_gluten_free: false },
    { catering_offer_id: offerId, name: "Krem z pomidorów", description: "Z bazylią.", is_vegetarian: true, is_vegan: true, is_gluten_free: true },
    { catering_offer_id: offerId, name: "Filet z kaczki z żurawiną", description: "Z kluskami śląskimi.", is_vegetarian: false, is_vegan: false, is_gluten_free: false },
    { catering_offer_id: offerId, name: "Sandacz w sosie cytrynowym", description: "Z warzywami.", is_vegetarian: false, is_vegan: false, is_gluten_free: true },
    { catering_offer_id: offerId, name: "Risotto z warzywami", description: "Wegetariańskie.", is_vegetarian: true, is_vegan: false, is_gluten_free: true },
    { catering_offer_id: offerId, name: "Tarta owocowa", description: "Sezonowa.", is_vegetarian: true, is_vegan: false, is_gluten_free: false },
    { catering_offer_id: offerId, name: "Panna cotta", description: "Z musem malinowym.", is_vegetarian: true, is_vegan: false, is_gluten_free: true },
    { catering_offer_id: offerId, name: "Deska serów i wędlin", description: "Bufet zimny.", is_vegetarian: false, is_vegan: false, is_gluten_free: false },
    { catering_offer_id: offerId, name: "Sałatka grecka", description: "Bufet zimny.", is_vegetarian: true, is_vegan: false, is_gluten_free: true },
  ];
  const dishes = await ins("catering_dishes", dishRows, "id,name");
  const D = (name) => dishes.find((x) => x.name === name)?.id;

  // Kursy (należą do pakietu)
  const courseRows = [
    { catering_package_id: pkgId, course_type: "obiad_zupa", title: "Zupa", selection_mode: "couple_picks", choice_limit: 1, sort_order: 1 },
    { catering_package_id: pkgId, course_type: "obiad_danie_glowne", title: "Danie główne", selection_mode: "couple_picks", choice_limit: 2, sort_order: 2 },
    { catering_package_id: pkgId, course_type: "obiad_deser", title: "Deser", selection_mode: "couple_picks", choice_limit: 1, sort_order: 3 },
    { catering_package_id: pkgId, course_type: "bufet_zimny", title: "Bufet zimny", selection_mode: "all_served", choice_limit: null, sort_order: 4 },
  ];
  const courses = await ins("catering_courses", courseRows, "id,course_type");
  const CO = (type) => courses.find((x) => x.course_type === type)?.id;

  // Powiązania kurs<->danie (ten sam offer — wymóg triggera)
  const link = (courseType, dishName, order) => ({
    catering_course_id: CO(courseType),
    catering_dish_id: D(dishName),
    sort_order: order,
  });
  const linkRows = [
    link("obiad_zupa", "Rosół z domowym makaronem", 1),
    link("obiad_zupa", "Krem z pomidorów", 2),
    link("obiad_danie_glowne", "Filet z kaczki z żurawiną", 1),
    link("obiad_danie_glowne", "Sandacz w sosie cytrynowym", 2),
    link("obiad_danie_glowne", "Risotto z warzywami", 3),
    link("obiad_deser", "Tarta owocowa", 1),
    link("obiad_deser", "Panna cotta", 2),
    link("bufet_zimny", "Deska serów i wędlin", 1),
    link("bufet_zimny", "Sałatka grecka", 2),
  ];
  await ins("catering_course_dishes", linkRows, "catering_course_id");
  console.log(`catering: offer + pakiet + ${courses.length} kursy + ${dishes.length} dania + ${linkRows.length} powiązań`);

  // Dodatki
  const addonRows = [
    { catering_offer_id: offerId, name: "Open bar (drinki)", price: 45, pricing_unit: "per_person", description: "Bez limitu przez 5h.", sort_order: 1 },
    { catering_offer_id: offerId, name: "Tort weselny", price: 1200, pricing_unit: "per_event", description: "3 piętra.", sort_order: 2 },
    { catering_offer_id: offerId, name: "Wino na stoły", price: 35, pricing_unit: "per_bottle", description: "Czerwone/białe.", sort_order: 3 },
  ];
  const addons = await ins("catering_addons", addonRows, "id,name");
  const A = (name) => addons.find((x) => x.name === name)?.id;

  // Wybór pary (selection) + dish picks + addon picks
  const [sel] = await ins(
    "wedding_catering_selection",
    [
      {
        wedding_id: DEMO_WEDDING_ID,
        catering_package_id: pkgId,
        guest_count_estimate: 80,
        notes: "Wstępny wybór — do potwierdzenia po RSVP.",
      },
    ],
    "id",
  );
  const selId = sel.id;

  // Picki tylko dla kursów couple_picks (zgodnie z triggerem: danie musi być w kursie)
  const pickRows = [
    { wedding_catering_selection_id: selId, catering_course_id: CO("obiad_zupa"), catering_dish_id: D("Rosół z domowym makaronem") },
    { wedding_catering_selection_id: selId, catering_course_id: CO("obiad_danie_glowne"), catering_dish_id: D("Filet z kaczki z żurawiną") },
    { wedding_catering_selection_id: selId, catering_course_id: CO("obiad_danie_glowne"), catering_dish_id: D("Risotto z warzywami") },
    { wedding_catering_selection_id: selId, catering_course_id: CO("obiad_deser"), catering_dish_id: D("Panna cotta") },
  ];
  await ins("wedding_catering_dish_picks", pickRows, "catering_course_id");

  const addonPickRows = [
    { wedding_catering_selection_id: selId, catering_addon_id: A("Open bar (drinki)"), quantity: 1 },
    { wedding_catering_selection_id: selId, catering_addon_id: A("Tort weselny"), quantity: 1 },
    { wedding_catering_selection_id: selId, catering_addon_id: A("Wino na stoły"), quantity: 40 },
  ];
  await ins("wedding_catering_addon_picks", addonPickRows, "catering_addon_id");
  console.log(`catering selection: pakiet wybrany, ${pickRows.length} picków dań, ${addonPickRows.length} dodatków`);

  console.log("\n✅ Gotowe. Konto demo (Maria & Piotr) wypełnione danymi we wszystkich zakładkach.");
}

main().catch((e) => {
  console.error("\n❌ BŁĄD:", e.message);
  process.exit(1);
});
