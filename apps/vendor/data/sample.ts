export const kpiMetrics = [
  {
    id: 'gmv',
    label: 'GMV Today',
    value: '$4,820',
    delta: '+18% vs yesterday',
  },
  {
    id: 'aov',
    label: 'Average Order Value',
    value: '$18.60',
    delta: '+6% rolling 7d',
  },
  {
    id: 'attach',
    label: 'Attach Rate',
    value: '2.8 items',
    delta: 'Goal 3.2',
  },
  {
    id: 'ai_accept',
    label: 'AI Upsell Acceptance',
    value: '64%',
    delta: '+9 pts this week',
  },
];

export const slaSignals = [
  {
    id: 'prep_sla',
    title: 'Prep SLA',
    description: '92% of orders prepped under 8 minutes',
    status: 'healthy' as const,
  },
  {
    id: 'handoff',
    title: 'Handoff',
    description: '1 order awaiting runner for > 3 minutes',
    status: 'warning' as const,
  },
  {
    id: 'runner',
    title: 'Runner Coverage',
    description: 'Coverage at 2/3 lanes, assign one more staff member',
    status: 'critical' as const,
  },
];

export const liveAlerts = [
  {
    id: 'inventory',
    title: 'Inventory Low',
    body: 'Mango puree down to 8 portions. Toggle auto-86 or replenish.',
    severity: 'critical' as const,
  },
  {
    id: 'rating',
    title: 'Guest Feedback',
    body: 'Table 14 left 5⭐ feedback mentioning excellent allergen guidance.',
    severity: 'positive' as const,
  },
];

export const kdsLanes = [
  {
    id: 'hot',
    label: 'Hot Kitchen',
    sla: '8:00',
    tickets: [
      {
        id: 'TK-4821',
        table: '12',
        items: ['2× Braised Short Rib', '1× Roasted Plantain'],
        elapsed: '04:21',
        status: 'firing' as const,
      },
      {
        id: 'TK-4822',
        table: '4',
        items: ['1× Harissa Chicken', '1× Cassava Fries'],
        elapsed: '02:08',
        status: 'plating' as const,
      },
    ],
  },
  {
    id: 'cold',
    label: 'Cold & Pastry',
    sla: '6:00',
    tickets: [
      {
        id: 'TK-4819',
        table: '6',
        items: ['1× Kale Citrus Salad', '1× Mango Sorbet'],
        elapsed: '05:42',
        status: 'firing' as const,
      },
      {
        id: 'TK-4814',
        table: '18',
        items: ['1× Poached Pear'],
        elapsed: '01:36',
        status: 'ready' as const,
      },
    ],
  },
  {
    id: 'bar',
    label: 'Bar',
    sla: '3:00',
    tickets: [
      {
        id: 'TK-4823',
        table: 'Bar Seat 4',
        items: ['1× Hibiscus Spritz', '1× Espresso Martini'],
        elapsed: '02:51',
        status: 'firing' as const,
      },
      {
        id: 'TK-4825',
        table: '7',
        items: ['2× Tamarind Cooler'],
        elapsed: '01:12',
        status: 'queued' as const,
      },
    ],
  },
];

export const floorTables = [
  { id: 'T1', label: 'Table 1', guests: 2, status: 'seated' as const, server: 'Leah', sla: '00:12' },
  { id: 'T2', label: 'Table 2', guests: 4, status: 'awaiting-runner' as const, server: 'Mo', sla: '00:04' },
  { id: 'T3', label: 'Table 3', guests: 6, status: 'ordering' as const, server: 'Priya', sla: '—' },
  { id: 'T4', label: 'Table 4', guests: 2, status: 'dining' as const, server: 'Leah', sla: '00:28' },
  { id: 'PATIO1', label: 'Patio 1', guests: 3, status: 'needs-bus' as const, server: 'Marco', sla: '00:07' },
  { id: 'PATIO2', label: 'Patio 2', guests: 0, status: 'open' as const, server: null, sla: '—' },
];

