/**
 * Twilio SMS — outbound invites and notifications.
 *
 * Exists because the Meta WhatsApp integration is on a *test* number, and test
 * numbers reject any recipient not manually pre-verified in the Meta dashboard
 * (error 131030, max 5 recipients). That makes WhatsApp unusable for inviting
 * real people until a verified WhatsApp Business number is provisioned.
 *
 * Twilio has no allowlist on a full account, so this is the dependable path.
 */

const API = "https://api.twilio.com/2010-04-01";

function creds() {
  return {
    sid: process.env.TWILIO_ACCOUNT_SID || "",
    token: process.env.TWILIO_AUTH_TOKEN || "",
    from: process.env.TWILIO_FROM_NUMBER || "",
  };
}

export function hasTwilioSms(): boolean {
  const c = creds();
  return Boolean(c.sid && c.token && c.from);
}

/** Digits-only in, E.164 out. Assumes NANP when no country code is present. */
export function toE164(raw: string): string | null {
  const d = (raw || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d.length >= 8 ? d : null;
  const digits = d.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.length >= 8 ? `+${digits}` : null;
}

export type SmsResult = {
  ok: boolean;
  to: string;
  sid?: string;
  error?: string;
};

export async function sendSms(input: { to: string; body: string }): Promise<SmsResult> {
  const { sid, token, from } = creds();
  const to = toE164(input.to);

  if (!to) return { ok: false, to: input.to, error: "Not a valid phone number" };
  if (!sid || !token || !from) {
    return { ok: false, to, error: "Twilio not configured (SID/token/from)" };
  }

  const form = new URLSearchParams({ To: to, From: from, Body: input.body });

  try {
    const res = await fetch(`${API}/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const data = (await res.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
      code?: number;
    };

    if (!res.ok) {
      return {
        ok: false,
        to,
        // 21608 is the trial-account "unverified recipient" code — worth naming
        // explicitly so it isn't mistaken for the Meta allowlist problem.
        error:
          data.code === 21608
            ? "Twilio trial account can only text verified numbers. Upgrade the account."
            : data.message || `Twilio send failed (HTTP ${res.status})`,
      };
    }

    return { ok: true, to, sid: data.sid };
  } catch (e) {
    return { ok: false, to, error: e instanceof Error ? e.message : "Twilio send failed" };
  }
}

/** Fan out to several recipients; one bad number must not sink the batch. */
export async function sendSmsBatch(
  recipients: Array<{ phone: string; body: string }>,
): Promise<{ sent: number; failed: number; results: SmsResult[] }> {
  const results = await Promise.all(
    recipients.map((r) => sendSms({ to: r.phone, body: r.body })),
  );
  return {
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

/** Invite copy. Kept short — long SMS gets split and billed per segment. */
export function inviteMessage(input: {
  groupTitle: string;
  inviterName: string;
  inviteUrl: string;
}): string {
  return (
    `${input.inviterName} invited you to "${input.groupTitle}" on AiDHD. ` +
    `Join and add your budget: ${input.inviteUrl}`
  );
}
