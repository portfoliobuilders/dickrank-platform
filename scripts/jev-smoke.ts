/**
 * Minimal live smoke check for Jev AI.
 *
 * Configure the key first (never commit it):
 *   - Local: add JEV_AI_API_KEY=... to .env.local
 *   - Vercel: Project Settings → Environment Variables → JEV_AI_API_KEY (sensitive)
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/jev-smoke.ts
 */
import { evaluateSystemOne, getNoulProbability, isJevAiConfigured } from "../src/lib/jev";

async function main() {
  if (!isJevAiConfigured()) {
    console.error(
      "JEV_AI_API_KEY is not set. Add it to .env.local (local) or Vercel env vars (deploy).",
    );
    process.exit(1);
  }

  const result = await evaluateSystemOne({
    model: "jev-latest",
    state: "My payment failed. Please help.",
    questions: {
      urgent: {
        type: "noul",
        instructions: "Does this message need urgent support?",
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        model: result.model,
        urgentNoul: getNoulProbability(result, "urgent"),
        answers: result.answers,
        usage: result.usage,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Live Jev call failed:", message);
  process.exit(1);
});
