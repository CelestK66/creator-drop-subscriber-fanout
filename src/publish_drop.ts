const request = {
  campaign_id: "drop-autumn-prints",
  creator: { handle: "lin-makes" },
  asset: {
    asset_id: "print-pack-07",
    title: "Autumn storefront print pack",
    download_url: "https://downloads.example.com/assets/print-pack-07.zip",
    processing_status: "ready"
  },
  subscribers: [
    {
      subscriber_id: "sub-1042",
      email: "buyer@example.com",
      status: "active",
      creator_updates: true
    },
    {
      subscriber_id: "sub-2088",
      email: "paused@example.com",
      status: "paused",
      creator_updates: true
    }
  ]
};

const response = await fetch("http://localhost:3000/fanout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(request)
});

console.log(JSON.stringify(await response.json(), null, 2));

export {};
