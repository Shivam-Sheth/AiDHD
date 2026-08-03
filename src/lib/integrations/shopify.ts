import { hasShopify } from "./config";
import { logRequest, logResponse, logInfo } from "../checkout/debug-log";

/**
 * Shopify Storefront API — product discovery + cart creation only.
 *
 * There is no programmatic "charge a card" endpoint here on purpose: Shopify
 * deprecated the Checkout API's tokenized-payment mutations (including
 * checkoutCompleteWithTokenizedPaymentV3) in April 2025, and its replacement
 * (Cart API, used below) can only build a cart and hand back a hosted
 * `checkoutUrl` — actual payment always happens on that hosted page. Getting
 * Prava's one-time card onto that page is checkout/browser-harness.ts's job
 * (Playwright), not this file's.
 */

function apiVersion() {
  return process.env.SHOPIFY_API_VERSION || "2025-10";
}

function storefrontUrl() {
  return `https://${process.env.SHOPIFY_STORE_DOMAIN}/api/${apiVersion()}/graphql.json`;
}

async function storefrontFetch<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  const url = storefrontUrl();
  const reqBody = { query, variables };
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || "";
  // Redacted (last 4 chars + length only) — lets us confirm via Vercel logs
  // which token value is actually loaded at runtime without ever printing
  // the real value.
  logInfo("shopify", "using token", {
    length: token.length,
    last4: token.slice(-4) || "(empty)",
    domain: process.env.SHOPIFY_STORE_DOMAIN || "(unset)",
  });
  logRequest("shopify", "POST", url, reqBody);
  try {
    const res = await fetch(url, {
      method: "POST",
      // Never let Next.js's fetch cache serve a stale response for this —
      // every call must hit Shopify live.
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify(reqBody),
    });
    const json = (await res.json().catch(() => null)) as
      | ({ data?: T; errors?: Array<{ message?: string }> })
      | null;
    logResponse("shopify", "POST", url, res.status, json);
    if (!res.ok || json?.errors?.length) {
      logInfo("shopify", "storefront request failed", { errors: json?.errors });
      return null;
    }
    return json?.data ?? null;
  } catch (e) {
    logInfo("shopify", "storefront request threw", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return null;
  }
}

export type ShopifyProductOffer = {
  id: string;
  /** Variant (not product) id — this is what a cart line item needs. */
  variant_id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  image_url: string | null;
  available: boolean;
  /** Public product URL, when we resolved this from a link. */
  url?: string | null;
};

/**
 * Demo catalog used when SHOPIFY_STORE_DOMAIN / SHOPIFY_STOREFRONT_ACCESS_TOKEN
 * aren't set, or the live call fails — same "never block on missing keys"
 * rule as every other integration/*.ts. variant_id is a fixture placeholder;
 * it will not resolve against a real cart, only look plausible in the UI.
 */
const FIXTURE_PRODUCTS: ShopifyProductOffer[] = [
  {
    id: "gid://fixture/Product/1",
    variant_id: "gid://fixture/ProductVariant/1",
    title: "Flight Credit — Economy",
    description: "Stand-in for a booked economy flight leg.",
    price: 240,
    currency: "USD",
    image_url: null,
    available: true,
  },
  {
    id: "gid://fixture/Product/2",
    variant_id: "gid://fixture/ProductVariant/2",
    title: "Boutique Hotel — 1 Night",
    description: "Stand-in for a hotel stay leg.",
    price: 180,
    currency: "USD",
    image_url: null,
    available: true,
  },
  {
    id: "gid://fixture/Product/3",
    variant_id: "gid://fixture/ProductVariant/3",
    title: "Prix Fixe Dinner for Two",
    description: "Stand-in for a dining reservation leg.",
    price: 95,
    currency: "USD",
    image_url: null,
    available: true,
  },
  {
    id: "gid://fixture/Product/4",
    variant_id: "gid://fixture/ProductVariant/4",
    title: "Concert Ticket — GA",
    description: "Stand-in for a ticket leg.",
    price: 65,
    currency: "USD",
    image_url: null,
    available: true,
  },
];

