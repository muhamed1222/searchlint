import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  StripeWebhookError,
  mapStripeSubscriptionStatus,
  parseStripeWebhookEvent,
  verifyStripeWebhookSignature
} from "../src/index.js";

const secret = "whsec_test_searchlint";
const timestamp = 1_783_000_000;
const now = () => new Date(timestamp * 1000);

describe("Stripe webhook boundary", () => {
  it("verifies a valid Stripe-Signature header over the raw payload", () => {
    const payload = JSON.stringify(subscriptionEvent());
    const signatureHeader = stripeSignatureHeader(payload);

    expect(
      verifyStripeWebhookSignature(
        { payload, signatureHeader },
        { secret, now }
      )
    ).toMatchObject({
      timestamp
    });
  });

  it("accepts one valid v1 signature when multiple signatures are present", () => {
    const payload = JSON.stringify(subscriptionEvent());
    const validSignature = stripeSignature(payload);
    const signatureHeader = `t=${timestamp},v1=bad,v1=${validSignature}`;

    const event = parseStripeWebhookEvent(
      { payload, signatureHeader },
      { secret, now }
    );

    expect(event.idempotencyKey).toBe("evt_subscription_updated");
  });

  it("normalizes subscription events into entitlement update intents", () => {
    const payload = JSON.stringify(subscriptionEvent());
    const event = parseStripeWebhookEvent(
      { payload, signatureHeader: stripeSignatureHeader(payload) },
      { secret, now }
    );

    expect(event).toMatchObject({
      id: "evt_subscription_updated",
      type: "customer.subscription.updated",
      created: timestamp,
      receivedAt: now().toISOString(),
      idempotencyKey: "evt_subscription_updated",
      intent: {
        kind: "subscription-entitlement-update",
        stripeEventId: "evt_subscription_updated",
        stripeEventType: "customer.subscription.updated",
        stripeSubscriptionId: "sub_123",
        stripeCustomerId: "cus_123",
        stripePriceLookupKey: "searchlint_team_monthly",
        entitlementStatus: "active",
        currentPeriodStart: "2026-06-01T00:00:00.000Z",
        currentPeriodEnd: "2026-07-01T00:00:00.000Z",
        source: "stripe",
        idempotencyKey: "evt_subscription_updated"
      }
    });
  });

  it("normalizes invoice payment events into payment signal intents", () => {
    const payload = JSON.stringify({
      id: "evt_invoice_failed",
      type: "invoice.payment_failed",
      created: timestamp,
      data: {
        object: {
          id: "in_123",
          customer: { id: "cus_123" },
          subscription: "sub_123"
        }
      }
    });

    const event = parseStripeWebhookEvent(
      { payload, signatureHeader: stripeSignatureHeader(payload) },
      { secret, now }
    );

    expect(event.intent).toEqual({
      kind: "payment-signal",
      stripeEventId: "evt_invoice_failed",
      stripeEventType: "invoice.payment_failed",
      stripeInvoiceId: "in_123",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      signal: "invoice-payment-failed",
      occurredAt: now().toISOString(),
      source: "stripe",
      idempotencyKey: "evt_invoice_failed"
    });
  });

  it("maps Stripe subscription statuses through the billing contract", () => {
    expect(mapStripeSubscriptionStatus("trialing")).toBe("trialing");
    expect(mapStripeSubscriptionStatus("active")).toBe("active");
    expect(mapStripeSubscriptionStatus("past_due")).toBe("past_due");
    expect(mapStripeSubscriptionStatus("canceled")).toBe("cancelled");
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("expired");
    expect(mapStripeSubscriptionStatus("incomplete")).toBe("past_due");
    expect(mapStripeSubscriptionStatus("incomplete_expired")).toBe("expired");
  });

  it("rejects stale signatures", () => {
    const payload = JSON.stringify(subscriptionEvent());

    expect(() =>
      parseStripeWebhookEvent(
        { payload, signatureHeader: stripeSignatureHeader(payload) },
        {
          secret,
          now: () => new Date((timestamp + 301) * 1000)
        }
      )
    ).toThrowError(
      new StripeWebhookError(
        "STALE_SIGNATURE",
        "Stripe webhook signature timestamp is outside the allowed tolerance."
      )
    );
  });

  it("rejects invalid signatures", () => {
    const payload = JSON.stringify(subscriptionEvent());

    expect(() =>
      parseStripeWebhookEvent(
        { payload, signatureHeader: `t=${timestamp},v1=0`.padEnd(71, "0") },
        { secret, now }
      )
    ).toThrowError(
      new StripeWebhookError(
        "INVALID_SIGNATURE",
        "Stripe webhook signature does not match the payload."
      )
    );
  });

  it("rejects malformed signature headers", () => {
    const payload = JSON.stringify(subscriptionEvent());

    expect(() =>
      parseStripeWebhookEvent(
        { payload, signatureHeader: `t=${timestamp}` },
        { secret, now }
      )
    ).toThrowError(
      new StripeWebhookError(
        "MALFORMED_SIGNATURE_HEADER",
        "Stripe-Signature header must include t and at least one v1 signature."
      )
    );
  });

  it("rejects malformed JSON after signature verification", () => {
    const payload = "{";

    expect(() =>
      parseStripeWebhookEvent(
        { payload, signatureHeader: stripeSignatureHeader(payload) },
        { secret, now }
      )
    ).toThrowError(
      new StripeWebhookError(
        "MALFORMED_PAYLOAD",
        "Stripe webhook payload must be valid JSON."
      )
    );
  });

  it("rejects unsupported event types", () => {
    const payload = JSON.stringify({
      id: "evt_unsupported",
      type: "charge.succeeded",
      created: timestamp,
      data: {
        object: {}
      }
    });

    expect(() =>
      parseStripeWebhookEvent(
        { payload, signatureHeader: stripeSignatureHeader(payload) },
        { secret, now }
      )
    ).toThrowError(
      new StripeWebhookError(
        "UNSUPPORTED_EVENT_TYPE",
        "Stripe webhook event type charge.succeeded is not supported."
      )
    );
  });

  it("rejects unsupported subscription statuses", () => {
    const payload = JSON.stringify(
      subscriptionEvent({
        status: "paused"
      })
    );

    expect(() =>
      parseStripeWebhookEvent(
        { payload, signatureHeader: stripeSignatureHeader(payload) },
        { secret, now }
      )
    ).toThrowError(
      new StripeWebhookError(
        "UNSUPPORTED_SUBSCRIPTION_STATUS",
        "Stripe subscription status paused is not supported."
      )
    );
  });
});

function subscriptionEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_subscription_updated",
    type: "customer.subscription.updated",
    created: timestamp,
    data: {
      object: {
        id: "sub_123",
        status: "active",
        customer: "cus_123",
        current_period_start: 1_780_272_000,
        current_period_end: 1_782_864_000,
        items: {
          data: [
            {
              price: {
                lookup_key: "searchlint_team_monthly"
              }
            }
          ]
        },
        ...overrides
      }
    }
  };
}

function stripeSignatureHeader(payload: string): string {
  return `t=${timestamp},v1=${stripeSignature(payload)}`;
}

function stripeSignature(payload: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
}
