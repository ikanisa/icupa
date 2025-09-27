export type RegionCode = "RW" | "EU";

export interface MenuLocation {
  id: string;
  name: string;
  region: RegionCode;
  currency: "RWF" | "EUR";
  locale: string;
  timezone: string;
  tenantId?: string;
}

export type AllergenCode =
  | "gluten"
  | "crustaceans"
  | "eggs"
  | "fish"
  | "peanuts"
  | "soybeans"
  | "milk"
  | "nuts"
  | "celery"
  | "mustard"
  | "sesame"
  | "sulphites"
  | "lupin"
  | "molluscs";

export interface MenuCategory {
  id: string;
  name: string;
  description: string;
  sortOrder?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  priceCents: number;
  locationIds: string[];
  allergens: AllergenCode[];
  dietaryTags: ("vegan" | "vegetarian" | "gluten-free" | "dairy-free" | "halal" | "spicy" | "contains-alcohol")[];
  preparationMinutes: number;
  rating: number;
  isAvailable: boolean;
  spiceLevel?: "none" | "mild" | "medium" | "hot";
  containsAlcohol?: boolean;
  highlight?: string;
  heroImage?: string;
  recommendedPairings?: string[];
}

export const menuLocations: MenuLocation[] = [
  {
    id: "kigali-harvest",
    name: "Kigali Harvest",
    region: "RW",
    currency: "RWF",
    locale: "en-RW",
    timezone: "Africa/Kigali",
    tenantId: "00000000-0000-4000-8000-demo-rw",
  },
  {
    id: "valletta-bistro",
    name: "Valletta Bistro",
    region: "EU",
    currency: "EUR",
    locale: "en-MT",
    timezone: "Europe/Malta",
    tenantId: "00000000-0000-4000-8000-demo-eu",
  },
];

export const menuCategories: MenuCategory[] = [
  {
    id: "starters",
    name: "Starters",
    description: "Vibrant plates to open the meal",
    sortOrder: 1,
  },
  {
    id: "mains",
    name: "Mains",
    description: "Signature dishes crafted for sharing",
    sortOrder: 2,
  },
  {
    id: "drinks",
    name: "Drinks",
    description: "Cocktails, juices, and non-alcoholic pairings",
    sortOrder: 3,
  },
  {
    id: "desserts",
    name: "Desserts",
    description: "Sweet endings with regional flair",
    sortOrder: 4,
  },
];

