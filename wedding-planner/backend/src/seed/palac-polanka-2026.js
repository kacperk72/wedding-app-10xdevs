const packages = [
  {
    key: "chef",
    name: "Szefa Kuchni",
    pricePerPerson: 315,
    isModifiable: false,
    description: "Autorski, sztywny pakiet Szefa Kuchni z wybranym menu.",
    sortOrder: 1,
  },
  {
    key: "silver",
    name: "Srebrny",
    pricePerPerson: 339,
    isModifiable: true,
    description: "Obiad, dwie ciepłe kolacje, bufety i napoje.",
    sortOrder: 2,
  },
  {
    key: "gold",
    name: "Złoty",
    pricePerPerson: 374,
    isModifiable: true,
    description: "Obiad, trzy ciepłe kolacje, rozszerzony bufet zimny, sałatki i napoje.",
    sortOrder: 3,
  },
  {
    key: "diamond",
    name: "Diamentowy",
    pricePerPerson: 399,
    isModifiable: true,
    description: "Najszerszy pakiet z czterema ciepłymi kolacjami i największym bufetem.",
    sortOrder: 4,
  },
];

const dishes = [
  { key: "proziak", name: "Podkarpacki proziak z masłem czosnkowym" },
  { key: "focaccia", name: "Focaccia z humusem", isVegetarian: true },
  { key: "terrina", name: "Terrina drobiowa z konfitura cebulowa" },
  { key: "carpaccio_burak", name: "Carpaccio z buraka z serem kozim", isVegetarian: true },
  { key: "mini_burrata", name: "Mini burrata z pesto bazyliowym", isVegetarian: true },

  { key: "rosol_domowy", name: "Domowy rosol z makaronem, marchewka i natka pietruszki" },
  { key: "rosol_krolewski", name: "Rosol krolewski z koldunami" },
  { key: "krem_grzybowy", name: "Krem grzybowy z makaronem grandine", isVegetarian: true },
  { key: "krem_warzywny", name: "Krem warzywny z oliwa ziolowa", isVegetarian: true },
  { key: "krem_ogorek", name: "Krem z kiszonego ogorka z chipsami z boczku" },
  { key: "krem_pomidorowy", name: "Krem pomidorowy z mascarpone", isVegetarian: true },
  { key: "krem_brokulowy", name: "Krem brokulowy z prazonym slonecznikiem", isVegetarian: true },
  { key: "krem_paprykowy", name: "Krem pomidorowo-paprykowy" },

  { key: "schab_nadziewany", name: "Schab nadziewany suszona sliwka" },
  { key: "pieczen_wieprzowa", name: "Pieczen wieprzowa w sosie wlasnym" },
  { key: "pieczen_indyk", name: "Pieczen z indyka w sosie smietanowym" },
  { key: "udko_kaczka", name: "Udko z kaczki z jablkiem i zurawina" },
  {
    key: "poledwiczka",
    name: "Poledwiczka wieprzowa marynowana w tymianku z puree truflowym",
  },

  { key: "roladka_drobiowa", name: "Roladka drobiowa ze szpinakiem" },
  { key: "bitki_wolowe", name: "Bitki wolowe w sosie pieczeniowym" },
  { key: "schab_grzyby", name: "Schab nadziewany grzybami" },
  { key: "zurek", name: "Zurek na zakwasie z biala kielbasa" },
  { key: "kaszotto", name: "Grzybowe kaszotto z parmezanem", isVegetarian: true },
  { key: "gnocchi", name: "Ziemniaczane gnocchi z pesto pietruszkowym", isVegetarian: true },
  { key: "karkowka", name: "Duszona karkowka w sosie pieczeniowym" },
  { key: "filet_gorgonzola", name: "Filet z kurczaka z gnocchi w sosie serowym z gorgonzola" },

  { key: "barszcz_paluszek", name: "Barszcz z paluchem z ciasta francuskiego" },
  { key: "boeuf", name: "Boeuf Stroganow" },
  { key: "gulaszowa", name: "Wegierska zupa gulaszowa" },
  { key: "meksykanska", name: "Zupa meksykanska" },

  { key: "szarlotka", name: "Ciepla szarlotka z lodami waniliowymi" },
  { key: "brownie", name: "Brownie z musem malinowym" },
  { key: "ptys", name: "Ptys z kremem waniliowym" },
  { key: "pavlova", name: "Beza Pavlova z owocami" },
  { key: "panna_cotta", name: "Panna Cotta z sosem truskawkowym" },
  { key: "sernik", name: "Sernik czekoladowy" },

  { key: "zimny_1", name: "Deska wędlin regionalnych" },
  { key: "zimny_2", name: "Deska serow z dodatkami" },
  { key: "zimny_3", name: "Tymbaliki drobiowe" },
  { key: "zimny_4", name: "Roladki z szynki z chrzanem" },
  { key: "zimny_5", name: "Jajka faszerowane" },
  { key: "zimny_6", name: "Mini tarty warzywne", isVegetarian: true },
  { key: "zimny_7", name: "Sledz w oleju lnianym" },
  { key: "zimny_8", name: "Tatar wolowy" },
  { key: "zimny_9", name: "Tatar z lososia" },
  { key: "zimny_10", name: "Pasztet domowy z zurawina" },
  { key: "zimny_11", name: "Galantyna drobiowa" },
  { key: "zimny_12", name: "Pstrag wedzony" },
  { key: "zimny_13", name: "Mini kanapki koktajlowe" },
  { key: "zimny_14", name: "Tortille z kurczakiem" },
  { key: "zimny_15", name: "Tortille warzywne", isVegetarian: true },
  { key: "zimny_16", name: "Warzywa grillowane", isVegetarian: true, isVegan: true },
  { key: "zimny_17", name: "Hummus z warzywami", isVegetarian: true, isVegan: true },
  { key: "zimny_18", name: "Pasta jajeczna z pieczywem" },
  { key: "zimny_19", name: "Koreczki bankietowe" },
  { key: "zimny_20", name: "Mini burgery" },
  { key: "zimny_21", name: "Krewetki koktajlowe" },
  { key: "zimny_22", name: "Carpaccio wolowe" },

  { key: "salatka_1", name: "Sałatka Cezar z kurczakiem" },
  { key: "salatka_2", name: "Sałatka grecka", isVegetarian: true },
  { key: "salatka_3", name: "Sałatka z kaszą bulgur i warzywami", isVegetarian: true, isVegan: true },
  { key: "salatka_4", name: "Sałatka jarzynowa" },
  { key: "salatka_5", name: "Sałatka z gruszką i serem pleśniowym", isVegetarian: true },
  { key: "salatka_6", name: "Sałatka ziemniaczana" },
  { key: "salatka_7", name: "Sałatka z wędzonym kurczakiem" },
  { key: "salatka_8", name: "Sałatka makaronowa" },
  { key: "salatka_9", name: "Sałatka z burakiem i rukolą", isVegetarian: true },

  { key: "napoje_bez_limitu", name: "Kawa, herbata, soki owocowe, woda mineralna - bez limitu" },
];

