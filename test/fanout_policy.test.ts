import assert from "node:assert/strict";
import test from "node:test";
import { fanoutRequestSchema, planFanout } from "../src/fanout_policy.js";

test("queues only opted-in active subscribers when the asset is ready", () => {
  const input = fanoutRequestSchema.parse({
    campaign_id: "drop-42",
    creator: { handle: "studio-kite" },
    asset: {
      asset_id: "asset-9",
      title: "Retail display templates",
      download_url: "https://downloads.example.com/asset-9.zip",
      processing_status: "ready"
    },
    subscribers: [
      { subscriber_id: "a", email: "a@example.com", status: "active", creator_updates: true },
      { subscriber_id: "b", email: "b@example.com", status: "paused", creator_updates: true },
      { subscriber_id: "c", email: "c@example.com", status: "active", creator_updates: false }
    ]
  });

  const plan = planFanout(input);

  assert.deepEqual(plan.jobs.map((job) => job.subscriber_id), ["a"]);
  assert.deepEqual(plan.skipped, [
    { subscriber_id: "b", reason: "subscriber_preference" },
    { subscriber_id: "c", reason: "subscriber_preference" }
  ]);
});

test("holds every notification while content processing is incomplete", () => {
  const input = fanoutRequestSchema.parse({
    campaign_id: "drop-43",
    creator: { handle: "studio-kite" },
    asset: {
      asset_id: "asset-10",
      title: "Window display guide",
      download_url: "https://downloads.example.com/asset-10.zip",
      processing_status: "processing"
    },
    subscribers: [
      { subscriber_id: "a", email: "a@example.com", status: "active", creator_updates: true }
    ]
  });

  const plan = planFanout(input);

  assert.equal(plan.jobs.length, 0);
  assert.deepEqual(plan.skipped, [{ subscriber_id: "a", reason: "asset_processing" }]);
});
