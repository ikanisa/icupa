import { z } from 'zod';

export const appRoleSchema = z.enum(['client', 'vendor', 'admin'], {
  description: 'Primary personas targeted by the ICUPA multi-PWA rollout.'
});

export type AppRole = z.infer<typeof appRoleSchema>;

export const appFeatureSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export type AppFeature = z.infer<typeof appFeatureSchema>;

export const appDefinitionSchema = z.object({
  id: appRoleSchema,
  title: z.string(),
  tagline: z.string(),
  description: z.string(),
  features: z.array(appFeatureSchema),
  primaryCta: z.object({
    label: z.string(),
    href: z.string(),
  }),
});

export type AppDefinition = z.infer<typeof appDefinitionSchema>;

const clientDefinition: AppDefinition = appDefinitionSchema.parse({
  id: 'client',
  title: 'ICUPA Dine-In',
  tagline: 'Scan • Discover • Pay',
  description:
    'Discover curated menus, chat with the AI waiter, build a shared cart, and close out securely from your seat.',
  primaryCta: {
    label: 'Preview the diner journey',
    href: '/ai',
  },
  features: [
    {
      title: 'Menu intelligence',
      description: 'Search semantically, filter by allergens, and browse categories that adapt to diner preferences.',
    },
    {
      title: 'AI waiter',
      description: 'Ask follow-up questions, split checks, or get pairing recommendations with full allergen guardrails.',
    },
    {
      title: 'Seamless payments',
      description: 'Settle with mobile money or cards and grab your digital receipt with fiscal identifiers when required.',
    },
  ],
});

const vendorDefinition: AppDefinition = appDefinitionSchema.parse({
  id: 'vendor',
  title: 'ICUPA Vendor Console',
  tagline: 'Run service with live insights',
  description:
    'Authenticate via WhatsApp OTP, review OCR ingestions, manage the floor, and keep the kitchen flowing with live order states.',
  primaryCta: {
    label: 'Review onboarding checklist',
    href: '/settings',
  },
  features: [
    {
      title: 'Kitchen display lanes',
      description: 'Color-coded SLA monitors, bump/recall controls, and instant updates across stations.',
    },
    {
      title: 'Menu ingestion HITL',
      description: 'Upload PDFs, approve structured drafts, and publish to diners with embeddings refreshed automatically.',
    },
    {
      title: 'Operational alerts',
      description: 'Inventory 86s, promo pacing, and SLA exceptions surface in one dashboard for staff triage.',
    },
  ],
});

const adminDefinition: AppDefinition = appDefinitionSchema.parse({
  id: 'admin',
  title: 'ICUPA Admin Panel',
  tagline: 'Governance & safety at scale',
  description:
    'Manage tenants, fine-tune AI autonomy, audit compliance, and drive canary rollouts across every deployment.',
  primaryCta: {
    label: 'Launch admin controls',
    href: '/flags',
  },
  features: [
    {
      title: 'Tenant lifecycle',
      description: 'Track onboarding progress, assign locations, and capture KYB documentation with audit notes.',
    },
    {
      title: 'AI guardrails',
      description: 'Configure instructions, tool allow-lists, and budget tiers with structured outputs for every agent.',
    },
    {
      title: 'Compliance insights',
      description: 'Monitor fiscal coverage, allergen incidents, and privacy requests with export tooling.',
    },
  ],
});

export const APP_DEFINITIONS: Record<AppRole, AppDefinition> = {
  client: clientDefinition,
  vendor: vendorDefinition,
  admin: adminDefinition,
};

export type AppDictionary = typeof APP_DEFINITIONS;