export const menuItems: MenuItem[] = [
  {
    id: "amarula-cheesecake",
    name: "Amarula Cheesecake",
    description: "Creamy cheesecake infused with Amarula, candied macadamia, and citrus gel",
    categoryId: "desserts",
    priceCents: 7800,
    locationIds: ["kigali-harvest"],
    allergens: ["milk", "nuts", "gluten"],
    dietaryTags: ["contains-alcohol"],
    preparationMinutes: 12,
    rating: 4.8,
    isAvailable: true,
    containsAlcohol: true,
    highlight: "Crowd favourite in Kigali",
    recommendedPairings: ["Single origin espresso", "Rooibos chai"],
  },
  {
    id: "isombe-croquettes",
    name: "Isombe Croquettes",
    description: "Cassava leaves, peanut sauce, and plantain crumb served with passion fruit dip",
    categoryId: "starters",
    priceCents: 5200,
    locationIds: ["kigali-harvest"],
    allergens: ["peanuts"],
    dietaryTags: ["vegetarian", "gluten-free"],
    preparationMinutes: 14,
    rating: 4.6,
    isAvailable: true,
    spiceLevel: "mild",
    recommendedPairings: ["Tamarind spritz"],
  },
  {
    id: "akabenz-sliders",
    name: "Akabenz Sliders",
    description: "Slow-cooked pork bites, agashya glaze, pickled cabbage, and chilli aioli",
    categoryId: "mains",
    priceCents: 11500,
    locationIds: ["kigali-harvest"],
    allergens: ["gluten", "eggs"],
    dietaryTags: ["spicy"],
    preparationMinutes: 18,
    rating: 4.7,
    isAvailable: true,
    spiceLevel: "medium",
    recommendedPairings: ["Skol Lager", "Sorghum sour"],
  },
  {
    id: "lake-victoria-tilapia",
    name: "Lake Victoria Tilapia",
    description: "Grilled tilapia with urwaru beurre blanc, charred leek, and cassava crisps",
    categoryId: "mains",
    priceCents: 13200,
    locationIds: ["kigali-harvest"],
    allergens: ["fish", "milk"],
    dietaryTags: ["halal"],
    preparationMinutes: 22,
    rating: 4.5,
    isAvailable: false,
    highlight: "Currently at low catch—returns on Friday",
    recommendedPairings: ["Passion fruit mojito"],
  },
  {
    id: "kinyarwanda-cold-brew",
    name: "Kinyarwanda Cold Brew",
    description: "Single estate Arabica, hibiscus syrup, citrus mist",
    categoryId: "drinks",
    priceCents: 3200,
    locationIds: ["kigali-harvest"],
    allergens: [],
    dietaryTags: ["vegan", "gluten-free", "dairy-free"],
    preparationMinutes: 5,
    rating: 4.9,
    isAvailable: true,
    recommendedPairings: ["Isombe Croquettes"],
  },
  {
    id: "pastizzi-trio",
    name: "Pastizzi Trio",
    description: "Ricotta, mushy pea, and pulled rabbit pastizzi with herb oil",
    categoryId: "starters",
    priceCents: 850,
    locationIds: ["valletta-bistro"],
    allergens: ["gluten", "milk"],
    dietaryTags: [],
    preparationMinutes: 10,
    rating: 4.4,
    isAvailable: true,
    recommendedPairings: ["Negroni sbagliato"],
  },
  {
    id: "fenek-stew",
    name: "Maltese Fenek Stew",
    description: "Slow-braised rabbit with tomatoes, olives, marjoram, and white wine",
    categoryId: "mains",
    priceCents: 1950,
    locationIds: ["valletta-bistro"],
    allergens: ["sulphites"],
    dietaryTags: [],
    preparationMinutes: 26,
    rating: 4.7,
    isAvailable: true,
    containsAlcohol: true,
    recommendedPairings: ["Gran Malizia red"],
  },
  {
    id: "bigilla-toast",
    name: "Bigilla Toast",
    description: "Fava bean puree, sun-dried tomato, and grilled sourdough",
    categoryId: "mains",
    priceCents: 1150,
    locationIds: ["valletta-bistro"],
    allergens: ["gluten", "sesame"],
    dietaryTags: ["vegan"],
    preparationMinutes: 12,
    rating: 4.3,
    isAvailable: true,
    recommendedPairings: ["Craft lager", "Sparkling water"],
  },
  {
    id: "kunserva-tart",
    name: "Kunserva Tart",
    description: "Caramelised tomato jam, lemon mascarpone, and almond sable",
    categoryId: "desserts",
    priceCents: 980,
    locationIds: ["valletta-bistro"],
    allergens: ["gluten", "milk", "nuts"],
    dietaryTags: [],
    preparationMinutes: 11,
    rating: 4.6,
    isAvailable: true,
    recommendedPairings: ["Maltese dessert wine"],
  },
  {
    id: "citrus-spritz",
    name: "Citrus Spritz",
    description: "Maltese citrus, aperitivo bitters, chamomile tonic",
    categoryId: "drinks",
    priceCents: 750,
    locationIds: ["valletta-bistro"],
    allergens: [],
    dietaryTags: ["vegan", "gluten-free", "dairy-free"],
    preparationMinutes: 4,
    rating: 4.8,
    isAvailable: true,
    containsAlcohol: true,
    recommendedPairings: ["Pastizzi Trio"],
  },
];

export const allergenOptions: { code: AllergenCode; label: string }[] = [
  { code: "gluten", label: "Gluten" },
  { code: "crustaceans", label: "Crustaceans" },
  { code: "eggs", label: "Eggs" },
  { code: "fish", label: "Fish" },
  { code: "peanuts", label: "Peanuts" },
  { code: "soybeans", label: "Soy" },
  { code: "milk", label: "Milk" },
  { code: "nuts", label: "Tree Nuts" },
  { code: "celery", label: "Celery" },
  { code: "mustard", label: "Mustard" },
  { code: "sesame", label: "Sesame" },
  { code: "sulphites", label: "Sulphites" },
  { code: "lupin", label: "Lupin" },
  { code: "molluscs", label: "Molluscs" },
];

export const dietaryTags = [
  "vegan",
  "vegetarian",
  "gluten-free",
  "dairy-free",
  "halal",
  "spicy",
  "contains-alcohol",
] as const;
