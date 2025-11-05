import type { MessagingProvider } from './types.js';
import { env } from '../../config/env.js';

class MockMessagingProvider implements MessagingProvider {
  readonly name = 'mock';
  async sendMessage(destination: string, body: string) {
    if (!destination || !body) {
      throw new Error('Destination and body required');
    }
  }
}

class TwilioMessagingProvider implements MessagingProvider {
  readonly name = 'twilio';
  async sendMessage() {
    throw new Error('Twilio provider not configured');
  }
}

const providers: Record<string, MessagingProvider> = {
  mock: new MockMessagingProvider(),
  twilio: new TwilioMessagingProvider()
};

export const messagingProvider = providers[env.MESSAGING_PROVIDER] ?? providers.mock;
