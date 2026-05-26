const DEFAULT_BUDGET_CATEGORIES = [
  "Sala weselna",
  "Catering",
  "Fotograf",
  "Kwiaty",
  "Dekoracje",
  "Muzyka / DJ",
  "Stylizacja panny mlodej",
  "Stylizacja pana mlodego",
  "USC / formalnosci",
  "Alkohol",
  "Tort",
  "Transport gosci",
  "Hotel dla gosci",
  "Obraczki",
  "Zaproszenia i papeteria",
].map((name, sortOrder) => ({
  name,
  sort_order: sortOrder + 1,
}));

const DEFAULT_TABLES = Array.from({ length: 12 }, (_, index) => ({
  name: `Stol ${index + 1}`,
  seats_count: 8,
  sort_order: index + 1,
}));

module.exports = {
  DEFAULT_BUDGET_CATEGORIES,
  DEFAULT_TABLES,
};
