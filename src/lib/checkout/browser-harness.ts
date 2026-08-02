/**
 * Headless-browser checkout automation for merchants with no server-to-server
 * payment API. NOT used for Duffel — Duffel is paid via its REST API directly
 * (see duffel-payment.ts), which is more reliable than driving a UI and is
 * the correct path whenever a merchant offers one.
 *
 * Requires `playwright` (not yet a dependency of this repo):
 *   npm i -D playwright && npx playwright install chromium
 *
 * Card fields are never logged and never returned in the result — only the
 * scraped confirmation text/error surfaces to callers.
 */

export type BrowserCheckoutCard = {
  number: string;
  cvc: string;
  expiry_month: string;
  expiry_year: string;
  cardholder_name: string;
};

/**
 * CSS selectors for one merchant's checkout form. There's no universal
 * checkout DOM — callers must supply the right selectors per merchant
 * (e.g. from a `merchant -> selector map` config), since this module makes
 * no attempt to auto-detect payment fields.
 */
export type BrowserCheckoutSelectors = {
  card_number: string;
  /** Combined MM/YY field. If the merchant splits month/year, extend this. */
  expiry: string;
  cvc: string;
  cardholder_name?: string;
  submit: string;
  /** Element whose presence (and text) proves the charge went through. */
  confirmation: string;
};

export type BrowserCheckoutInput = {
  checkout_url: string;
  card: BrowserCheckoutCard;
  selectors: BrowserCheckoutSelectors;
  timeout_ms?: number;
};

export type BrowserCheckoutResult =
  | { ok: true; confirmation_text: string }
  | { ok: false; failure_reason: string };

export async function runBrowserCheckout(
  input: BrowserCheckoutInput,
): Promise<BrowserCheckoutResult> {
  const { chromium } = await import("playwright");
  const timeout = input.timeout_ms ?? 30_000;
  const browser = await chromium.launch({ headless: true });
  try {
    // Fresh context per session — nothing persists between checkouts.
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);

    await page.goto(input.checkout_url, { waitUntil: "domcontentloaded" });
    await page.fill(input.selectors.card_number, input.card.number);
    await page.fill(
      input.selectors.expiry,
      `${input.card.expiry_month}/${input.card.expiry_year.slice(-2)}`,
    );
    await page.fill(input.selectors.cvc, input.card.cvc);
    if (input.selectors.cardholder_name) {
      await page.fill(input.selectors.cardholder_name, input.card.cardholder_name);
    }
    await page.click(input.selectors.submit);
    await page.waitForSelector(input.selectors.confirmation, { timeout });
    const confirmation_text =
      (await page.textContent(input.selectors.confirmation)) || "";
    return { ok: true, confirmation_text };
  } catch (e) {
    return {
      ok: false,
      failure_reason: e instanceof Error ? e.message : "Checkout automation failed",
    };
  } finally {
    await browser.close();
  }
}
