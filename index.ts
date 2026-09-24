import { generateText } from "ai";

async function main() {
  const { text } = await generateText({
    model: "openai/gpt-5.5",
    prompt:
      "Invent a new holiday and describe its traditions. Keep it to a few short paragraphs.",
  });

  console.log(text);
}

main().catch((error) => {
  console.error("Failed to generate text:", error);
  process.exit(1);
});
