/**
 * Feature flags configuration
 * Allows gradual rollout of AI agent features
 */

export interface FeatureFlags {
  // AI agent features
  aiRealtimeEnabled: boolean;
  aiResponsesEnabled: boolean;
  whatsappIntegrationEnabled: boolean;

  // Tool features
  voucherCreationEnabled: boolean;
  voucherRedemptionEnabled: boolean;

  // Observability
  telemetryEnabled: boolean;
  debugLoggingEnabled: boolean;
}

/**
 * Load feature flags from environment variables
 */
export function loadFeatureFlags(): FeatureFlags {
  return {
    aiRealtimeEnabled: getEnvBool("AI_REALTIME_ENABLED", true),
    aiResponsesEnabled: getEnvBool("AI_RESPONSES_ENABLED", true),
    whatsappIntegrationEnabled: getEnvBool("WHATSAPP_INTEGRATION_ENABLED", true),

    voucherCreationEnabled: getEnvBool("VOUCHER_CREATION_ENABLED", true),
    voucherRedemptionEnabled: getEnvBool("VOUCHER_REDEMPTION_ENABLED", true),

    telemetryEnabled: getEnvBool("TELEMETRY_ENABLED", false),
    debugLoggingEnabled: getEnvBool("DEBUG_LOGGING_ENABLED", false),
  };
}

/**
 * Get boolean from environment variable
 */
function getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

/**
 * Check if a feature is enabled
 */
export class FeatureFlagService {
  private flags: FeatureFlags;

  constructor() {
    this.flags = loadFeatureFlags();
  }

  isEnabled(feature: keyof FeatureFlags): boolean {
    return this.flags[feature];
  }

  getAll(): FeatureFlags {
    return { ...this.flags };
  }
}

// Export singleton instance
export const featureFlags = new FeatureFlagService();
