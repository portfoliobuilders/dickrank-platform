import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import { describe, it } from 'vitest';
import { clientSecretFromSubscription } from '@/lib/stripe';

describe('clientSecretFromSubscription', () => {
  it('reads the invoice confirmation secret', () => {
    const subscription = {
      latest_invoice: {
        confirmation_secret: { client_secret: 'pi_secret_123', type: 'payment_intent' },
      },
    } as Stripe.Subscription;

    assert.equal(clientSecretFromSubscription(subscription), 'pi_secret_123');
  });

  it('returns null when the invoice was not expanded', () => {
    const subscription = { latest_invoice: 'in_123' } as Stripe.Subscription;
    assert.equal(clientSecretFromSubscription(subscription), null);
  });
});
