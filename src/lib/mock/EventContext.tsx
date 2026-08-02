"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { v4 as uuidv4 } from "uuid";
import type { Booking, ChatMessage, EventType, MockEvent, MockInvitee } from "./types";
import type { Persona } from "./personas";
import { generatePackages } from "./packagesFixtures";
import { slugify, uniqueSlug } from "./slugify";
import { CHAT_SCRIPT, deriveTag, extractBudget } from "./chatScript";

const STORAGE_KEY = "aidhd:mock-events:v1";

function greeting(name: string, event: Pick<MockEvent, "title" | "type">): string {
  const label = event.type === "trip" ? "trip" : "night";
  return `Hey ${name} — what's your budget for ${event.title ? `"${event.title}"` : `the ${label}`}?`;
}

function recompute(event: MockEvent): MockEvent {
  return { ...event, packages: generatePackages(event) };
}

function generateCode(vendor: string): string {
  const prefix =
    vendor
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 3) || "CONF";
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${suffix}`;
}

interface CreateEventInput {
  type: EventType;
  title: string;
  destination_or_venue: string;
  proposed_dates: string[];
  invitees: Persona[];
  organizer: Persona;
}

interface EventContextValue {
  hydrated: boolean;
  getEvent: (slug: string) => MockEvent | undefined;
  createEvent: (input: CreateEventInput) => string;
  sendMessage: (slug: string, inviteeId: string, text: string) => void;
  nudgeInvitee: (slug: string, inviteeId: string) => void;
  setLastViewedPackage: (slug: string, packageId: string) => void;
  bookPackage: (slug: string, packageId: string) => void;
}

const EventContext = createContext<EventContextValue | null>(null);

export function EventProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Record<string, MockEvent>>({});
  const [hydrated, setHydrated] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // One-time client-only read on mount. A lazy useState initializer would run during SSR
    // (no localStorage) and again on client hydration (localStorage present), diverging the
    // two renders and triggering a hydration mismatch — this effect + the `hydrated` flag is
    // what keeps server and first-client-render output identical.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setEvents(JSON.parse(raw));
    } catch {
      // corrupt storage — start fresh rather than crash
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }, [events, hydrated]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const getEvent = useCallback((slug: string) => events[slug], [events]);

  const createEvent = useCallback((input: CreateEventInput): string => {
    let slug = "";
    setEvents((prev) => {
      slug = uniqueSlug(slugify(input.title), prev);
      const now = new Date().toISOString();
      const roster: MockInvitee[] = [input.organizer, ...input.invitees].map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        channel: p.channel,
        colorKey: p.colorKey,
        status: "not_yet",
        agentTyping: false,
        scriptStep: 1,
        messages: [
          {
            id: uuidv4(),
            role: "assistant",
            content: greeting(p.name, { title: input.title, type: input.type }),
            ts: now,
          } satisfies ChatMessage,
        ],
      }));

      const event: MockEvent = {
        slug,
        type: input.type,
        title: input.title,
        destination_or_venue: input.destination_or_venue,
        proposed_dates: input.proposed_dates,
        organizer_id: input.organizer.id,
        invitees: roster,
        status: "collecting",
        packages: [],
        bookings: [],
        created_at: now,
      };
      return { ...prev, [slug]: event };
    });
    return slug;
  }, []);

  const sendMessage = useCallback((slug: string, inviteeId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setEvents((prev) => {
      const event = prev[slug];
      if (!event) return prev;
      const invitees = event.invitees.map((inv): MockInvitee => {
        if (inv.id !== inviteeId) return inv;
        const userMsg: ChatMessage = {
          id: uuidv4(),
          role: "user",
          content: trimmed,
          ts: new Date().toISOString(),
        };
        const answeredIndex = inv.scriptStep - 1;
        let budget_cap = inv.budget_cap;
        let preferences = inv.preferences;
        let status = inv.status;
        let responded_at = inv.responded_at;

        if (answeredIndex === 0) {
          const amount = extractBudget(trimmed);
          if (amount) budget_cap = amount;
        } else if (answeredIndex === 1) {
          preferences = { free_text: trimmed, structured_tags: [deriveTag(trimmed)] };
          status = "responded";
          responded_at = new Date().toISOString();
        }

        return {
          ...inv,
          messages: [...inv.messages, userMsg],
          budget_cap,
          preferences,
          status,
          responded_at,
          agentTyping: true,
        };
      });
      return { ...prev, [slug]: recompute({ ...event, invitees }) };
    });

    const timer = setTimeout(() => {
      setEvents((prev) => {
        const event = prev[slug];
        if (!event) return prev;
        const invitees = event.invitees.map((inv): MockInvitee => {
          if (inv.id !== inviteeId) return inv;
          const replyText =
            inv.scriptStep < CHAT_SCRIPT.length
              ? CHAT_SCRIPT[inv.scriptStep]
              : "Got it, thanks!";
          const assistantMsg: ChatMessage = {
            id: uuidv4(),
            role: "assistant",
            content: replyText,
            ts: new Date().toISOString(),
          };
          const scriptStep = Math.min(inv.scriptStep + 1, CHAT_SCRIPT.length);
          return {
            ...inv,
            messages: [...inv.messages, assistantMsg],
            scriptStep,
            agentTyping: false,
          };
        });
        return { ...prev, [slug]: recompute({ ...event, invitees }) };
      });
    }, 900);
    timers.current.push(timer);
  }, []);

  // Mock/no-op — a real backend swap would re-send the channel invite here. Params kept to
  // match the eventual real signature.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const nudgeInvitee = useCallback((_slug: string, _inviteeId: string) => {}, []);

  const setLastViewedPackage = useCallback((slug: string, packageId: string) => {
    setEvents((prev) => {
      const event = prev[slug];
      if (!event) return prev;
      return { ...prev, [slug]: { ...event, lastViewedPackageId: packageId } };
    });
  }, []);

  const bookPackage = useCallback((slug: string, packageId: string) => {
    setEvents((prev) => {
      const event = prev[slug];
      if (!event) return prev;
      const pkg = event.packages.find((p) => p.id === packageId);
      if (!pkg) return prev;

      const billableTypes = new Set(["flight", "hotel", "ticket", "dining"]);
      const now = new Date().toISOString();
      const bookings: Booking[] = pkg.components
        .filter((c) => billableTypes.has(c.type))
        .map((c) => ({
          id: uuidv4(),
          event_id: slug,
          mandate_id: `mandate_${c.type}_${slug}`,
          category: c.type as Booking["category"],
          provider: c.vendor,
          confirmation_id: generateCode(c.vendor),
          status: "confirmed",
          created_at: now,
        }));

      return {
        ...prev,
        [slug]: {
          ...event,
          selected_package_id: packageId,
          status: "confirmed",
          bookings,
        },
      };
    });
  }, []);

  return (
    <EventContext.Provider
      value={{
        hydrated,
        getEvent,
        createEvent,
        sendMessage,
        nudgeInvitee,
        setLastViewedPackage,
        bookPackage,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEvents(): EventContextValue {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error("useEvents must be used within EventProvider");
  return ctx;
}
