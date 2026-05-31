const DEFAULT_BUDGET_CATEGORIES = [
  "Sala weselna",
  "Catering",
  "Fotograf",
  "Kwiaty",
  "Dekoracje",
  "Muzyka / DJ",
  "Stylizacja panny młodej",
  "Stylizacja pana młodego",
  "USC / formalności",
  "Alkohol",
  "Tort",
  "Transport gości",
  "Hotel dla gości",
  "Obrączki",
  "Zaproszenia i papeteria",
].map((name, sortOrder) => ({
  name,
  sort_order: sortOrder + 1,
}));

const DEFAULT_TABLES = Array.from({ length: 12 }, (_, index) => ({
  name: `Stół ${index + 1}`,
  seats_count: 8,
  sort_order: index + 1,
}));

module.exports = {
  DEFAULT_BUDGET_CATEGORIES,
  DEFAULT_TABLES,
};
