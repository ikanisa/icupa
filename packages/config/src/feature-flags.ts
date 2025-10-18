import { z } from 'zod';
import { appRoleSchema } from '@icupa/types/apps';

export const featureFlagSchema = z.object({
  key: z.string().min(1),
  description: z.string(),
  enabledByDefault: z.boolean().default(false),
  audience: z.array(appRoleSchema).default([]),
});

export type FeatureFlag = z.infer<typeof featureFlagSchema>;

export const createFeatureFlag = (flag: FeatureFlag): FeatureFlag => featureFlagSchema.parse(flag);

export const coreFeatureFlags = {
  multiPwaBanner: createFeatureFlag({
    key: 'multi-pwa-banner',
    description: 'Toggle the banner in the legacy app that links to the new Client, Vendor, and Admin PWAs.',
    enabledByDefault: false,
    audience: [...appRoleSchema.options],
  }),
  aiWaiterBeta: createFeatureFlag({
    key: 'ai-waiter-beta',
    description: 'Allow diners to opt into the AI waiter experience when the new client PWA is enabled.',
    enabledByDefault: false,
    audience: ['client'],
  }),
};

export type FeatureFlagDictionary = typeof coreFeatureFlags;
