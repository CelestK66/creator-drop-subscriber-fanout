import { z } from "zod";

export const fanoutRequestSchema = z.object({
  campaign_id: z.string().min(1),
  creator: z.object({
    handle: z.string().min(1)
  }),
  asset: z.object({
    asset_id: z.string().min(1),
    title: z.string().min(1),
    download_url: z.string().url(),
    processing_status: z.enum(["ready", "processing"])
  }),
  subscribers: z.array(z.object({
    subscriber_id: z.string().min(1),
    email: z.string().email(),
    status: z.enum(["active", "paused"]),
    creator_updates: z.boolean()
  })).min(1)
});

export type FanoutRequest = z.infer<typeof fanoutRequestSchema>;

export type DeliveryJob = {
  campaign_id: string;
  subscriber_id: string;
  email: string;
  creator_handle: string;
  asset_id: string;
  asset_title: string;
  download_url: string;
};

export function planFanout(input: FanoutRequest): {
  jobs: DeliveryJob[];
  skipped: Array<{ subscriber_id: string; reason: string }>;
} {
  if (input.asset.processing_status !== "ready") {
    return {
      jobs: [],
      skipped: input.subscribers.map(({ subscriber_id }) => ({
        subscriber_id,
        reason: "asset_processing"
      }))
    };
  }

  const jobs: DeliveryJob[] = [];
  const skipped: Array<{ subscriber_id: string; reason: string }> = [];

  for (const subscriber of input.subscribers) {
    if (subscriber.status !== "active" || !subscriber.creator_updates) {
      skipped.push({ subscriber_id: subscriber.subscriber_id, reason: "subscriber_preference" });
      continue;
    }

    jobs.push({
      campaign_id: input.campaign_id,
      subscriber_id: subscriber.subscriber_id,
      email: subscriber.email,
      creator_handle: input.creator.handle,
      asset_id: input.asset.asset_id,
      asset_title: input.asset.title,
      download_url: input.asset.download_url
    });
  }

  return { jobs, skipped };
}
