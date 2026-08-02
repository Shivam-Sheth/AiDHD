import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportPaymentStatus } from "@/lib/integrations/prava";
import { pollForCompletedPayment } from "@/lib/checkout/poll-payment-result";
import { payDuffelFlightOrder } from "@/lib/checkout/duffel-payment";
import { POST } from "./route";

vi.mock("@/lib/integrations/prava", () => ({
  reportPaymentStatus: vi.fn(),
}));
vi.mock("@/lib/checkout/poll-payment-result", () => ({
  pollForCompletedPayment: vi.fn(),
}));
vi.mock("@/lib/checkout/duffel-payment", () => ({
  payDuffelFlightOrder: vi.fn(),
}));

const mockedPoll = vi.mocked(pollForCompletedPayment);
const mockedPay = vi.mocked(payDuffelFlightOrder);
const mockedReport = vi.mocked(reportPaymentStatus);

// Never real credentials — used only to prove they never appear in a response.
const FIXTURE_TOKEN = "tok_test_fixture_should_never_leak";
const FIXTURE_CVV = "911";

const BASE_BODY = {
  session_id: "sess_test",
  merchant: "Test Airline",
  amount: 250,
  currency: "USD",
  offer_id: "off_test",
  passengers: [
    {
      id: "pas_test",
      given_name: "Ada",
      family_name: "Lovelace",
      email: "ada@example.com",
      phone_number: "+15555550100",
      born_on: "1990-01-01",
      gender: "f" as const,
      title: "ms" as const,
    },
  ],
};

function postRequest(body: unknown) {
  return new Request("http://localhost/api/checkout/execute", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockedPoll.mockReset();
  mockedPay.mockReset();
  mockedReport.mockReset();
  mockedReport.mockResolvedValue({ ok: true });
});

describe("POST /api/checkout/execute", () => {
  it("400s on missing required fields without touching Prava or Duffel", async () => {
    const res = await POST(postRequest({ session_id: "sess_test" }));
    expect(res.status).toBe(400);
    expect(mockedPoll).not.toHaveBeenCalled();
    expect(mockedPay).not.toHaveBeenCalled();
    expect(mockedReport).not.toHaveBeenCalled();
  });

  it("on poll timeout: reports DECLINED, never calls Duffel, and returns 402", async () => {
    mockedPoll.mockResolvedValue({ ok: false, reason: "timeout", last_status: "awaiting_result" });

    const res = await POST(postRequest(BASE_BODY));
    const json = await res.json();

    expect(res.status).toBe(402);
    expect(json.ok).toBe(false);
    expect(mockedPay).not.toHaveBeenCalled();
    expect(mockedReport).toHaveBeenCalledTimes(1);
    expect(mockedReport).toHaveBeenCalledWith("sess_test", "DECLINED");
  });

  it("on successful checkout: reports APPROVED and never echoes the card token/CVV", async () => {
    mockedPoll.mockResolvedValue({
      ok: true,
      result: {
        status: "completed",
        token: FIXTURE_TOKEN,
        dynamic_cvv: FIXTURE_CVV,
        expiry_month: "12",
        expiry_year: "30",
        mode: "live",
      },
    });
    mockedPay.mockResolvedValue({ ok: true, order_id: "ord_123", booking_reference: "ABCDEF" });

    const res = await POST(postRequest(BASE_BODY));
    const rawBody = await res.text();
    const json = JSON.parse(rawBody);

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.order_id).toBe("ord_123");
    expect(json.confirmation_id).toBe("ABCDEF");
    expect(json.ui).toEqual({
      kind: "receipt",
      payload: expect.objectContaining({
        confirmation_id: "ABCDEF",
        session_id: "sess_test",
        token_ref: "•••• leak",
        duffel_order_id: "ord_123",
      }),
    });
    expect(rawBody).not.toContain(FIXTURE_TOKEN);
    expect(rawBody).not.toContain(FIXTURE_CVV);
    expect(mockedReport).toHaveBeenCalledWith("sess_test", "APPROVED");

    // Card fields passed to Duffel exactly once, sourced only from the poll result.
    expect(mockedPay).toHaveBeenCalledTimes(1);
    expect(mockedPay.mock.calls[0][0].card).toEqual({
      number: FIXTURE_TOKEN,
      cvc: FIXTURE_CVV,
      expiry_month: "12",
      expiry_year: "30",
      cardholder_name: "Ada Lovelace",
    });
  });

  it("still reports DECLINED (finally) when the Duffel checkout call throws, and leaks no credentials", async () => {
    mockedPoll.mockResolvedValue({
      ok: true,
      result: {
        status: "completed",
        token: FIXTURE_TOKEN,
        dynamic_cvv: FIXTURE_CVV,
        expiry_month: "12",
        expiry_year: "30",
        mode: "live",
      },
    });
    mockedPay.mockRejectedValue(new Error("network blip"));

    const res = await POST(postRequest(BASE_BODY));
    const rawBody = await res.text();
    const json = JSON.parse(rawBody);

    expect(res.status).toBe(402);
    expect(json.ok).toBe(false);
    expect(json.error_code).toBe("checkout_exception");
    expect(rawBody).not.toContain(FIXTURE_TOKEN);
    expect(rawBody).not.toContain(FIXTURE_CVV);

    // The finally block must still run and report the real outcome.
    expect(mockedReport).toHaveBeenCalledTimes(1);
    expect(mockedReport).toHaveBeenCalledWith("sess_test", "DECLINED");
  });
});