const SEARCH_QUERY = /* GraphQL */ `
  query SearchProducts($query: String, $first: Int!) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          title
          description
          onlineStoreUrl
          featuredImage {
            url
          }
          variants(first: 1) {
            edges {
              node {
                id
                availableForSale
                price {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  }
`;

type ProductNode = {
  id: string;
  title: string;
  description?: string;
  onlineStoreUrl?: string | null;
  featuredImage?: { url?: string } | null;
  variants?: {
    edges?: Array<{
      node?: {
        id: string;
        title?: string;
        availableForSale?: boolean;
        price?: { amount?: string; currencyCode?: string };
      };
    }>;
  };
};

type SearchProductsData = {
  products?: { edges?: Array<{ node?: ProductNode }> };
};

/** Shared node → offer mapping, using the variant a caller picked (default first). */
function toOffer(node: ProductNode, variantId?: string): ShopifyProductOffer | null {
  const variants = (node.variants?.edges ?? [])
    .map((e) => e.node)
    .filter((v): v is NonNullable<typeof v> => Boolean(v));

  // A variant id in the URL wins; otherwise prefer something in stock.
  const chosen =
    (variantId && variants.find((v) => v.id.endsWith(variantId))) ||
    variants.find((v) => v.availableForSale) ||
    variants[0];
  if (!chosen?.id) return null;

  return {
    id: node.id,
    variant_id: chosen.id,
    title: node.title,
    description: node.description || "",
    price: Number(chosen.price?.amount ?? 0),
    currency: chosen.price?.currencyCode || "USD",
    image_url: node.featuredImage?.url || null,
    available: chosen.availableForSale ?? false,
    url: node.onlineStoreUrl ?? null,
  };
}

/** Lets the LLM ("what can I book/buy?") search the connected Shopify catalog. */
export async function searchShopifyProducts(input: {
  query?: string;
  limit?: number;
}): Promise<{ offers: ShopifyProductOffer[]; source: "shopify" | "fixture" }> {
  if (hasShopify()) {
    const data = await storefrontFetch<SearchProductsData>(SEARCH_QUERY, {
      query: input.query || null,
      first: input.limit ?? 10,
    });
    const offers = (data?.products?.edges ?? [])
      .map((e) => e.node)
      .filter((n): n is ProductNode => Boolean(n))
      .map((n) => toOffer(n))
      .filter((o): o is ShopifyProductOffer => Boolean(o));
    if (offers.length) return { offers, source: "shopify" };
  }

  const q = (input.query || "").toLowerCase().trim();
  const offers = q
    ? FIXTURE_PRODUCTS.filter(
        (o) => o.title.toLowerCase().includes(q) || o.description.toLowerCase().includes(q),
      )
    : FIXTURE_PRODUCTS;
  return { offers: offers.length ? offers : FIXTURE_PRODUCTS, source: "fixture" };
}

const PRODUCT_BY_HANDLE_QUERY = /* GraphQL */ `
  query ProductByHandle($handle: String!) {
    product(handle: $handle) {
      id
      title
      description
      onlineStoreUrl
      featuredImage {
        url
      }
      variants(first: 50) {
        edges {
          node {
            id
            title
            availableForSale
            price {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`;

type ProductByHandleData = { product?: ProductNode | null };

