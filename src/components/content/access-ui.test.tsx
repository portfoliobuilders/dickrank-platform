import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentGuard } from "./ContentGuard";
import { Paywall } from "./Paywall";
import { PricingCard } from "../payments/PricingCard";

test("pricing card highlights the popular plan and lists features", () => {
  const html = renderToStaticMarkup(
    <PricingCard
      name="VIP"
      priceCents={1500}
      features={["All posts", "Live drops"]}
      popular
      ctaLabel="Subscribe"
      href="/creators/ada?tier=vip"
    />,
  );
  assert.match(html, /Most popular/);
  assert.match(html, /VIP/);
  assert.match(html, /All posts/);
  assert.match(html, /Live drops/);
  assert.match(html, /\$15\.00/);
  assert.match(html, /\/ month/);
  assert.match(html, /Subscribe/);
  assert.match(html, /href="\/creators\/ada\?tier=vip"/);
});

test("paywall shows a blurred preview, creator, tiers, and a one-time price", () => {
  const html = renderToStaticMarkup(
    <Paywall
      preview={{
        contentId: "11111111-1111-4111-8111-111111111111",
        title: "Studio set",
        previewText: "A short teaser line",
        thumbnailUrl: "https://example.com/preview.jpg",
        price: 499,
        accessType: "premium",
        creator: {
          id: "22222222-2222-4222-8222-222222222222",
          displayName: "Ada",
          avatarUrl: null,
          profilePath: "/creators/ada",
        },
        tiers: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            name: "Fan",
            priceCents: 500,
            features: ["Subscriber posts"],
            popular: true,
          },
        ],
      }}
    />,
  );
  assert.match(html, /Subscribe to view/);
  assert.match(html, /Preview/);
  assert.match(html, /A short teaser line/);
  assert.match(html, /Ada/);
  assert.match(html, /href="\/creators\/ada"/);
  assert.match(html, /Fan/);
  assert.match(html, /Unlock for \$4\.99/);
  assert.match(html, /preview\.jpg/);
});

test("content guard starts in a loading state before the access check", () => {
  const html = renderToStaticMarkup(
    <ContentGuard contentId="11111111-1111-4111-8111-111111111111">
      <p>Secret post</p>
    </ContentGuard>,
  );
  assert.match(html, /Checking your access/);
  assert.equal(html.includes("Secret post"), false);
});
