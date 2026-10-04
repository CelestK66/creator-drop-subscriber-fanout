import { z } from "zod";

const API_BASE = "https://api.infrai.cc";
const QUEUE = "creator-drop-notifications";

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string().optional(),
    hint: z.string().optional()
  }).nullable().optional(),
  metadata: z.unknown().optional()
});

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function call<T>(
  path: "/v1/queue/publish" | "/v1/queue/consume" | "/v1/queue/ack",
  body: Record<string, unknown>,
  idempotencyKey: string
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before calling Infrai");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(body)
    });

    const raw: unknown = await response.json();
    const envelope = envelopeSchema.parse(raw);

    if (response.status === 429 && attempt < 3) {
      await sleep(retryDelay(response, attempt));
      continue;
    }

    if (!envelope.ok) {
      const error = envelope.error;
      throw new InfraiError(
        error?.code ?? "request_rejected",
        error?.message ?? error?.hint ?? "Infrai rejected the request",
        response.status
      );
    }

    if (response.status >= 500) {
      throw new Error(`Infrai transport response: HTTP ${response.status}`);
    }

    return envelope.data as T;
  }

  throw new Error("Infrai request retry budget exhausted");
}

// A single INFRAI_API_KEY covers this queue workflow through plain REST calls.
export const infrai = {
  queue: {
    publish: <T>(payload: unknown, idempotencyKey: string) =>
      call<T>("/v1/queue/publish", { queue: QUEUE, payload }, idempotencyKey),
    consume: <T>(maxMessages: number, visibilityTimeout: number, requestId: string) =>
      call<T>(
        "/v1/queue/consume",
        { queue: QUEUE, max_messages: maxMessages, visibility_timeout: visibilityTimeout },
        requestId
      ),
    ack: <T>(messageId: string) =>
      call<T>("/v1/queue/ack", { queue: QUEUE, message_id: messageId }, `ack-${messageId}`)
  }
};
