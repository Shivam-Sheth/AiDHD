/**
 * Headless-browser checkout automation for merchants with no server-to-server
 * payment API. NOT used for Duffel — Duffel is paid via its REST API directly,
 * which is more reliable than driving a UI and is the correct path whenever a
 * merchant offers one. Shopify is the merchant this module targets today —
 * see runShopifyCheckout below.
 *
 * This is genuinely what Prava's own "Browser Harness" concept means, per
 * their prava-pay agent skill: "use returned credentials immediately at the
 * merchant's site via browser automation." There is no Prava-hosted service
 * that does this on our behalf reachable from a plain secret-key REST
 * backend — that phrase describes a pattern the calling application (this
 * one) has to implement, not an API endpoint. docs.prava.space's REST
 * reference (openapi.json) only exposes session / payment-result /
 * report-status / mandate endpoints; nothing for product discovery, quoting,
 * or checkout execution.
 *
 * Browser transport, in priority order:
 *   1. Browserbase (BROWSERBASE_API_KEY set) — a hosted remote browser Playwright
 *      connects to over CDP. No binary in our function bundle, no cold-start
 *      Chromium download, no Vercel Hobby duration pressure from launching a
 *      browser — just an HTTPS session-create call + a CDP connection. This is
 *      the preferred path whenever the key is present.
 *   2. `@sparticuz/chromium` + `playwright-core` (Vercel/Lambda, no Browserbase
 *      key) — a serverless-packaged Chromium binary, launched in-process.
 *   3. The `playwright` devDependency's own bundled Chromium — local dev only
 *      (`npx playwright install chromium` once).
 *
 * Card fields are never logged and never returned in the result — only the
 * scraped confirmation text/error surfaces to callers.
 */

import { logInfo } from "./debug-log";

async function launchChromium(): Promise<import("playwright-core").Browser> {
  if (process.env.BROWSERBASE_API_KEY) {
    const [{ default: Browserbase }, { chromium }] = await Promise.all([
      import("@browserbasehq/sdk"),
      import("playwright-core"),
    ]);
    const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
    // projectId is optional — Browserbase infers it from the API key when omitted.
    const session = await bb.sessions.create({
      ...(process.env.BROWSERBASE_PROJECT_ID ? { projectId: process.env.BROWSERBASE_PROJECT_ID } : {}),
    });
    logInfo("browser-harness", "connecting to Browserbase session", { session_id: session.id });
    return chromium.connectOverCDP(session.connectUrl);
  }
  // Vercel (and most other serverless hosts) set one of these; a plain `next
  // dev`/`next start` won't, so this stays on the full `playwright` package
  // locally where `npx playwright install chromium` already provisioned a
  // real browser binary.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const [{ default: chromiumBinary }, { chromium }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("playwright-core"),
    ]);
    return chromium.launch({
      args: chromiumBinary.args,
      executablePath: await chromiumBinary.executablePath(),
      headless: true,
    });
  }
  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true });
}

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
  const timeout = input.timeout_ms ?? 30_000;
  const browser = await launchChromium();
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

export type ShopifyCheckoutCard = {
  /** Prava's one-time virtual card number (payment-result's `token`). */
  number: string;
  /** Prava's one-time CVV (payment-result's `dynamic_cvv`). */
  cvc: string;
  expiry_month: string;
  expiry_year: string;
  cardholder_name: string;
};

export type ShopifyCheckoutInput = {
  /** Hosted checkoutUrl from Storefront API's cartCreate — see integrations/shopify.ts. */
  checkout_url: string;
  email: string;
  card: ShopifyCheckoutCard;
  timeout_ms?: number;
};

export type ShopifyCheckoutResult =
  | { ok: true; confirmation_text: string; final_url: string }
  | { ok: false; failure_reason: string };

