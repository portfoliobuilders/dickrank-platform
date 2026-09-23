import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Stripe is not configured");
  }
  stripeClient = new Stripe(secretKey);
  return stripeClient;
}

export const STRIPE_MIN_CHARGE_CENTS = 50;
