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

export function hasAmadeus() {
  return Boolean(
    process.env.AMADEUS_API_KEY && process.env.AMADEUS_API_SECRET,
  );
}

export function hasElevenLabs() {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export function hasTwilio() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
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
    amadeus: hasAmadeus() ? "standby" : "fixture",
    elevenlabs: hasElevenLabs() ? "live" : "mock",
    twilio: hasTwilio() ? "live" : "mock",
    agents: "subnet",
    nanda: "registered",
  } as const;
}
