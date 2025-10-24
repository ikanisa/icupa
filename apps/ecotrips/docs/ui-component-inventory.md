# UI Component Inventory

The shared `@ecotrips/ui` package now includes the following exported components:

- `Button`
- `IconButton`
- `CardGlass`
- `BottomNavDock`
- `Toast`
- `Stepper`
- `AdminActionForm`
- `AdminDataTable`
- `ExplainPrice`

`ExplainPrice` renders a stacked bar visualization with contextual badges and footnotes for travel pricing. It accepts a `PriceBreakdown` object from `@ecotrips/types`.

## Sample card payload

```json
{
  "option_id": "HBX-001",
  "breakdown": {
    "currency": "USD",
    "total_amount_cents": 248500,
    "collected_amount_cents": 50000,
    "updated_at": "2024-07-01T08:00:00.000Z",
    "segments": [
      { "id": "stay", "label": "Gorilla lodge stay", "amount_cents": 182000, "category": "base", "tone": "emerald" },
      { "id": "tax", "label": "Tourism levies", "amount_cents": 18500, "category": "tax", "tone": "sky" },
      { "id": "ops", "label": "Ops concierge", "amount_cents": 35000, "category": "fee", "tone": "amber" },
      { "id": "sustainability", "label": "Carbon offsets", "amount_cents": 4500, "category": "sustainability", "tone": "lime" },
      { "id": "insurance", "label": "Evac insurance", "amount_cents": 8700, "category": "insurance", "tone": "indigo" }
    ],
    "badges": [
      { "id": "carbon-neutral", "label": "Carbon neutral", "tone": "success" },
      { "id": "guide-verified", "label": "Guide verified", "tone": "info" }
    ],
    "notes": [
      "Deposit collected to confirm gorilla permits.",
      "Ops concierge covers airport transfers and daily briefings."
    ]
  }
}
```

Use this payload with the `helpers-price` edge function or inline fixtures to preview the stacked bar rendering.