/** Any http(s) URL in a chat message. */
export function extractUrls(text: string): string[] {
  return text.match(/https?:\/\/[^\s<>"')]+/gi) ?? [];
}

/**
 * A Shopify storefront product link, e.g.
 * https://shop.example.com/products/blue-hoodie?variant=44123456789
 * Returns the handle plus the variant id when the link pins one.
 */
export function parseShopifyProductUrl(
  raw: string,
): { handle: string; variant_id?: string; host: string } | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  // /products/<handle> — also matches locale-prefixed paths like /en-us/products/x
  const match = url.pathname.match(/\/products\/([^/?#]+)/i);
  if (!match?.[1]) return null;
  const variant = url.searchParams.get("variant") || undefined;
  return {
    handle: decodeURIComponent(match[1]),
    variant_id: variant || undefined,
    host: url.host,
  };
}

export type ResolveProductOutcome =
  | { ok: true; offer: ShopifyProductOffer; source: "shopify" | "fixture" }
  | { ok: false; reason: string };

/**
 * Turn a pasted product link into something buyable.
 *
 * The Storefront API is scoped to one store, so a link to a *different*
 * merchant cannot be resolved by us at all — that's reported plainly rather
 * than silently substituting some other product, because the failure mode of
 * guessing here is charging someone for the wrong thing.
 */
export async function resolveShopifyProductUrl(
  rawUrl: string,
): Promise<ResolveProductOutcome> {
  const parsed = parseShopifyProductUrl(rawUrl);
  if (!parsed) {
    return { ok: false, reason: "That link isn't a product page I can read." };
  }

  if (!hasShopify()) {
    // Mock mode mirrors the rest of integrations/: give back something
    // plausible so the chat flow is demoable without store keys.
    const fixture = FIXTURE_PRODUCTS[0]!;
    return {
      ok: true,
      source: "fixture",
      offer: {
        ...fixture,
        title: parsed.handle.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        url: rawUrl,
      },
    };
  }

  const configured = (process.env.SHOPIFY_STORE_DOMAIN || "").toLowerCase();
  const data = await storefrontFetch<ProductByHandleData>(PRODUCT_BY_HANDLE_QUERY, {
    handle: parsed.handle,
  });
  if (!data?.product) {
    const otherStore =
      configured && !parsed.host.toLowerCase().includes(configured.replace(/^https?:\/\//, ""));
    return {
      ok: false,
      reason: otherStore
        ? `That link is for ${parsed.host}, which isn't the connected store — I can only buy from ${configured}.`
        : `I couldn't find "${parsed.handle}" in the store.`,
    };
  }

  const offer = toOffer(data.product, parsed.variant_id);
  if (!offer) {
    return { ok: false, reason: "That product has no purchasable variant." };
  }
  if (!offer.available) {
    return { ok: false, reason: `${offer.title} is out of stock.` };
  }
  return { ok: true, offer: { ...offer, url: offer.url || rawUrl }, source: "shopify" };
}

const CART_CREATE_MUTATION = /* GraphQL */ `
  mutation CreateCart($lines: [CartLineInput!]!, $email: String) {
    cartCreate(input: { lines: $lines, buyerIdentity: { email: $email } }) {
      cart {
        id
        checkoutUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type CartCreateData = {
  cartCreate?: {
    cart?: { id: string; checkoutUrl: string } | null;
    userErrors?: Array<{ field?: string[]; message?: string }>;
  };
};

export type ShopifyCartResult =
  | { ok: true; cart_id: string; checkout_url: string; mode: "live" | "mock" }
  | { ok: false; error: string };

/**
 * Builds a cart for exactly one variant and returns its hosted checkoutUrl —
 * the URL checkout/browser-harness.ts drives with Prava's one-time card.
 */
export async function createShopifyCart(input: {
  variant_id: string;
  quantity?: number;
  email: string;
}): Promise<ShopifyCartResult> {
  if (!hasShopify() || input.variant_id.startsWith("gid://fixture/")) {
    return {
      ok: true,
      cart_id: `gid://mock/Cart/${Date.now()}`,
      checkout_url: "https://example.myshopify.com/checkout/mock",
      mode: "mock",
    };
  }
  const data = await storefrontFetch<CartCreateData>(CART_CREATE_MUTATION, {
    lines: [{ merchandiseId: input.variant_id, quantity: input.quantity ?? 1 }],
    email: input.email,
  });
  const errors = data?.cartCreate?.userErrors;
  if (errors?.length) {
    return { ok: false, error: errors.map((e) => e.message).filter(Boolean).join("; ") || "Cart creation failed" };
  }
  const cart = data?.cartCreate?.cart;
  if (!cart?.checkoutUrl) {
    return { ok: false, error: "Shopify returned no checkoutUrl" };
  }
  return { ok: true, cart_id: cart.id, checkout_url: cart.checkoutUrl, mode: "live" };
}
