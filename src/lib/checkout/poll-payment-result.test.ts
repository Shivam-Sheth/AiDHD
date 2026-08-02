import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPaymentResult } from "../integrations/prava";
import { pollForCompletedPayment } from "./poll-payment-result";

vi.mock("../integrations/prava", () => ({
  getPaymentResult: vi.fn(),
}));

const mockedGetPaymentResult = vi.mocked(getPaymentResult);

beforeEach(() => {
  mockedGetPaymentResult.mockReset();
});

describe("pollForCompletedPayment", () => {
  it("returns ok once status reaches completed", async () => {
    mockedGetPaymentResult
      .mockResolvedValueOnce({ status: "processing", mode: "live" })
      .mockResolvedValueOnce({
        status: "completed",
        token: "tok_test_fixture_not_real",
        dynamic_cvv: "999",
        expiry_month: "12",
        expiry_year: "30",
        mode: "live",
      });

    const outcome = await pollForCompletedPayment("sess_test", {
      intervalMs: 1,
      timeoutMs: 1000,
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.token).toBe("tok_test_fixture_not_real");
    }
    expect(mockedGetPaymentResult).toHaveBeenCalledTimes(2);
  });

  it("times out and reports 'timeout' if status never leaves the pending set", async () => {
    mockedGetPaymentResult.mockResolvedValue({ status: "awaiting_result", mode: "live" });

    const outcome = await pollForCompletedPayment("sess_test", {
      intervalMs: 5,
      timeoutMs: 30,
    });

    expect(outcome).toEqual({
      ok: false,
      reason: "timeout",
      last_status: "awaiting_result",
    });
  });

  it("returns 'declined' immediately on a terminal non-completed status, without waiting out the timeout", async () => {
    mockedGetPaymentResult.mockResolvedValue({ status: "failed", mode: "live" });

    const start = Date.now();
    const outcome = await pollForCompletedPayment("sess_test", {
      intervalMs: 5,
      timeoutMs: 30_000,
    });
    const elapsed = Date.now() - start;

    expect(outcome).toEqual({ ok: false, reason: "declined", last_status: "failed" });
    expect(elapsed).toBeLessThan(1000);
    expect(mockedGetPaymentResult).toHaveBeenCalledTimes(1);
  });
});
