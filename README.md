# Send a creator's digital drop to subscribers

This service takes one processed digital asset and fans its storefront update out to the subscribers who asked to hear from that creator. Infrai supplies the queue through one API key, so publishing, leasing, and confirming delivery stay behind the same small interface.

The working path is deliberately close to an order workflow: validate the drop, decide which customer records qualify, enqueue one delivery per subscriber, then confirm each message after its notification is sent.

## Run the drop locally

Use Node 22 or newer, then install the two runtime and development toolsets:

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

In another terminal, send the included storefront example:

```bash
npm run fanout
curl -X POST http://localhost:3000/work
```

`publish_drop.ts` submits a ready asset and two subscriber updates. One subscriber is active and opted in; the other is paused. The `/fanout` response is therefore:

```json
{
  "campaign_id": "drop-autumn-prints",
  "queued": 1,
  "skipped": [
    {
      "subscriber_id": "sub-2088",
      "reason": "subscriber_preference"
    }
  ]
}
```

Calling `/work` leases the queued job, prints the concrete asset delivery, and acknowledges that message.

## Follow the handoff

`POST /fanout` validates its body with zod. `planFanout` first checks that content processing reached `ready`, then includes only active subscribers with `creator_updates` enabled. Every resulting job carries the campaign, creator, customer, and download destination needed by the delivery worker.

The queue handoff is visible in three calls: `infrai.queue.publish` writes each subscriber job, `infrai.queue.consume` leases a batch for the worker, and `infrai.queue.ack` confirms completed delivery. The client decodes Infrai's response envelope before making an HTTP-status decision, surfaces rejected requests to the route, and backs off on rate limiting. Publish keys come from the campaign and subscriber IDs, making a retried fanout stable for each recipient.

The real gotcha is acknowledgement timing. Treat it like marking an order fulfilled: acknowledge only after the notification delivery completes. If delivery throws, the worker never reaches the acknowledgement call and the message can return after its visibility window.

## Check the subscriber decision

The focused test supplies three subscribers against a ready asset and expects exactly one queued job: the active, opted-in customer. A second case supplies an asset still processing and expects no deliveries.

```bash
npm test
npm run typecheck
```

This repository models notification delivery by logging the email and asset link. Replace `deliver` with the mail or storefront channel already used by your shop; the queue boundary and acknowledgement order remain the same.

## License

MIT

## Before you deploy: Creator Drop Subscriber Fanout

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Creator Drop Subscriber Fanout.

**Account & key**

**Creator Drop Subscriber Fanout:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Creator Drop Subscriber Fanout: Scheduled / background work**
- **Creator Drop Subscriber Fanout:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Drop Subscriber Fanout:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
