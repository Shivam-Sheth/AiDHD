/**
 * The Shopify commerce provider the registry reserved a slot for.
 *
 * Fills the `CommerceProvider` contract with the Storefront API module, so
 * anything already routing through `getCommerceProvider()` — notably
 * `search_products` in agent-tools/registry.ts, which every chat and voice
 * agent shares — searches the connected store instead of fixtures.
 *
 * `createCheckout` returns Shopify's hosted checkoutUrl and nothing more: the
 * interface's own contract is "never collects card data directly", and paying
 * that URL with a Prava one-time card is checkout/shopify-purchase.ts's job,
 * behind an approval.
 */

import type {
  CheckoutInput,
  CheckoutSession,
  CommerceProvider,
  Product,
  ProductSearchInput,
} from "./commerce";
import { createShopifyCart, searchShopifyProducts } from "@/lib/integrations/shopify";

function storeName(): string {
  return process.env.SHOPIFY_STORE_DOMAIN || "Shopify store";
}

export const shopifyCommerceProvider: CommerceProvider = {
  name: "shopify",

  async searchProducts(input: ProductSearchInput): Promise<Product[]> {
    const { offers } = await searchShopifyProducts({
      query: input.query,
      limit: input.limit ?? 5,
    });
    return offers
      .filter((o) => input.max_price == null || o.price <= input.max_price)
      .map((o) => ({
        // The variant id is what a cart line needs, so it is the id we hand
        // out — createCheckout below receives it straight back as product_id.
        id: o.variant_id,
        merchant: storeName(),
        title: o.title,
        description: o.description,
        price: o.price,
        currency: o.currency,
        image_url: o.image_url ?? undefined,
        url: o.url ?? undefined,
        in_stock: o.available,
      }));
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const cart = await createShopifyCart({
      variant_id: input.product_id,
      quantity: input.quantity ?? 1,
      email: input.user_email || "shopper@aidhd.app",
    });
    if (!cart.ok) return { ok: false, error: cart.error };
    return { ok: true, checkout_url: cart.checkout_url, session_id: cart.cart_id };
  },
};
