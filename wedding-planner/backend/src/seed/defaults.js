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
  planned_amount: 0,
  sort_order: sortOrder + 1,
}));

const DEFAULT_TABLES = Array.from({ length: 12 }, (_, index) => ({
  name: `Stol ${index + 1}`,
  seats_count: 8,
  sort_order: index + 1,
}));

const TASK_TEMPLATES = [
  {
    title: "Ustal budzet wesela",
    category: "inne",
    days_before_wedding: 365,
    sort_order: 10,
  },
  {
    title: "Zarezerwuj sale weselna",
    category: "kontrahent",
    days_before_wedding: 365,
    sort_order: 20,
  },
  {
    title: "Wybierz fotografa",
    category: "kontrahent",
    days_before_wedding: 300,
    sort_order: 30,
  },
  {
    title: "Spotkanie z DJ-em - wybor wykonawcy",
    category: "kontrahent",
    days_before_wedding: 240,
    sort_order: 40,
  },
  {
    title: "Przygotuj wstepna liste gosci",
    category: "goscie",
    days_before_wedding: 210,
    sort_order: 50,
  },
  {
    title: "Wybierz zaproszenia",
    category: "goscie",
    days_before_wedding: 180,
    sort_order: 60,
  },
  {
    title: "Wyslij zaproszenia",
    category: "goscie",
    days_before_wedding: 150,
    sort_order: 70,
  },
  {
    title: "Dopnij formalnosci USC / kosciol",
    category: "formalnosci",
    days_before_wedding: 120,
    sort_order: 80,
  },
  {
    title: "Wybor menu z cateringiem",
    category: "kontrahent",
    days_before_wedding: 90,
    sort_order: 90,
  },
  {
    title: "Przymiarka sukni i garnituru",
    category: "stroj",
    days_before_wedding: 60,
    sort_order: 100,
  },
  {
    title: "Przygotuj plan rozsadzenia gosci",
    category: "goscie",
    days_before_wedding: 30,
    sort_order: 110,
  },
  {
    title: "Potwierdz ostateczna liczbe gosci",
    category: "goscie",
    days_before_wedding: 14,
    sort_order: 120,
  },
  {
    title: "Finalne rozliczenia z kontrahentami",
    category: "kontrahent",
    days_before_wedding: 7,
    sort_order: 130,
  },
];

module.exports = {
  DEFAULT_BUDGET_CATEGORIES,
  DEFAULT_TABLES,
  TASK_TEMPLATES,
};
