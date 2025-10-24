import { addDays, formatISO } from 'date-fns';

export type TenantStatus = 'onboarding' | 'active' | 'blocked' | 'pilot';

export type TenantRecord = {
  id: string;
  name: string;
  region: string;
  locations: number;
  status: TenantStatus;
  onboardingStep: string;
  goLiveTarget: string;
  accountManager: string;
  aiAutonomy: number;
  notes: string;
};

export const tenants: TenantRecord[] = [
  {
    id: 'tn_aurora',
    name: 'Aurora Collective',
    region: 'Rwanda',
    locations: 3,
    status: 'active',
    onboardingStep: 'Menu embeddings refreshed',
    goLiveTarget: formatISO(addDays(new Date(), -45), { representation: 'date' }),
    accountManager: 'V. Mukamana',
    aiAutonomy: 2,
    notes: 'AI waiter in production. Monitoring upsell conversions during dinner rush.',
  },
  {
    id: 'tn_maltese',
    name: 'Maltese Bistro Group',
    region: 'Malta',
    locations: 5,
    status: 'pilot',
    onboardingStep: 'Fiscal integration QA',
    goLiveTarget: formatISO(addDays(new Date(), 12), { representation: 'date' }),
    accountManager: 'S. Azzopardi',
    aiAutonomy: 1,
    notes: 'Awaiting compliance clearance for fiscal receipts. Vendor console rolled to 50% of tables.',
  },
  {
    id: 'tn_jambo',
    name: 'Jambo Hospitality',
    region: 'Kenya',
    locations: 2,
    status: 'onboarding',
    onboardingStep: 'Menu OCR review',
    goLiveTarget: formatISO(addDays(new Date(), 28), { representation: 'date' }),
    accountManager: 'E. Kamau',
    aiAutonomy: 0,
    notes: 'Need to ingest Swahili menu variants and capture GPS for mobile money compliance.',
  },
  {
    id: 'tn_river',
    name: 'River & Oak',
    region: 'France',
    locations: 1,
    status: 'blocked',
    onboardingStep: 'Pending KYB documents',
    goLiveTarget: formatISO(addDays(new Date(), 60), { representation: 'date' }),
    accountManager: 'C. Dubois',
    aiAutonomy: 0,
    notes: 'Escalated to compliance for data residency clarifications.',
  },
];

export type AgentAutonomyLevel = 0 | 1 | 2 | 3;

export type AgentSetting = {
  id: string;
  title: string;
  description: string;
  autonomy: AgentAutonomyLevel;
  budgetUsd: number;
  instructions: string;
  tools: { name: string; enabled: boolean; description: string }[];
  lastUpdated: string;
};

export const agentSettings: AgentSetting[] = [
  {
    id: 'waiter',
    title: 'AI Waiter',
    description: 'Conversational ordering with allergen guardrails and upsell intent.',
    autonomy: 2,
    budgetUsd: 35,
    instructions:
      'Greet diners, learn their preferences, and only recommend items tagged as in-stock. Escalate to a human if allergen certainty falls below 90%.',
    tools: [
      { name: 'menu.search', enabled: true, description: 'Semantic and filterable menu retrieval.' },
      { name: 'orders.create', enabled: true, description: 'Create and update table orders.' },
      { name: 'payments.link', enabled: false, description: 'Issue payment links without staff approval.' },
    ],
    lastUpdated: formatISO(addDays(new Date(), -2)),
  },
  {
    id: 'compliance_watcher',
    title: 'Compliance Watcher',
    description: 'Observes fiscal SLAs and privacy requests, escalating anomalies.',
    autonomy: 1,
    budgetUsd: 18,
    instructions:
      'Run hourly audits. Auto-issue fiscal reminders if SLA falls below 92%. Escalate privacy deletions immediately.',
    tools: [
      { name: 'reports.generate', enabled: true, description: 'Compile fiscal and privacy audit reports.' },
      { name: 'alerts.dispatch', enabled: true, description: 'Notify tenant contacts via WhatsApp or email.' },
      { name: 'agents.override', enabled: false, description: 'Force-disable other agents during incidents.' },
    ],
    lastUpdated: formatISO(addDays(new Date(), -5)),
  },
  {
    id: 'promo_event',
    title: 'Promo Orchestrator',
    description: 'Tunes epsilon-bandit promos with guardrailed budgets per tenant.',
    autonomy: 3,
    budgetUsd: 50,
    instructions:
      'Experiment within allocated budget, throttle spend if burn rate exceeds 20% per hour. Sync with vendor console alerts.',
    tools: [
      { name: 'promos.create', enabled: true, description: 'Launch promo experiments with guardrails.' },
      { name: 'inventory.read', enabled: true, description: 'Check stock levels before pushing promos.' },
      { name: 'payments.adjust', enabled: false, description: 'Issue goodwill credits beyond policy.' },
    ],
    lastUpdated: formatISO(addDays(new Date(), -1)),
  },
];

