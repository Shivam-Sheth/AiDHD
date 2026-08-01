export function WhatsAppSandboxPanel({
  busy,
  waPhones,
  setWaPhones,
  waReplyPhone,
  setWaReplyPhone,
  waReplyMsg,
  setWaReplyMsg,
  waNote,
  onInvite,
  onSimulateReply,
  onResearchCall,
}: {
  busy: boolean;
  waPhones: string;
  setWaPhones: (v: string) => void;
  waReplyPhone: string;
  setWaReplyPhone: (v: string) => void;
  waReplyMsg: string;
  setWaReplyMsg: (v: string) => void;
  waNote: string | null;
  onInvite: () => void;
  onSimulateReply: () => void;
  onResearchCall: () => void;
}) {
  return (
    <details className="mt-8 rounded-2xl border border-line bg-paper px-5 py-4 open:pb-5">
      <summary className="cursor-pointer text-xs font-semibold tracking-wider text-faint uppercase">
        Advanced: WhatsApp + voice research
      </summary>

      <div className="mt-4">
        <p className="text-xs font-medium tracking-wider text-faint uppercase">WhatsApp sandbox</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>
            Meta → app <strong>AiDHD</strong> → left sidebar <strong>Use cases</strong> (not a menu named
            &ldquo;WhatsApp&rdquo;)
          </li>
          <li>
            Open <strong>Connect with customers through WhatsApp</strong> → <strong>Step 1. Try it out</strong>
          </li>
          <li>
            On <strong>Send a message from your test number</strong>, open the <strong>Recipient</strong>{" "}
            dropdown → <strong>Manage phone number list</strong> / <strong>Add phone number</strong>
          </li>
          <li>Enter friend&apos;s number with country code → they get a WhatsApp code → they accept</li>
          <li>
            Paste those numbers below → Text friends → they reply from <strong>+1 (555) 158-1137</strong>
          </li>
        </ol>
        <textarea
          value={waPhones}
          onChange={(e) => setWaPhones(e.target.value)}
          placeholder="+15551234567, +15559876543"
          rows={2}
          className="mt-4 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-coral-dark"
        />
        <button
          type="button"
          disabled={busy}
          onClick={onInvite}
          className="mt-3 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Sending…" : "Text friends to collect prefs"}
        </button>

        <div className="mt-5 border-t border-line pt-4">
          <p className="text-xs font-medium tracking-wider text-faint uppercase">Dual-agent research call</p>
          <p className="mt-1 text-sm text-muted">
            Concierge stays with you; research agent calls the venue (height limits, hotel policy…). Uses
            ElevenAgents templates when keyed — otherwise simulates.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={onResearchCall}
            className="mt-3 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
          >
            Demo: call venue about height limit
          </button>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <p className="text-xs font-medium tracking-wider text-faint uppercase">
            If WhatsApp stays silent — reply here
          </p>
          <p className="mt-1 text-sm text-muted">
            Meta webhook tunnels go stale. This sends the bot reply to your phone without waiting on Meta.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={waReplyPhone}
              onChange={(e) => setWaReplyPhone(e.target.value)}
              placeholder="+17735411355"
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-coral-dark sm:w-44"
            />
            <input
              value={waReplyMsg}
              onChange={(e) => setWaReplyMsg(e.target.value)}
              placeholder="PLAN"
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-coral-dark"
            />
            <button
              type="button"
              disabled={busy}
              onClick={onSimulateReply}
              className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
            >
              Send as WhatsApp reply
            </button>
          </div>
        </div>

        {waNote && <p className="mt-3 text-sm text-muted">{waNote}</p>}
      </div>
    </details>
  );
}