const dishGroups = {
  soups: [
    "rosol_domowy",
    "rosol_krolewski",
    "krem_grzybowy",
    "krem_warzywny",
    "krem_ogorek",
    "krem_pomidorowy",
    "krem_brokulowy",
    "krem_paprykowy",
  ],
  mains: ["schab_nadziewany", "pieczen_wieprzowa", "pieczen_indyk", "udko_kaczka", "poledwiczka"],
  desserts: ["szarlotka", "brownie", "ptys", "pavlova", "panna_cotta", "sernik"],
  dinners: ["roladka_drobiowa", "bitki_wolowe", "schab_grzyby", "zurek", "kaszotto", "gnocchi", "karkowka"],
  lastDinner: ["barszcz_paluszek", "boeuf", "gulaszowa", "meksykanska"],
  cold: Array.from({ length: 22 }, (_, index) => `zimny_${index + 1}`),
  salads: Array.from({ length: 9 }, (_, index) => `salatka_${index + 1}`),
  drinks: ["napoje_bez_limitu"],
};

const courses = [
  { key: "chef_soup", packageKey: "chef", courseType: "obiad_zupa", title: "Obiad / zupa", selectionMode: "all_served", choiceLimit: null, sortOrder: 10 },
  { key: "chef_main", packageKey: "chef", courseType: "obiad_danie_glowne", title: "Obiad / danie główne", selectionMode: "all_served", choiceLimit: null, sortOrder: 20 },
  { key: "chef_dessert", packageKey: "chef", courseType: "obiad_deser", title: "Obiad / deser", selectionMode: "all_served", choiceLimit: null, sortOrder: 30 },
  { key: "chef_dinner_1", packageKey: "chef", courseType: "kolacja_ciepla", title: "Kolacja ciepła I", selectionMode: "all_served", choiceLimit: null, sortOrder: 40 },
  { key: "chef_dinner_2", packageKey: "chef", courseType: "kolacja_ciepla", title: "Kolacja ciepła II", selectionMode: "all_served", choiceLimit: null, sortOrder: 50 },
  { key: "chef_cold", packageKey: "chef", courseType: "bufet_zimny", title: "Bufet zimny", selectionMode: "couple_picks", choiceLimit: 8, sortOrder: 60 },
  { key: "chef_drinks", packageKey: "chef", courseType: "napoje", title: "Napoje", selectionMode: "all_served", choiceLimit: null, sortOrder: 70 },
  ...["silver", "gold", "diamond"].flatMap((packageKey) => {
    const dinnerCount = packageKey === "silver" ? 2 : packageKey === "gold" ? 3 : 4;
    const coldLimit = packageKey === "silver" ? 9 : packageKey === "gold" ? 10 : 11;
    const base = [
      { key: `${packageKey}_soup`, courseType: "obiad_zupa", title: "Obiad / zupa", selectionMode: "couple_picks", choiceLimit: 1, sortOrder: 10 },
      { key: `${packageKey}_main`, courseType: "obiad_danie_glowne", title: "Obiad / danie główne", selectionMode: "guest_picks", choiceLimit: 3, sortOrder: 20 },
      { key: `${packageKey}_dessert`, courseType: "obiad_deser", title: "Obiad / deser", selectionMode: "couple_picks", choiceLimit: 1, sortOrder: 30 },
      ...Array.from({ length: dinnerCount }, (_, index) => ({
        key: `${packageKey}_dinner_${index + 1}`,
        courseType: "kolacja_ciepla",
        title: `Kolacja ciepła ${index + 1}`,
        selectionMode: "couple_picks",
        choiceLimit: 1,
        sortOrder: 40 + index * 10,
      })),
      { key: `${packageKey}_cold`, courseType: "bufet_zimny", title: "Bufet zimny", selectionMode: "couple_picks", choiceLimit: coldLimit, sortOrder: 90 },
      { key: `${packageKey}_salads`, courseType: "bufet_salatkowy", title: "Bufet sałatkowy", selectionMode: "couple_picks", choiceLimit: 3, sortOrder: 100 },
      { key: `${packageKey}_drinks`, courseType: "napoje", title: "Napoje", selectionMode: "all_served", choiceLimit: null, sortOrder: 110 },
    ];
    return base.map((course) => ({ ...course, packageKey }));
  }),
];

