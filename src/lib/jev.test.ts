import { afterEach, describe, expect, it, vi } from "vitest";
import {
  evaluateSystemOne,
  getNoulProbability,
  JevAiError,
  listJevModels,
} from "./jev";

const originalKey = process.env.JEV_AI_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) {
    delete process.env.JEV_AI_API_KEY;
  } else {
    process.env.JEV_AI_API_KEY = originalKey;
  }
});

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("evaluateSystemOne", () => {
  it("posts to systemone and returns typed answers + usage", async () => {
    process.env.JEV_AI_API_KEY = "test-key";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://jev-ai.pro/api/v1/systemone");
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer test-key");
      expect(headers.get("Content-Type")).toBe("application/json");
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("jev-latest");
      expect(body.state).toBe("My payment failed. Please help.");
      expect(body.questions.urgent.type).toBe("noul");
      return jsonResponse({
        model: "jev-1.13.0",
        answers: {
          urgent: { type: "noul", noul: 0.91 },
        },
        usage: { input_tokens: 42, output_tokens: 3 },
      });
    });

    const result = await evaluateSystemOne(
      {
        model: "jev-latest",
        state: "My payment failed. Please help.",
        questions: {
          urgent: {
            type: "noul",
            instructions: "Does this message need urgent support?",
          },
        },
      },
      { fetch: fetchMock as unknown as typeof fetch },
    );

    expect(result.model).toBe("jev-1.13.0");
    expect(getNoulProbability(result, "urgent")).toBe(0.91);
    expect(result.usage).toEqual({ input_tokens: 42, output_tokens: 3 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("defaults model to jev-latest when omitted", async () => {
    process.env.JEV_AI_API_KEY = "test-key";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("jev-latest");
      return jsonResponse({
        model: "jev-1.13.0",
        answers: { urgent: { type: "noul", noul: 0.2 } },
        usage: { input_tokens: 10, output_tokens: 1 },
      });
    });

    await evaluateSystemOne(
      {
        state: "hello",
        questions: {
          urgent: { type: "noul", instructions: "Urgent?" },
        },
      },
      { fetch: fetchMock as unknown as typeof fetch },
    );
  });

  it("maps 401/402/422/429/502/504 without retrying POST", async () => {
    process.env.JEV_AI_API_KEY = "test-key";

    const cases: Array<{
      status: number;
      code: JevAiError["code"];
      headers?: HeadersInit;
      retryAfterSeconds?: number;
    }> = [
      { status: 401, code: "unauthorized" },
      { status: 402, code: "payment_required" },
      { status: 422, code: "validation_error" },
      {
        status: 429,
        code: "rate_limited",
        headers: { "Retry-After": "7" },
        retryAfterSeconds: 7,
      },
      { status: 502, code: "upstream_error" },
      { status: 504, code: "upstream_error" },
    ];

    for (const testCase of cases) {
      const fetchMock = vi.fn(async () =>
        new Response(JSON.stringify({ error: "nope" }), {
          status: testCase.status,
          headers: testCase.headers,
        }),
      );

      let caught: unknown;
      try {
        await evaluateSystemOne(
          {
            state: "x",
            questions: { q: { type: "noul", instructions: "y?" } },
          },
          { fetch: fetchMock as unknown as typeof fetch },
        );
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(JevAiError);
      const jevError = caught as JevAiError;
      expect(jevError.status).toBe(testCase.status);
      expect(jevError.code).toBe(testCase.code);
      expect(jevError.retryAfterSeconds).toBe(testCase.retryAfterSeconds);
      // POST must not be retried when the outcome may already have been applied.
      expect(fetchMock).toHaveBeenCalledOnce();
    }
  });

  it("throws misconfigured when the key is missing", async () => {
    delete process.env.JEV_AI_API_KEY;
    const fetchMock = vi.fn();

    await expect(
      evaluateSystemOne(
        {
          state: "x",
          questions: { q: { type: "noul", instructions: "y?" } },
        },
        { fetch: fetchMock as unknown as typeof fetch },
      ),
    ).rejects.toMatchObject({ code: "misconfigured", status: 500 });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("listJevModels", () => {
  it("returns connected models from GET /models", async () => {
    process.env.JEV_AI_API_KEY = "test-key";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://jev-ai.pro/api/v1/models");
      expect(init?.method).toBe("GET");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer test-key");
      return jsonResponse({
        models: [
          { name: "jev-latest", description: "Stable Jev alias" },
          { name: "laya-english", description: "Laya English" },
        ],
      });
    });

    const result = await listJevModels({
      fetch: fetchMock as unknown as typeof fetch,
    });

    expect(result.models.map((model) => model.name)).toEqual([
      "jev-latest",
      "laya-english",
    ]);
  });
});
