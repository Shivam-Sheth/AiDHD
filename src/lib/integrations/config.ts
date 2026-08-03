export function hasGemini() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function hasOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function hasPrava() {
  return Boolean(process.env.PRAVA_SECRET_KEY || process.env.PRAVA_API_KEY);
}

export function hasSenso() {
  return Boolean(process.env.SENSO_API_KEY);
}

export function hasLinq() {
  // API key alone enables Linq mode; sends need LINQ_PHONE_NUMBER too
  return Boolean(process.env.LINQ_API_KEY);
}

export function hasWhatsApp() {
  return Boolean(
    process.env.META_WHATSAPP_TOKEN && process.env.META_WHATSAPP_PHONE_NUMBER_ID,
  );
}

export function hasTicketmaster() {
  return Boolean(process.env.TICKETMASTER_API_KEY);
}

export function hasDuffel() {
  return Boolean(process.env.DUFFEL_API_KEY);
}

/** Storefront API — product search + cart creation (checkoutUrl for the browser-harness leg). */
export function hasShopify() {
  return Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN);
}

/** Hosted remote browser for checkout/browser-harness.ts — preferred over @sparticuz/chromium when set. */
export function hasBrowserbase() {
  return Boolean(process.env.BROWSERBASE_API_KEY);
}

/** @deprecated Amadeus self-service portal shut down — use Duffel Stays. */
export function hasAmadeus() {
  return false;
}

export function hasElevenLabs() {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

/** ElevenAgents outbound (phone number imported into Eleven — may still use Twilio under the hood). */
export function hasElevenAgentsOutbound() {
  return Boolean(
    process.env.ELEVENLABS_API_KEY &&
      process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID &&
      (process.env.ELEVENLABS_AGENT_ID ||
        process.env.ELEVENLABS_RESEARCH_AGENT_ID ||
        process.env.ELEVENLABS_HOTEL_AGENT_ID),
  );
}

export function hasTwilio() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
}

export function hasGoogleMaps() {
  return Boolean(process.env.GOOGLE_MAPS_API);
}

export function integrationStatus() {
  const llm = hasGemini() ? "gemini" : hasOpenAI() ? "openai" : "mock";
  return {
    llm,
    gemini: hasGemini() ? "live" : "mock",
    openai: hasOpenAI() ? "live" : "standby",
    prava: hasPrava() ? "live" : "mock",
    senso: hasSenso() ? "live" : "mock",
    linq: hasLinq() ? "live" : "mock",
    whatsapp: hasWhatsApp() ? "live" : "mock",
    ticketmaster: hasTicketmaster() ? "live" : "mock",
    duffel: hasDuffel() ? "live" : "fixture",
    duffel_stays: hasDuffel() ? "live" : "fixture",
    shopify: hasShopify() ? "live" : "fixture",
    browserbase: hasBrowserbase() ? "live" : "standby",
    elevenlabs: hasElevenLabs() ? "live" : "mock",
    eleven_agents: hasElevenAgentsOutbound() ? "live" : "standby",
    twilio: hasTwilio() ? "live" : "mock",
    google_maps: hasGoogleMaps() ? "live" : "standby",
    agents: "subnet",
    nanda: "registered",
  } as const;
}
