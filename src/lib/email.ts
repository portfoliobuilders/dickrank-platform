import { mkdir, writeFile } from "fs/promises";
import path from "path";

const CODE_TTL_MS = 15 * 60 * 1000;

export function verificationExpiry(): Date {
  return new Date(Date.now() + CODE_TTL_MS);
}

export async function sendVerificationCode(email: string, code: string): Promise<void> {
  const webhook = process.env.EMAIL_WEBHOOK_URL;
  if (webhook) {
    const from = process.env.EMAIL_FROM ?? "noreply@dickrank.online";
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: email,
        subject: "Your DickRank verification code",
        text: `Your verification code is ${code}. It expires in 15 minutes.`,
      }),
    });
    if (!response.ok) {
      throw new Error("Email delivery failed");
    }
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Email delivery is not configured");
  }

  const dir = path.join(process.cwd(), "storage", "dev-mailbox");
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${email.replace(/[^a-z0-9@._-]/gi, "_")}.txt`;
  await writeFile(
    path.join(dir, filename),
    `to: ${email}\ncode: ${code}\nexpires: ${verificationExpiry().toISOString()}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
}
