export type RegionCode = 'RW' | 'EU';

export interface MenuLocation {
  id: string;
  tenantId?: string;
  name: string;
  region: RegionCode;
  currency: 'RWF' | 'EUR';
  locale: string;
  timezone: string;
  taxRate: number;
}

export type AllergenCode =
  | 'gluten'
  | 'crustaceans'
  | 'eggs'
  | 'fish'
  | 'peanuts'
  | 'soybeans'
  | 'milk'
  | 'nuts'
  | 'celery'
  | 'mustard'
  | 'sesame'
  | 'sulphites'
  | 'lupin'
  | 'molluscs';

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
  dietaryTags: (
    | 'vegan'
    | 'vegetarian'
    | 'gluten-free'
    | 'dairy-free'
    | 'halal'
    | 'spicy'
    | 'contains-alcohol'
  )[];
  preparationMinutes: number;
  rating: number;
  isAvailable: boolean;
  spiceLevel?: 'none' | 'mild' | 'medium' | 'hot';
  containsAlcohol?: boolean;
  highlight?: string;
  heroImage?: string;
  recommendedPairings?: string[];
}

export interface MenuModifierGroup {
  id: string;
  name: string;
  min?: number;
  max?: number;
  modifiers: { id: string; name: string; priceCents: number }[];
}

export const allergenOptions: { code: AllergenCode; label: string }[] = [
  { code: 'gluten', label: 'Gluten' },
  { code: 'crustaceans', label: 'Crustaceans' },
  { code: 'eggs', label: 'Eggs' },
  { code: 'fish', label: 'Fish' },
  { code: 'peanuts', label: 'Peanuts' },
  { code: 'soybeans', label: 'Soy' },
  { code: 'milk', label: 'Dairy' },
  { code: 'nuts', label: 'Tree Nuts' },
  { code: 'celery', label: 'Celery' },
  { code: 'mustard', label: 'Mustard' },
  { code: 'sesame', label: 'Sesame' },
  { code: 'sulphites', label: 'Sulphites' },
  { code: 'lupin', label: 'Lupin' },
  { code: 'molluscs', label: 'Shellfish' },
];

export const dietaryTags = [
  'vegan',
  'vegetarian',
  'gluten-free',
  'dairy-free',
  'halal',
  'spicy',
  'contains-alcohol',
] as const;

export const menuLocations: MenuLocation[] = [
  {
    id: 'kigali-harvest',
    name: 'Kigali Harvest',
    region: 'RW',
    currency: 'RWF',
    locale: 'en-RW',
    timezone: 'Africa/Kigali',
    taxRate: 0.18,
  },
  {
    id: 'valletta-bistro',
    name: 'Valletta Bistro',
    region: 'EU',
    currency: 'EUR',
    locale: 'en-MT',
    timezone: 'Europe/Malta',
    taxRate: 0.07,
  },
];

export const menuCategories: MenuCategory[] = [
  {
    id: 'starters',
    name: 'Starters',
    description: 'Vibrant plates to open the meal',
    sortOrder: 1,
  },
  {
    id: 'mains',
    name: 'Mains',
    description: 'Signature dishes crafted for sharing',
    sortOrder: 2,
  },
  {
    id: 'drinks',
    name: 'Drinks',
    description: 'Cocktails, juices, and non-alcoholic pairings',
    sortOrder: 3,
  },
  {
    id: 'desserts',
    name: 'Desserts',
    description: 'Sweet endings with regional flair',
    sortOrder: 4,
  },
];

