import { z } from "zod";

export const JEV_AI_BASE_URL = "https://jev-ai.pro/api/v1";
export const JEV_DEFAULT_MODEL = "jev-latest";

/** Laya models share this endpoint; confirm with listJevModels() before use. */
export const LAYA_ENGLISH_MODEL = "laya-english";
export const LAYA_MULTILINGUAL_MODEL = "laya-multilingual";

/** Per-question total token caps for Laya (state + instructions + labels). */
export const LAYA_TOKEN_LIMITS = {
  [LAYA_ENGLISH_MODEL]: 512,
  [LAYA_MULTILINGUAL_MODEL]: 1024,
} as const;

const questionIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9._-]+$/);

const noulQuestionSchema = z.object({
  type: z.literal("noul"),
  instructions: z.string().min(1),
  criteria: z
    .object({
      true: z.string().optional(),
      false: z.string().optional(),
    })
    .optional(),
});

const choiceQuestionSchema = z.object({
  type: z.literal("choice"),
  instructions: z.string().min(1),
  criteria: z.record(z.string(), z.string().nullable()).refine(
    (criteria) => Object.keys(criteria).length >= 2 && Object.keys(criteria).length <= 255,
    { message: "choice criteria must have 2–255 options" },
  ),
});

const scoreQuestionSchema = z.object({
  type: z.literal("score"),
  instructions: z.string().min(1),
  criteria: z.array(z.string().min(1)).min(2).max(10),
});

export const jevQuestionSchema = z.discriminatedUnion("type", [
  noulQuestionSchema,
  choiceQuestionSchema,
  scoreQuestionSchema,
]);

const stateSchema = z.union([
  z.string().min(1),
  z.record(z.string(), z.unknown()).refine((value) => Object.keys(value).length > 0, {
    message: "state object must be nonempty",
  }),
  z.array(z.unknown()).min(1),
]);

export const jevEvaluateRequestSchema = z
  .object({
    model: z.string().min(1).optional(),
    state: stateSchema,
    questions: z
      .record(questionIdSchema, jevQuestionSchema)
      .refine((questions) => {
        const count = Object.keys(questions).length;
        return count >= 1 && count <= 64;
      }, { message: "questions must contain 1–64 entries" }),
  })
  .strict();

export const jevSavedJudgeRequestSchema = z
  .object({
    model: z.string().min(1).optional(),
    state: stateSchema,
    judgeId: z.string().min(1),
    revision: z.number().int().positive().optional(),
  })
  .strict();

const noulAnswerSchema = z.object({
  type: z.literal("noul"),
  noul: z.number().min(0).max(1),
});

const choiceAnswerSchema = z.object({
  type: z.literal("choice"),
  choice: z.string(),
  probabilities: z.record(z.string(), z.number()),
  confidence: z.number(),
});

const scoreAnswerSchema = z.object({
  type: z.literal("score"),
  score: z.number(),
  legend: z.unknown().optional(),
  probabilities: z.record(z.string(), z.number()).optional(),
  confidence: z.number().optional(),
});

export const jevAnswerSchema = z.discriminatedUnion("type", [
  noulAnswerSchema,
  choiceAnswerSchema,
  scoreAnswerSchema,
]);

export const jevEvaluateResponseSchema = z.object({
  model: z.string(),
  answers: z.record(z.string(), jevAnswerSchema),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
  }),
});

export const jevModelsResponseSchema = z.object({
  models: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
    }),
  ),
});

export type JevQuestion = z.infer<typeof jevQuestionSchema>;
export type JevEvaluateRequest = z.infer<typeof jevEvaluateRequestSchema>;
export type JevSavedJudgeRequest = z.infer<typeof jevSavedJudgeRequestSchema>;
export type JevAnswer = z.infer<typeof jevAnswerSchema>;
export type JevEvaluateResponse = z.infer<typeof jevEvaluateResponseSchema>;
export type JevModelsResponse = z.infer<typeof jevModelsResponseSchema>;

export type JevErrorCode =
  | "misconfigured"
  | "unauthorized"
  | "payment_required"
  | "validation_error"
  | "rate_limited"
  | "upstream_error"
  | "http_error"
  | "invalid_response";

export class JevAiError extends Error {
  readonly status: number;
  readonly code: JevErrorCode;
  readonly retryAfterSeconds?: number;
  readonly details?: unknown;

