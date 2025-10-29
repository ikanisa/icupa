import { log, logError } from './utils.js';

interface OutboundCallOptions {
  to: string;
  from?: string;
  url?: string;
  statusCallback?: string;
}

/**
 * Helper to initiate outbound calls via Twilio API
 * 
 * NOTE: This is a basic implementation for reference.
 * Production usage should include:
 * - Error handling and retries
 * - Rate limiting
 * - Call queue management
 * - Status tracking
 */
export async function makeOutboundCall(options: OutboundCallOptions): Promise<string> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = options.from || process.env.TWILIO_FROM_NUMBER;
  const publicUrl = process.env.PUBLIC_HTTP_URL;

  if (!accountSid || !authToken) {
    throw new Error('Missing Twilio credentials');
  }

  if (!fromNumber) {
    throw new Error('Missing from number');
  }

  if (!publicUrl) {
    throw new Error('Missing PUBLIC_HTTP_URL');
  }

  const url = options.url || `${publicUrl}/twilio/answer`;

  log('Initiating outbound call', {
    to: options.to,
    from: fromNumber,
    url,
  });

  try {
    // Create basic auth header
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    // Make request to Twilio API
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: options.to,
          From: fromNumber,
          Url: url,
          ...(options.statusCallback && { StatusCallback: options.statusCallback }),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as any;
    const callSid = data.sid;

    log('Outbound call initiated', {
      callSid,
      to: options.to,
      status: data.status,
    });

    return callSid;

  } catch (error) {
    logError('Failed to initiate outbound call', error, {
      to: options.to,
      from: fromNumber,
    });
    throw error;
  }
}

/**
 * Get status of an outbound call
 */
export async function getCallStatus(callSid: string): Promise<any> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Missing Twilio credentials');
  }

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio API error: ${response.status} ${errorText}`);
    }

    return await response.json();

  } catch (error) {
    logError('Failed to get call status', error, { callSid });
    throw error;
  }
}
