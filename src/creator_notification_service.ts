import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import { fanoutRequestSchema, planFanout, type DeliveryJob } from "./fanout_policy.js";
import { InfraiError, infrai } from "./infrai_queue.js";

const consumedSchema = z.object({
  messages: z.array(z.object({
    message_id: z.string(),
    payload: z.object({
      campaign_id: z.string(),
      subscriber_id: z.string(),
      email: z.string().email(),
      creator_handle: z.string(),
      asset_id: z.string(),
      asset_title: z.string(),
      download_url: z.string().url()
    })
  })).default([])
});

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function publishFanout(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const input = fanoutRequestSchema.parse(await readJson(request));
  const plan = planFanout(input);

  await Promise.all(plan.jobs.map((job) =>
    infrai.queue.publish<unknown>(job, `${job.campaign_id}-${job.subscriber_id}`)
  ));

  json(response, 202, {
    campaign_id: input.campaign_id,
    queued: plan.jobs.length,
    skipped: plan.skipped
  });
}

async function deliver(job: DeliveryJob): Promise<void> {
  console.log(
    `Storefront update for ${job.email}: ${job.asset_title} by @${job.creator_handle} -> ${job.download_url}`
  );
}

async function workBatch(response: ServerResponse): Promise<void> {
  const raw = await infrai.queue.consume<unknown>(20, 60, `consume-${randomUUID()}`);
  const batch = consumedSchema.parse(raw);

  for (const message of batch.messages) {
    await deliver(message.payload as DeliveryJob);
    // The checkout-style rule: confirm only after the subscriber delivery completes.
    await infrai.queue.ack<unknown>(message.message_id);
  }

  json(response, 200, { delivered: batch.messages.length });
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/fanout") {
      await publishFanout(request, response);
      return;
    }
    if (request.method === "POST" && request.url === "/work") {
      await workBatch(response);
      return;
    }
    json(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "invalid_request" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code, message: error.message });
      return;
    }
    console.error(error);
    json(response, 500, { error: "service_error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Creator notification service listening on http://localhost:${port}`));
