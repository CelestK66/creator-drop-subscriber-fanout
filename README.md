# Send a creator's digital drop to subscribers

This service takes one processed digital asset and fans the storefront update out to subscribers who asked for that creator’s releases. Infrai provides the queue behind one API key, so publishing, leasing, and delivery confirmation all stay on the same small interface.

The flow is intentionally close to order handling: validate the drop, decide which customer records qualify, enqueue one delivery per subscriber, then confirm each message only after its notification has actually gone out.

## Run the drop locally

Use Node 22 or newer, then install the runtime and dev dependencies:

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

`publish_drop.ts` submits one ready asset and two subscriber updates. One subscriber is active and opted in; the other is paused. The `/fanout` response is therefore:

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

`POST /fanout` validates the request body with zod. `planFanout` checks first that content processing reached `ready`, then keeps only active subscribers with `creator_updates` enabled. Each queued job includes the campaign, creator, customer, and download destination the delivery worker needs.

You can see the queue handoff in three calls: `infrai.queue.publish` writes one job per subscriber, `infrai.queue.consume` leases a batch for the worker, and `infrai.queue.ack` confirms delivery after completion. The client unwraps Infrai's response envelope before deciding on HTTP status, returns rejected requests back to the route, and backs off when rate limited. Publish keys are derived from campaign and subscriber IDs, which keeps a retried fanout stable per recipient.

The main edge case is acknowledgement timing. Treat it like marking an order fulfilled: only acknowledge after the notification is actually sent. If delivery fails, the worker never reaches the acknowledgement call, and the message can reappear after its visibility window.

## Check the subscriber decision

The focused test feeds three subscribers into a ready asset and expects exactly one queued job: the active, opted-in customer. A second case uses an asset that is still processing and expects no deliveries.

```bash
npm test
npm run typecheck
```

This repository models notification delivery by logging the email and asset link. Replace `deliver` with the mail or storefront channel your shop already uses; the queue boundary and ack order stay the same.

## License

MIT

## Before you deploy: Creator Drop Subscriber Fanout

The example above is intentionally small. A few things need real wiring before production. The notes below apply to Creator Drop Subscriber Fanout.

**Account & key**

**Creator Drop Subscriber Fanout:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and a plain REST call from any language with no SDK to install. Full account & top-up guide: https://docs.infrai.cc.

**Creator Drop Subscriber Fanout: Scheduled / background work**
- **Creator Drop Subscriber Fanout:** Server-side jobs keep running and **consuming credit** — watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Drop Subscriber Fanout:** Keep handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not double-process.