function dishesForCourse(course) {
  if (course.key === "chef_soup") return ["rosol_domowy"];
  if (course.key === "chef_main") return ["poledwiczka"];
  if (course.key === "chef_dessert") return ["szarlotka"];
  if (course.key === "chef_dinner_1") return ["filet_gorgonzola"];
  if (course.key === "chef_dinner_2") return ["barszcz_paluszek"];
  if (course.courseType === "obiad_zupa") return dishGroups.soups;
  if (course.courseType === "obiad_danie_glowne") return dishGroups.mains;
  if (course.courseType === "obiad_deser") return dishGroups.desserts;
  if (course.courseType === "kolacja_ciepla") return course.key.endsWith("_4") ? dishGroups.lastDinner : dishGroups.dinners;
  if (course.courseType === "bufet_zimny") return dishGroups.cold;
  if (course.courseType === "bufet_salatkowy") return dishGroups.salads;
  if (course.courseType === "napoje") return dishGroups.drinks;
  return [];
}

const links = courses.flatMap((course) =>
  dishesForCourse(course).map((dishKey, index) => ({
    courseKey: course.key,
    dishKey,
    sortOrder: index + 1,
  })),
);

const addons = [
  { key: "covers", name: "Pokrowce na krzesla", price: 18, pricingUnit: "per_person", description: "Cena placeholder - Adjust after vendor confirmation.", sortOrder: 1 },
  { key: "corkage", name: "Korkowe", price: 25, pricingUnit: "per_bottle", description: "Cena placeholder - Adjust after vendor confirmation.", sortOrder: 2 },
  { key: "country_table", name: "Wiejski stół", price: 1500, pricingUnit: "per_event", description: "Cena placeholder - Adjust after vendor confirmation.", sortOrder: 3 },
  { key: "sweet_table", name: "Słodki stół + tort", price: 2500, pricingUnit: "per_event", description: "Cena placeholder - Adjust after vendor confirmation.", sortOrder: 4 },
  { key: "soda", name: "Napoje gazowane", price: 12, pricingUnit: "per_person", description: "Cena placeholder - Adjust after vendor confirmation.", sortOrder: 5 },
  { key: "starter", name: "Przystawka serwowana", price: 24, pricingUnit: "per_person", description: "Cena placeholder - Adjust after vendor confirmation.", sortOrder: 6 },
  { key: "cake_service", name: "Ciastkowe", price: 600, pricingUnit: "per_event", description: "Cena placeholder - Adjust after vendor confirmation.", sortOrder: 7 },
];

module.exports = {
  addons,
  courses,
  dishes,
  links,
  packages,
};
