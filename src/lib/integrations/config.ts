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

export function integrationStatus() {
  return {
    openai: hasOpenAI() ? "live" : "mock",
    prava: hasPrava() ? "live" : "mock",
    senso: hasSenso() ? "live" : "mock",
    linq: hasLinq() ? "live" : "mock",
    whatsapp: hasWhatsApp() ? "live" : "mock",
    ticketmaster: hasTicketmaster() ? "live" : "mock",
    nanda: "registered",
  } as const;
}
