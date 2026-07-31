/**
 * Airline IATA → logo URL helpers for aesthetic flight cards.
 */

const NAME_TO_IATA: Array<{ re: RegExp; iata: string }> = [
  { re: /\bunited\b/i, iata: "UA" },
  { re: /\bamerican\b/i, iata: "AA" },
  { re: /\bdelta\b/i, iata: "DL" },
  { re: /\bjetblue\b/i, iata: "B6" },
  { re: /\bsouthwest\b/i, iata: "WN" },
  { re: /\balaska\b/i, iata: "AS" },
  { re: /\bspirit\b/i, iata: "NK" },
  { re: /\bfrontier\b/i, iata: "F9" },
  { re: /\bbritish\b/i, iata: "BA" },
  { re: /\biberia\b/i, iata: "IB" },
  { re: /\blufthansa\b/i, iata: "LH" },
  { re: /\bair\s*france\b/i, iata: "AF" },
  { re: /\bklm\b/i, iata: "KL" },
  { re: /\bemirates\b/i, iata: "EK" },
  { re: /\bqatar\b/i, iata: "QR" },
  { re: /\bsingapore\b/i, iata: "SQ" },
  { re: /\bcathay\b/i, iata: "CX" },
  { re: /\bjapan\s*airlines?\b|\bjal\b/i, iata: "JL" },
  { re: /\bana\b|all\s*nippon/i, iata: "NH" },
  { re: /\bscoot\b/i, iata: "TR" },
  { re: /\bcathay\b/i, iata: "CX" },
  { re: /\bethihad\b/i, iata: "EY" },
  { re: /\bturkish\b/i, iata: "TK" },
  { re: /\bindiGo\b|indigo/i, iata: "6E" },
  { re: /\bair\s*india\b/i, iata: "AI" },
  { re: /\bgaruda\b/i, iata: "GA" },
  { re: /\bbatik\b/i, iata: "ID" },
  { re: /\bcitilink\b/i, iata: "QG" },
  { re: /\bvirgin\b/i, iata: "VS" },
  { re: /\bqatar\b/i, iata: "QR" },
  { re: /\bduffel\b/i, iata: "UA" },
];

export function airlineIataFromName(name: string): string | null {
  const raw = name.trim();
  if (/^[A-Z0-9]{2}$/i.test(raw)) return raw.toUpperCase();
  for (const row of NAME_TO_IATA) {
    if (row.re.test(raw)) return row.iata;
  }
  return null;
}

/** Kiwi CDN airline logos — works well in cards. */
export function airlineLogoUrl(iata: string | null | undefined): string | null {
  if (!iata || !/^[A-Z0-9]{2}$/i.test(iata)) return null;
  return `https://images.kiwi.com/airlines/64/${iata.toUpperCase()}.png`;
}
