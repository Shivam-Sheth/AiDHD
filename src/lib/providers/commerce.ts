/**
 * Commerce provider interface — product search + hosted checkout handoff.
 *
 * Shopify implementation is owned by another team; this interface is the
 * contract their module plugs into (see registerCommerceProvider in
 * providers/index.ts). Until then a fixture provider keeps product flows
 * demoable end-to-end.
 */

export type Product = {
  id: string;
  merchant: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  image_url?: string;
  url?: string;
  options?: Record<string, string[]>; // e.g. { size: ["9","10"], color: [...] }
  in_stock: boolean;
};

export type ProductSearchInput = {
  query: string;
  merchant?: string;
  max_price?: number;
  options?: Record<string, string>; // e.g. { size: "10" }
  limit?: number;
};

export type CheckoutInput = {
  product_id: string;
  quantity?: number;
  options?: Record<string, string>;
  user_email?: string;
};

export type CheckoutSession = {
  ok: boolean;
  /** Provider-hosted checkout URL — payment details never touch our servers. */
  checkout_url?: string;
  session_id?: string;
  error?: string;
};

export interface CommerceProvider {
  name: string;
  searchProducts(input: ProductSearchInput): Promise<Product[]>;
  /** Start a provider-hosted checkout (never collects card data directly). */
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
}

// ---------------------------------------------------------------------------
// Fixture provider (until the Shopify module is registered)
// ---------------------------------------------------------------------------

const FIXTURE_PRODUCTS: Product[] = [
  {
    id: "prod_runner_01",
    merchant: "Stride Supply",
    title: "Cloudrunner 2 Running Shoes",
    description: "Neutral daily trainer, breathable knit upper.",
    price: 129.99,
    currency: "USD",
    options: { size: ["8", "9", "10", "11", "12"] },
    in_stock: true,
  },
  {
    id: "prod_jacket_01",
    merchant: "North Peak",
    title: "Packable Rain Shell",
    description: "Waterproof 2.5-layer shell, stuffs into its own pocket.",
    price: 89.0,
    currency: "USD",
    options: { size: ["S", "M", "L", "XL"] },
    in_stock: true,
  },
  {
    id: "prod_speaker_01",
    merchant: "Sona Audio",
    title: "Roam Mini Bluetooth Speaker",
    description: "12h battery, IP67, surprisingly loud for the size.",
    price: 59.0,
    currency: "USD",
    in_stock: true,
  },
  {
    id: "prod_espresso_01",
    merchant: "Crema Lab",
    title: "Travel Espresso Kit",
    description: "Manual press + grinder, makes a real shot anywhere.",
    price: 74.5,
    currency: "USD",
    in_stock: true,
  },
];

export const fixtureCommerceProvider: CommerceProvider = {
  name: "fixtures",

  async searchProducts(input: ProductSearchInput): Promise<Product[]> {
    const q = input.query.toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    let results = FIXTURE_PRODUCTS.filter((p) => {
      const hay = `${p.title} ${p.description || ""} ${p.merchant}`.toLowerCase();
      return words.some((w) => hay.includes(w)) || !words.length;
    });
    if (input.merchant) {
      results = results.filter(
        (p) => p.merchant.toLowerCase() === input.merchant!.toLowerCase(),
      );
    }
    if (input.max_price != null) {
      results = results.filter((p) => p.price <= input.max_price!);
    }
    if (!results.length) results = FIXTURE_PRODUCTS;
    return results.slice(0, input.limit ?? 5);
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const product = FIXTURE_PRODUCTS.find((p) => p.id === input.product_id);
    if (!product) return { ok: false, error: "Product not found" };
    // Fixture path routes through Prava hosted checkout so the payment
    // model matches production (hosted page, no card data in our stack).
    try {
      const { createPravaSession } = await import(
        "@/lib/integrations/prava"
      );
      const session = await createPravaSession({
        user_id: `commerce_${Date.now()}`,
        user_email: input.user_email || "shopper@prava.app",
        merchant: product.merchant,
        amount: product.price * (input.quantity ?? 1),
        currency: product.currency,
        category: "product",
      });
      return {
        ok: !session.error,
        checkout_url: session.iframe_url || undefined,
        session_id: session.session_id || undefined,
        error: session.error || undefined,
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Checkout failed",
      };
    }
  },
};