export type AnalyticsSnapshot = {
  windowLabel: string;
  gmv: number;
  aov: number;
  attachRate: number;
  aiAcceptance: number;
  hallucinationRate: number;
  prepSla: number;
};

export const analyticsTimeseries: AnalyticsSnapshot[] = [
  {
    windowLabel: 'Week -5',
    gmv: 28500,
    aov: 18.5,
    attachRate: 0.36,
    aiAcceptance: 0.68,
    hallucinationRate: 0.02,
    prepSla: 0.91,
  },
  {
    windowLabel: 'Week -4',
    gmv: 30220,
    aov: 19.1,
    attachRate: 0.37,
    aiAcceptance: 0.7,
    hallucinationRate: 0.019,
    prepSla: 0.92,
  },
  {
    windowLabel: 'Week -3',
    gmv: 31540,
    aov: 19.6,
    attachRate: 0.39,
    aiAcceptance: 0.72,
    hallucinationRate: 0.017,
    prepSla: 0.925,
  },
  {
    windowLabel: 'Week -2',
    gmv: 33410,
    aov: 20.3,
    attachRate: 0.41,
    aiAcceptance: 0.75,
    hallucinationRate: 0.016,
    prepSla: 0.93,
  },
  {
    windowLabel: 'Week -1',
    gmv: 34880,
    aov: 21.2,
    attachRate: 0.42,
    aiAcceptance: 0.77,
    hallucinationRate: 0.014,
    prepSla: 0.935,
  },
];

export type ComplianceMetric = {
  id: string;
  title: string;
  value: string;
  delta: string;
  trend: 'up' | 'down' | 'stable';
  detail: string;
};

export const complianceMetrics: ComplianceMetric[] = [
  {
    id: 'fiscal_coverage',
    title: 'Fiscal coverage',
    value: '94%',
    delta: '+2% WoW',
    trend: 'up',
    detail: 'Rwanda and Malta at 100%. Kenya pilot pending integration.',
  },
  {
    id: 'allergen_incidents',
    title: 'Allergen incidents',
    value: '0',
    delta: 'unchanged',
    trend: 'stable',
    detail: 'AI waiter deflected 14 potential allergen conflicts this week.',
  },
  {
    id: 'privacy_requests',
    title: 'Privacy requests',
    value: '3 open',
    delta: '-1 WoW',
    trend: 'down',
    detail: 'All requests within SLA. Awaiting vendor confirmation on deletion receipts.',
  },
];

export type ComplianceIncident = {
  id: string;
  tenant: string;
  type: string;
  openedAt: string;
  owner: string;
  status: 'investigating' | 'mitigated' | 'pending_vendor';
  summary: string;
};

export const complianceIncidents: ComplianceIncident[] = [
  {
    id: 'inc_4821',
    tenant: 'Maltese Bistro Group',
    type: 'Fiscal SLA',
    openedAt: formatISO(addDays(new Date(), -3)),
    owner: 'C. Rivera',
    status: 'mitigated',
    summary: 'Adyen webhook delay triggered fallback receipts. Monitoring until next reconciliation.',
  },
  {
    id: 'inc_4830',
    tenant: 'Jambo Hospitality',
    type: 'Allergen advisory',
    openedAt: formatISO(addDays(new Date(), -1)),
    owner: 'E. Kamau',
    status: 'investigating',
    summary: 'Menu ingestion missing sesame tagging for new dish variant. OCR team updating taxonomy.',
  },
  {
    id: 'inc_4834',
    tenant: 'River & Oak',
    type: 'Data subject request',
    openedAt: formatISO(addDays(new Date(), -7)),
    owner: 'L. Chen',
    status: 'pending_vendor',
    summary: 'Awaiting vendor deletion confirmation before closing the request.',
  },
];

export type FeatureFlagState = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  audience: string[];
};

export const rolloutFlags: FeatureFlagState[] = [
  {
    key: 'multi-pwa-banner',
    label: 'Legacy banner',
    description: 'Expose the multi-PWA migration banner in the legacy unified app.',
    enabled: false,
    audience: ['client', 'vendor'],
  },
  {
    key: 'ai-waiter-beta',
    label: 'AI Waiter beta',
    description: 'Allow diners to opt into the AI waiter flow once table session is established.',
    enabled: true,
    audience: ['client'],
  },
  {
    key: 'vendor-menu-ocr',
    label: 'Vendor OCR v2',
    description: 'Enable the new OCR reconciliation experience with quick thumbs triage.',
    enabled: true,
    audience: ['vendor'],
  },
  {
    key: 'admin-ai-audit',
    label: 'Admin AI audit view',
    description: 'Expose structured agent traces and summaries to admin reviewers.',
    enabled: false,
    audience: ['admin'],
  },
];