  constructor(input: {
    status: number;
    code: JevErrorCode;
    message: string;
    retryAfterSeconds?: number;
    details?: unknown;
  }) {
    super(input.message);
    this.name = "JevAiError";
    this.status = input.status;
    this.code = input.code;
    this.retryAfterSeconds = input.retryAfterSeconds;
    this.details = input.details;
  }
}

export function isJevAiConfigured(): boolean {
  return Boolean(process.env.JEV_AI_API_KEY?.trim());
}

function requireApiKey(): string {
  const key = process.env.JEV_AI_API_KEY?.trim();
  if (!key) {
    throw new JevAiError({
      status: 500,
      code: "misconfigured",
      message: "JEV_AI_API_KEY is not set",
    });
  }
  return key;
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const asSeconds = Number(header);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds;
  }
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
  }
  return undefined;
}

async function readErrorBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function mapHttpError(status: number, details: unknown, retryAfterSeconds?: number): JevAiError {
  switch (status) {
    case 401:
      return new JevAiError({
        status,
        code: "unauthorized",
        message: "Jev AI rejected the API key (missing, invalid, or revoked)",
        details,
      });
    case 402:
      return new JevAiError({
        status,
        code: "payment_required",
        message: "Jev AI account has insufficient balance or spending is paused",
        details,
      });
    case 422:
      return new JevAiError({
        status,
        code: "validation_error",
        message: "Jev AI rejected the request body, state, model, or questions",
        details,
      });
    case 429:
      return new JevAiError({
        status,
        code: "rate_limited",
        message: "Jev AI rate or capacity limit exceeded",
        retryAfterSeconds,
        details,
      });
    case 502:
    case 503:
    case 504:
      return new JevAiError({
        status,
        code: "upstream_error",
        message: "Jev AI model or upstream service is unavailable",
        details,
      });
    default:
      return new JevAiError({
        status,
        code: "http_error",
        message: `Jev AI request failed with HTTP ${status}`,
        details,
      });
  }
}

type FetchLike = typeof fetch;

async function jevFetch(
  path: string,
  init: RequestInit,
  fetchImpl: FetchLike,
): Promise<Response> {
  const apiKey = requireApiKey();
  // Never log the Authorization header or apiKey.
  return fetchImpl(`${JEV_AI_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

async function handleJevResponse<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!response.ok) {
    const retryAfterSeconds = parseRetryAfter(response.headers.get("Retry-After"));
    const details = await readErrorBody(response);
    throw mapHttpError(response.status, details, retryAfterSeconds);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new JevAiError({
      status: 502,
      code: "invalid_response",
      message: "Jev AI returned a non-JSON success response",
    });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new JevAiError({
      status: 502,
      code: "invalid_response",
      message: "Jev AI returned an unexpected response shape",
      details: parsed.error.flatten(),
    });
  }

  return parsed.data;
}

/**
 * Evaluate typed questions against state via POST /systemone.
 * Does not automatically retry — POST outcomes may be uncertain after network/upstream failures.
 */
export async function evaluateSystemOne(
  input: JevEvaluateRequest | JevSavedJudgeRequest,
  options?: { fetch?: FetchLike },
): Promise<JevEvaluateResponse> {
  const body =
    "judgeId" in input
      ? jevSavedJudgeRequestSchema.parse(input)
      : jevEvaluateRequestSchema.parse(input);

  const payload = {
    model: body.model ?? JEV_DEFAULT_MODEL,
    ...body,
  };

  const response = await jevFetch(
    "/systemone",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    options?.fetch ?? fetch,
  );

  return handleJevResponse(response, jevEvaluateResponseSchema);
}

/**
 * List models connected to this Jev account. Use this for UI model selectors
 * instead of assuming Laya/Jev aliases are available.
 */
export async function listJevModels(options?: {
  fetch?: FetchLike;
}): Promise<JevModelsResponse> {
  const response = await jevFetch(
    "/models",
    { method: "GET" },
    options?.fetch ?? fetch,
  );
  return handleJevResponse(response, jevModelsResponseSchema);
}

/** Convenience accessor for noul (yes-probability) answers. */
export function getNoulProbability(
  result: JevEvaluateResponse,
  questionId: string,
): number {
  const answer = result.answers[questionId];
  if (!answer || answer.type !== "noul") {
    throw new JevAiError({
      status: 500,
      code: "invalid_response",
      message: `Expected noul answer for question "${questionId}"`,
      details: answer,
    });
  }
  return answer.noul;
}