export const menuItems: MenuItem[] = [
  {
    id: 'amarula-cheesecake',
    name: 'Amarula Cheesecake',
    description:
      'Creamy cheesecake infused with Amarula, candied macadamia, and citrus gel',
    categoryId: 'desserts',
    priceCents: 7800,
    locationIds: ['kigali-harvest'],
    allergens: ['milk', 'nuts', 'gluten'],
    dietaryTags: ['contains-alcohol'],
    preparationMinutes: 12,
    rating: 4.8,
    isAvailable: true,
    containsAlcohol: true,
    highlight: 'Crowd favourite in Kigali',
    recommendedPairings: ['Single origin espresso', 'Rooibos chai'],
  },
  {
    id: 'akabenz-bao',
    name: 'Akabenz Bao',
    description:
      'Slow-braised pork belly glazed with urwagwa caramel, pickled chilli, and charred pineapple',
    categoryId: 'mains',
    priceCents: 12400,
    locationIds: ['kigali-harvest'],
    allergens: ['gluten', 'soybeans'],
    dietaryTags: ['spicy'],
    preparationMinutes: 18,
    rating: 4.7,
    isAvailable: true,
    spiceLevel: 'medium',
    highlight: 'Pairs with passion fruit spritz',
  },
  {
    id: 'imboga-garden',
    name: 'Imboga Garden',
    description:
      'Grilled seasonal vegetables, sorghum crunch, and hibiscus vinaigrette served warm',
    categoryId: 'mains',
    priceCents: 9800,
    locationIds: ['kigali-harvest', 'valletta-bistro'],
    allergens: ['nuts'],
    dietaryTags: ['vegan', 'gluten-free'],
    preparationMinutes: 14,
    rating: 4.6,
    isAvailable: true,
    highlight: 'Chef recommended',
  },
  {
    id: 'lake-kivu-tilapia',
    name: 'Lake Kivu Tilapia',
    description:
      'Pan-seared tilapia with urusenda butter, cassava gnocchi, and green papaya slaw',
    categoryId: 'mains',
    priceCents: 14300,
    locationIds: ['kigali-harvest'],
    allergens: ['fish', 'milk'],
    dietaryTags: ['gluten-free'],
    preparationMinutes: 16,
    rating: 4.9,
    isAvailable: true,
    highlight: 'Best seller',
  },
  {
    id: 'volcanic-samosa',
    name: 'Volcanic Lentil Samosa',
    description: 'Crisp samosa with lentils, smoked chilli oil, and pickled mango yogurt',
    categoryId: 'starters',
    priceCents: 6200,
    locationIds: ['kigali-harvest', 'valletta-bistro'],
    allergens: ['gluten', 'milk'],
    dietaryTags: ['vegetarian', 'spicy'],
    preparationMinutes: 10,
    rating: 4.5,
    isAvailable: true,
    spiceLevel: 'hot',
  },
  {
    id: 'ikivuguto-spritz',
    name: 'Ikivuguto Spritz',
    description:
      'Sparkling ikivuguto yogurt, maracuja shrub, tonic, and vanilla bean bitters',
    categoryId: 'drinks',
    priceCents: 5400,
    locationIds: ['kigali-harvest'],
    allergens: ['milk'],
    dietaryTags: ['contains-alcohol'],
    preparationMinutes: 4,
    rating: 4.4,
    isAvailable: true,
    containsAlcohol: true,
    highlight: 'Signature sundowner',
  },
  {
    id: 'bugesera-cold-brew',
    name: 'Bugesera Cold Brew',
    description:
      'Single origin cold brew steeped with orange peel and cardamom, served over block ice',
    categoryId: 'drinks',
    priceCents: 4800,
    locationIds: ['kigali-harvest', 'valletta-bistro'],
    allergens: [],
    dietaryTags: ['vegan', 'gluten-free'],
    preparationMinutes: 3,
    rating: 4.3,
    isAvailable: true,
  },
  {
    id: 'kinyovu-cocoa-tart',
    name: 'Kinyovu Cocoa Tart',
    description: '70% Rwandan cocoa, salted caramel, and cassava sable crust',
    categoryId: 'desserts',
    priceCents: 7200,
    locationIds: ['valletta-bistro'],
    allergens: ['gluten', 'milk'],
    dietaryTags: ['vegetarian'],
    preparationMinutes: 11,
    rating: 4.9,
    isAvailable: true,
  },
  {
    id: 'gozo-citrus-salad',
    name: 'Gozo Citrus Salad',
    description: 'Caramelised citrus, fennel pollen, pistachio praline, and ricotta salata',
    categoryId: 'starters',
    priceCents: 6900,
    locationIds: ['valletta-bistro'],
    allergens: ['milk', 'nuts'],
    dietaryTags: ['vegetarian'],
    preparationMinutes: 9,
    rating: 4.4,
    isAvailable: true,
  },
  {
    id: 'marsovin-sunset',
    name: 'Marsovin Sunset',
    description: 'Maltese rosé, prickly pear cordial, grapefruit bitters, and rose mist',
    categoryId: 'drinks',
    priceCents: 6800,
    locationIds: ['valletta-bistro'],
    allergens: [],
    dietaryTags: ['contains-alcohol'],
    preparationMinutes: 5,
    rating: 4.6,
    isAvailable: true,
    containsAlcohol: true,
  },
  {
    id: 'spiced-mandazi',
    name: 'Spiced Mandazi Basket',
    description:
      'Warm coconut mandazi tossed in palm sugar with pineapple compote and cardamom cream',
    categoryId: 'desserts',
    priceCents: 5600,
    locationIds: ['kigali-harvest'],
    allergens: ['gluten', 'milk'],
    dietaryTags: ['vegetarian'],
    preparationMinutes: 8,
    rating: 4.2,
    isAvailable: true,
  },
  {
    id: 'umucyo-tasting',
    name: 'Umucyo Tasting Flight',
    description:
      'Three pours of seasonal fruit kombuchas finished with house bitters',
    categoryId: 'drinks',
    priceCents: 6200,
    locationIds: ['kigali-harvest'],
    allergens: [],
    dietaryTags: ['vegan', 'gluten-free'],
    preparationMinutes: 6,
    rating: 4.1,
    isAvailable: true,
  },
];

export const menuModifierGroups: Record<string, MenuModifierGroup[]> = {
  'amarula-cheesecake': [
    {
      id: 'sauce',
      name: 'Sauce drizzle',
      min: 0,
      max: 1,
      modifiers: [
        { id: 'passion', name: 'Passion fruit caramel', priceCents: 600 },
        { id: 'espresso', name: 'Espresso anglaise', priceCents: 800 },
      ],
    },
  ],
  'akabenz-bao': [
    {
      id: 'heat',
      name: 'Chilli level',
      min: 1,
      max: 1,
      modifiers: [
        { id: 'mild', name: 'Mild', priceCents: 0 },
        { id: 'medium', name: 'Medium', priceCents: 0 },
        { id: 'hot', name: 'Hot', priceCents: 0 },
      ],
    },
    {
      id: 'extras',
      name: 'Add-ons',
      max: 2,
      modifiers: [
        { id: 'egg', name: "Soft egg", priceCents: 1200 },
        { id: 'greens', name: 'Crispy kale', priceCents: 900 },
      ],
    },
  ],
};

export const quickIntents = [
  'What pairs well with tilapia?',
  'Show vegan dishes under 10 minutes',
  'Recommend a dessert without nuts',
  'What is new on the menu?'
];