export const liveOrders = [
  {
    id: 'ORD-2481',
    table: '12',
    state: 'prepping' as const,
    guestName: 'Table Session 12A',
    total: 78.5,
    placedAt: '2024-04-22T17:21:00Z',
    items: [
      { name: 'Braised Short Rib', quantity: 2, modifiers: ['Extra jus'] },
      { name: 'Roasted Plantain', quantity: 1, modifiers: ['Chili glaze'] },
    ],
  },
  {
    id: 'ORD-2482',
    table: 'Bar 4',
    state: 'ready' as const,
    guestName: 'Bar Guest 4',
    total: 26.0,
    placedAt: '2024-04-22T17:24:00Z',
    items: [
      { name: 'Hibiscus Spritz', quantity: 1, modifiers: [] },
      { name: 'Espresso Martini', quantity: 1, modifiers: ['Decaf'] },
    ],
  },
  {
    id: 'ORD-2474',
    table: '7',
    state: 'awaiting-payment' as const,
    guestName: 'Table Session 7C',
    total: 142.2,
    placedAt: '2024-04-22T16:58:00Z',
    items: [
      { name: 'Chef Tasting', quantity: 2, modifiers: ['Wine pairing'] },
    ],
  },
];

export const menuIngestions = [
  {
    id: 'ing-482',
    startedAt: '2024-04-21T09:12:00Z',
    fileName: 'Seasonal-menu-April.pdf',
    status: 'processing' as const,
    completion: 68,
  },
  {
    id: 'ing-481',
    startedAt: '2024-04-15T10:02:00Z',
    fileName: 'Cocktail-list-v3.jpg',
    status: 'ready' as const,
    completion: 100,
  },
];

export const ingestionDraft = {
  id: 'ing-481',
  summary: {
    confidence: 0.92,
    totalItems: 24,
    highRiskItems: 2,
  },
  categories: [
    {
      id: 'cat-1',
      name: 'Starters',
      items: [
        {
          id: 'item-1',
          name: 'Kigali Market Salad',
          price: 9,
          confidence: 0.88,
          description: 'Mixed greens, passionfruit vinaigrette, roasted peanuts',
          allergens: ['Peanut'],
          modifiers: ['Add avocado', 'Remove peanuts'],
        },
        {
          id: 'item-2',
          name: 'Plantain Chips',
          price: 6,
          confidence: 0.73,
          description: 'Crispy plantains with pili-pili aioli',
          allergens: ['Egg'],
          modifiers: ['Extra sauce'],
        },
      ],
    },
    {
      id: 'cat-2',
      name: 'Mains',
      items: [
        {
          id: 'item-3',
          name: 'Braised Short Rib',
          price: 24,
          confidence: 0.96,
          description: 'Sorghum glaze, cassava puree, charred greens',
          allergens: ['Soy'],
          modifiers: ['Add extra glaze', 'Side of greens'],
        },
      ],
    },
  ],
};

export const inventoryLevels = [
  { id: 'inv-1', item: 'Mango Puree', onHand: 8, unit: 'portions', auto86: true, restockEtaMinutes: 45 },
  { id: 'inv-2', item: 'Cassava Fries', onHand: 28, unit: 'orders', auto86: false, restockEtaMinutes: 0 },
  { id: 'inv-3', item: 'Hibiscus Syrup', onHand: 5, unit: 'liters', auto86: true, restockEtaMinutes: 120 },
  { id: 'inv-4', item: 'Local Tilapia', onHand: 14, unit: 'fillets', auto86: false, restockEtaMinutes: 0 },
];

export const promoCampaigns = [
  {
    id: 'promo-1',
    name: 'Midweek Tasting Flight',
    budgetRemaining: 180,
    status: 'active' as const,
    acceptanceRate: 0.42,
    startedAt: '2024-04-01T00:00:00Z',
  },
  {
    id: 'promo-2',
    name: 'Allergen-Friendly Spotlight',
    budgetRemaining: 320,
    status: 'paused' as const,
    acceptanceRate: 0.35,
    startedAt: '2024-03-18T00:00:00Z',
  },
];

export const onboardingChecklist = [
  {
    id: 'verify',
    name: 'Verify WhatsApp number',
    description: 'Send OTP to confirm business owner phone number.',
    status: 'complete' as const,
  },
  {
    id: 'business',
    name: 'Business profile',
    description: 'Legal name, address, contact email, and banking details.',
    status: 'in-progress' as const,
  },
  {
    id: 'menu',
    name: 'Menu ingestion',
    description: 'Upload current menu to kick off OCR and AI training.',
    status: 'pending' as const,
  },
  {
    id: 'gps',
    name: 'Location GPS capture',
    description: 'Confirm pinned coordinates used for courier routing.',
    status: 'pending' as const,
  },
];

export const quickIntents = [
  'Request runner to Patio 1',
  'Prep allergy-friendly dessert',
  'Pause upsell on Table 7',
];
