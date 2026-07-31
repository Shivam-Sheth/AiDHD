/**
 * Parse freeform date ranges like "Sep 20-25", "Aug 10–15", "2026-08-10".
 * Defaults year to 2026 when omitted. Always resolves something when days known.
 */

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addDays(isoDate: string, n: number): string {
  const dt = new Date(`${isoDate}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseTripDates(input: {
  selected_date?: string;
  date_range?: string;
  days?: number | null;
}): { check_in: string; check_out: string } | null {
  if (input.selected_date && /^\d{4}-\d{2}-\d{2}$/.test(input.selected_date)) {
    const nights = Math.max(1, (input.days || 3) - 1);
    return {
      check_in: input.selected_date,
      check_out: addDays(input.selected_date, nights),
    };
  }

  // Normalize fancy dashes / "to"
  const raw = (input.date_range || "")
    .trim()
    .replace(/[–—−]/g, "-")
    .replace(/\s+to\s+/gi, "-")
    .replace(/\s+/g, " ");
  if (!raw) return null;

  const isoPair = raw.match(
    /(20\d{2}-\d{2}-\d{2})\s*-\s*(20\d{2}-\d{2}-\d{2})/i,
  );
  if (isoPair) {
    return { check_in: isoPair[1]!, check_out: isoPair[2]! };
  }

  const singleIso = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (singleIso) {
    const nights = Math.max(1, (input.days || 3) - 1);
    return {
      check_in: singleIso[1]!,
      check_out: addDays(singleIso[1]!, nights),
    };
  }

  const monthNames =
    "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

  // "Sep 20-25" / "Sep 20 - Sep 25" / "Sep 20, 2026"
  const m1 = raw.match(
    new RegExp(
      `\\b(${monthNames})\\.?\\s+(\\d{1,2})(?:\\s*-\\s*(?:(${monthNames})\\.?\\s*)?(\\d{1,2}))?(?:,?\\s*(20\\d{2}))?`,
      "i",
    ),
  );
  if (m1) {
    const month = MONTHS[m1[1]!.toLowerCase().replace(/\.$/, "")];
    const d1 = Number(m1[2]);
    const d2 = m1[4]
      ? Number(m1[4])
      : d1 + Math.max(1, (input.days || 3) - 1);
    const year = m1[5] ? Number(m1[5]) : 2026;
    if (month && d1 >= 1 && d1 <= 31) {
      return {
        check_in: iso(year, month, d1),
        check_out: iso(year, month, Math.min(31, Math.max(d1 + 1, d2))),
      };
    }
  }

  // "20-25 Sep"
  const m2 = raw.match(
    new RegExp(
      `\\b(\\d{1,2})\\s*-\\s*(\\d{1,2})\\s+(${monthNames})(?:\\.?\\s*,?\\s*(20\\d{2}))?`,
      "i",
    ),
  );
  if (m2) {
    const month = MONTHS[m2[3]!.toLowerCase().replace(/\.$/, "")];
    const year = m2[4] ? Number(m2[4]) : 2026;
    if (month) {
      return {
        check_in: iso(year, month, Number(m2[1])),
        check_out: iso(year, month, Number(m2[2])),
      };
    }
  }

  // Bare "20-25" — assume next upcoming month stretch is wrong; use days from today+21
  const bare = raw.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  if (bare) {
    const start = addDays(todayIso(), 21);
    const y = Number(start.slice(0, 4));
    const m = Number(start.slice(5, 7));
    return {
      check_in: iso(y, m, Number(bare[1])),
      check_out: iso(y, m, Number(bare[2])),
    };
  }

  return null;
}

/** Never return null for a trip finalize — fall back to ~3 weeks out. */
export function resolveTripDates(input: {
  selected_date?: string;
  date_range?: string;
  days?: number | null;
}): { check_in: string; check_out: string; inferred: boolean } {
  const parsed = parseTripDates(input);
  if (parsed) return { ...parsed, inferred: false };
  const nights = Math.max(2, (input.days || 5) - 1);
  const check_in = addDays(todayIso(), 21);
  return {
    check_in,
    check_out: addDays(check_in, nights),
    inferred: true,
  };
}