/**
 * Drives Shopify's hosted checkout page directly (no merchant-side API
 * integration exists to call instead — see the module header comment).
 *
 * RISK NOTE: the selectors below target Shopify's current (2026) checkout
 * markup — email input, a same-page "Pay now" step for digital/no-shipping
 * products, and a same-origin-sandboxed payment iframe titled roughly
 * "Secure card payment input frame" containing the card fields. Shopify
 * changes this markup periodically and it can vary by store theme/locale.
 * BEFORE spending a real Prava transaction attempt on this: run it once
 * against your store's real checkout with a card you don't mind putting in
 * manually (e.g. temporarily call this function with a personal test card,
 * *not* a Prava one-time card) and watch the /debug log stream to confirm
 * every step matches — a wrong selector fails fast and cheaply if it fails
 * during that dry run, and expensively if it fails against a live Prava
 * session with only a few sandbox attempts left.
 */
export async function runShopifyCheckout(
  input: ShopifyCheckoutInput,
): Promise<ShopifyCheckoutResult> {
  const timeout = input.timeout_ms ?? 45_000;
  logInfo("shopify checkout", "launching browser", { checkout_url: input.checkout_url });
  const browser = await launchChromium();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);

    await page.goto(input.checkout_url, { waitUntil: "domcontentloaded" });
    logInfo("shopify checkout", "checkout page loaded");

    const emailField = page
      .locator('input[type="email"], input[name="email"], #email')
      .first();
    await emailField.waitFor({ state: "visible", timeout });
    await emailField.fill(input.email);
    logInfo("shopify checkout", "filled contact email");

    // Digital/no-shipping-required products skip straight from contact to
    // payment — no shipping-address or delivery-method step to automate.
    const continueButton = page
      .getByRole("button", { name: /continue to payment|continue|next/i })
      .first();
    if (await continueButton.count()) {
      await continueButton.click();
      logInfo("shopify checkout", "advanced past contact step");
    }

    // Card fields live inside a payment iframe for PCI compliance — cannot
    // be filled via page.fill() directly, hence frameLocator.
    const cardFrame = page
      .frameLocator('iframe[title*="card" i], iframe[title*="payment" i]')
      .first();

    // --- CREDENTIAL-HANDLING BOUNDARY ---
    // input.card fields below are the one-time PAN/CVV. Do not add any
    // console.*/logInfo/logRequest call inside this block that includes
    // `input.card` or any locator's resolved value — only step names.
    await cardFrame
      .locator('input[name="number"], input[placeholder*="Card number" i]')
      .fill(input.card.number);
    await cardFrame
      .locator('input[name="expiry"], input[placeholder*="Expiration" i]')
      .fill(`${input.card.expiry_month}/${input.card.expiry_year.slice(-2)}`);
    await cardFrame
      .locator('input[name="verification_value"], input[placeholder*="Security code" i], input[placeholder*="CVV" i]')
      .fill(input.card.cvc);
    const nameField = cardFrame.locator(
      'input[name="name"], input[placeholder*="Name on card" i]',
    );
    if (await nameField.count()) {
      await nameField.fill(input.card.cardholder_name);
    }
    // --- END CREDENTIAL-HANDLING BOUNDARY ---
    logInfo("shopify checkout", "filled payment fields (redacted)");

    const payButton = page.getByRole("button", { name: /pay now|complete order/i }).first();
    await payButton.click();
    logInfo("shopify checkout", "submitted payment, waiting for confirmation");

    await page.waitForURL(/\/(thank[_-]?you|orders)\//i, { timeout });
    const confirmation_text = (await page.locator("body").innerText()).slice(0, 1000);
    logInfo("shopify checkout", "order confirmed", { final_url: page.url() });
    return { ok: true, confirmation_text, final_url: page.url() };
  } catch (e) {
    const failure_reason = e instanceof Error ? e.message : "Shopify checkout automation failed";
    logInfo("shopify checkout", "failed", { failure_reason });
    return { ok: false, failure_reason };
  } finally {
    await browser.close();
  }
}
