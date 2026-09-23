import { prisma } from "@/lib/prisma";
import { financialRetainUntil } from "@/lib/retention";

export async function recordPayment(input: {
  userId: string;
  amountCents: number;
  currency: string;
  description?: string;
}) {
  const createdAt = new Date();
  return prisma.paymentRecord.create({
    data: {
      userId: input.userId,
      accountRef: input.userId,
      amountCents: input.amountCents,
      currency: input.currency.toLowerCase(),
      description: input.description,
      retainUntil: financialRetainUntil(createdAt),
      createdAt,
    },
  });
}

export async function closePaymentAccount(stripeAccountId: string | null): Promise<void> {
  if (!stripeAccountId) return;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is required to close the payment account");
  }
  const response = await fetch(`https://api.stripe.com/v1/accounts/${encodeURIComponent(stripeAccountId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}` },
  });
  if (response.status === 404) return;
  if (!response.ok) {
    throw new Error(`Unable to close payment account (${response.status})`);
  }
}
