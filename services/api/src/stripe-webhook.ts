import { createHmac, timingSafeEqual } from "node:crypto";

import {
  stripeBillingContract,
  type StripeBillingWebhookEventType,
  type StripeSubscriptionStatus
} from "./stripe-billing-contracts.js";
import type { EntitlementStatus } from "./types.js";

export type StripeWebhookVerificationInput = {
  payload: string | Buffer;
  signatureHeader: string;
};

export type StripeWebhookVerificationOptions = {
  secret: string;
  now?: () => Date;
  toleranceSeconds?: number;
};

export type StripeWebhookErrorCode =
  | "MISSING_SECRET"
  | "MALFORMED_SIGNATURE_HEADER"
  | "STALE_SIGNATURE"
  | "INVALID_SIGNATURE"
  | "MALFORMED_PAYLOAD"
  | "UNSUPPORTED_EVENT_TYPE"
  | "UNSUPPORTED_SUBSCRIPTION_STATUS"
  | "MALFORMED_EVENT_OBJECT";

export class StripeWebhookError extends Error {
  readonly code: StripeWebhookErrorCode;

  constructor(code: StripeWebhookErrorCode, message: string) {
    super(message);
    this.name = "StripeWebhookError";
    this.code = code;
  }
}

export type StripeWebhookVerifiedSignature = {
  timestamp: number;
  signedPayload: Buffer;
};

export type StripeWebhookSubscriptionEntitlementUpdateIntent = {
  kind: "subscription-entitlement-update";
  stripeEventId: string;
  stripeEventType: Extract<
    StripeBillingWebhookEventType,
    | "customer.subscription.created"
    | "customer.subscription.updated"
    | "customer.subscription.deleted"
  >;
  stripeSubscriptionId: string;
  stripeCustomerId?: string;
  stripePriceLookupKey?: string;
  entitlementStatus: EntitlementStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  source: "stripe";
  idempotencyKey: string;
};

export type StripeWebhookPaymentSignalIntent = {
  kind: "payment-signal";
  stripeEventId: string;
  stripeEventType: Extract<
    StripeBillingWebhookEventType,
    "invoice.payment_failed" | "invoice.payment_succeeded"
  >;
  stripeInvoiceId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  signal: "invoice-payment-failed" | "invoice-payment-succeeded";
  occurredAt: string;
  source: "stripe";
  idempotencyKey: string;
};

export type StripeWebhookIntent =
  | StripeWebhookSubscriptionEntitlementUpdateIntent
  | StripeWebhookPaymentSignalIntent;

export type StripeWebhookNormalizedEvent = {
  id: string;
  type: StripeBillingWebhookEventType;
  created: number;
  receivedAt: string;
  idempotencyKey: string;
  intent: StripeWebhookIntent;
  rawEvent: unknown;
};

type StripeEventEnvelope = {
  id: string;
  type: StripeBillingWebhookEventType;
  created: number;
  data: {
    object: unknown;
  };
};

const defaultToleranceSeconds = 300;

export function verifyStripeWebhookSignature(
  input: StripeWebhookVerificationInput,
  options: StripeWebhookVerificationOptions
): StripeWebhookVerifiedSignature {
  if (!options.secret) {
    throw new StripeWebhookError(
      "MISSING_SECRET",
      "Stripe webhook signing secret is required."
    );
  }

  const payload = payloadBuffer(input.payload);
  const signature = parseStripeSignatureHeader(input.signatureHeader);
  const nowSeconds = Math.floor(
    (options.now?.() ?? new Date()).getTime() / 1000
  );
  const toleranceSeconds = options.toleranceSeconds ?? defaultToleranceSeconds;

  if (Math.abs(nowSeconds - signature.timestamp) > toleranceSeconds) {
    throw new StripeWebhookError(
      "STALE_SIGNATURE",
      "Stripe webhook signature timestamp is outside the allowed tolerance."
    );
  }

  const signedPayload = Buffer.concat([
    Buffer.from(`${signature.timestamp}.`, "utf8"),
    payload
  ]);
  const expectedSignature = createHmac("sha256", options.secret)
    .update(signedPayload)
    .digest();

  const matched = signature.signatures.some((candidate) =>
    secureHexDigestEqual(candidate, expectedSignature)
  );

  if (!matched) {
    throw new StripeWebhookError(
      "INVALID_SIGNATURE",
      "Stripe webhook signature does not match the payload."
    );
  }

  return {
    timestamp: signature.timestamp,
    signedPayload
  };
}

export function parseStripeWebhookEvent(
  input: StripeWebhookVerificationInput,
  options: StripeWebhookVerificationOptions
): StripeWebhookNormalizedEvent {
  verifyStripeWebhookSignature(input, options);

  const rawEvent = parseJsonPayload(payloadBuffer(input.payload));
  const event = parseStripeEventEnvelope(rawEvent);
  const receivedAt = (options.now?.() ?? new Date()).toISOString();
  const idempotencyKey = event.id;

  return {
    id: event.id,
    type: event.type,
    created: event.created,
    receivedAt,
    idempotencyKey,
    intent: normalizeStripeWebhookIntent(event, idempotencyKey),
    rawEvent
  };
}

export function mapStripeSubscriptionStatus(
  status: StripeSubscriptionStatus
): EntitlementStatus {
  const mapping = stripeBillingContract.subscriptionStatusMappings.find(
    (candidate) => candidate.stripeStatus === status
  );
  if (!mapping) {
    throw new StripeWebhookError(
      "UNSUPPORTED_SUBSCRIPTION_STATUS",
      `Stripe subscription status ${status} is not supported.`
    );
  }
  return mapping.entitlementStatus;
}

function parseStripeSignatureHeader(signatureHeader: string): {
  timestamp: number;
  signatures: string[];
} {
  const parts = signatureHeader
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  let timestamp: number | undefined;
  const signatures: string[] = [];

  for (const part of parts) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = part.slice(0, separatorIndex);
    const value = part.slice(separatorIndex + 1);
    if (key === "t") {
      const parsedTimestamp = Number(value);
      if (Number.isInteger(parsedTimestamp) && parsedTimestamp > 0) {
        timestamp = parsedTimestamp;
      }
    }
    if (key === "v1" && value) {
      signatures.push(value);
    }
  }

  if (timestamp === undefined || signatures.length === 0) {
    throw new StripeWebhookError(
      "MALFORMED_SIGNATURE_HEADER",
      "Stripe-Signature header must include t and at least one v1 signature."
    );
  }

  return { timestamp, signatures };
}

function payloadBuffer(payload: string | Buffer): Buffer {
  return typeof payload === "string" ? Buffer.from(payload, "utf8") : payload;
}

function secureHexDigestEqual(candidate: string, expected: Buffer): boolean {
  const candidateDigest = Buffer.from(candidate, "hex");
  if (candidateDigest.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(candidateDigest, expected);
}

function parseJsonPayload(payload: Buffer): unknown {
  try {
    return JSON.parse(payload.toString("utf8")) as unknown;
  } catch {
    throw new StripeWebhookError(
      "MALFORMED_PAYLOAD",
      "Stripe webhook payload must be valid JSON."
    );
  }
}

function parseStripeEventEnvelope(rawEvent: unknown): StripeEventEnvelope {
  const event = objectRecord(rawEvent, "Stripe webhook payload");
  const id = requiredString(event, "id", "Stripe webhook event id");
  const type = requiredString(event, "type", "Stripe webhook event type");
  const created = requiredNumber(event, "created", "Stripe webhook created");
  const data = objectRecord(event["data"], "Stripe webhook data");

  if (!isSupportedWebhookEventType(type)) {
    throw new StripeWebhookError(
      "UNSUPPORTED_EVENT_TYPE",
      `Stripe webhook event type ${type} is not supported.`
    );
  }

  return {
    id,
    type,
    created,
    data: {
      object: data["object"]
    }
  };
}

function normalizeStripeWebhookIntent(
  event: StripeEventEnvelope,
  idempotencyKey: string
): StripeWebhookIntent {
  if (isSubscriptionEventType(event.type)) {
    return normalizeSubscriptionIntent(event, idempotencyKey);
  }
  return normalizeInvoicePaymentIntent(event, idempotencyKey);
}

function normalizeSubscriptionIntent(
  event: StripeEventEnvelope,
  idempotencyKey: string
): StripeWebhookSubscriptionEntitlementUpdateIntent {
  if (!isSubscriptionEventType(event.type)) {
    throw new StripeWebhookError(
      "UNSUPPORTED_EVENT_TYPE",
      `Stripe webhook event type ${event.type} is not a subscription event.`
    );
  }
  const subscription = objectRecord(
    event.data.object,
    "Stripe subscription object"
  );
  const status = subscriptionStatus(
    requiredString(subscription, "status", "Stripe subscription status")
  );
  const customerId = optionalStripeObjectId(subscription["customer"]);
  const priceLookupKey = subscriptionPriceLookupKey(subscription);

  return {
    kind: "subscription-entitlement-update",
    stripeEventId: event.id,
    stripeEventType: event.type,
    stripeSubscriptionId: requiredString(
      subscription,
      "id",
      "Stripe subscription id"
    ),
    ...(customerId ? { stripeCustomerId: customerId } : {}),
    ...(priceLookupKey ? { stripePriceLookupKey: priceLookupKey } : {}),
    entitlementStatus: mapStripeSubscriptionStatus(status),
    currentPeriodStart: unixSecondsIso(
      requiredNumber(
        subscription,
        "current_period_start",
        "Stripe subscription current_period_start"
      )
    ),
    currentPeriodEnd: unixSecondsIso(
      requiredNumber(
        subscription,
        "current_period_end",
        "Stripe subscription current_period_end"
      )
    ),
    source: "stripe",
    idempotencyKey
  };
}

function normalizeInvoicePaymentIntent(
  event: StripeEventEnvelope,
  idempotencyKey: string
): StripeWebhookPaymentSignalIntent {
  if (!isInvoicePaymentEventType(event.type)) {
    throw new StripeWebhookError(
      "UNSUPPORTED_EVENT_TYPE",
      `Stripe webhook event type ${event.type} is not an invoice payment event.`
    );
  }
  const invoice = objectRecord(event.data.object, "Stripe invoice object");
  const customerId = optionalStripeObjectId(invoice["customer"]);
  const subscriptionId = optionalStripeObjectId(invoice["subscription"]);

  return {
    kind: "payment-signal",
    stripeEventId: event.id,
    stripeEventType: event.type,
    stripeInvoiceId: requiredString(invoice, "id", "Stripe invoice id"),
    ...(customerId ? { stripeCustomerId: customerId } : {}),
    ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
    signal:
      event.type === "invoice.payment_failed"
        ? "invoice-payment-failed"
        : "invoice-payment-succeeded",
    occurredAt: unixSecondsIso(event.created),
    source: "stripe",
    idempotencyKey
  };
}

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StripeWebhookError(
      "MALFORMED_EVENT_OBJECT",
      `${label} must be an object.`
    );
  }
  return value as Record<string, unknown>;
}

function requiredString(
  record: Record<string, unknown>,
  field: string,
  label: string
): string {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new StripeWebhookError(
      "MALFORMED_EVENT_OBJECT",
      `${label} must be a non-empty string.`
    );
  }
  return value;
}

function requiredNumber(
  record: Record<string, unknown>,
  field: string,
  label: string
): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new StripeWebhookError(
      "MALFORMED_EVENT_OBJECT",
      `${label} must be a non-negative integer.`
    );
  }
  return value;
}

function unixSecondsIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

function optionalStripeObjectId(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const id = (value as Record<string, unknown>)["id"];
    if (typeof id === "string" && id.length > 0) {
      return id;
    }
  }
  return undefined;
}

function subscriptionPriceLookupKey(
  subscription: Record<string, unknown>
): string | undefined {
  const items = objectRecord(
    subscription["items"],
    "Stripe subscription items"
  );
  const data = items["data"];
  if (!Array.isArray(data) || data.length === 0) {
    return undefined;
  }
  const firstItem = objectRecord(data[0], "Stripe subscription item");
  const price = objectRecord(firstItem["price"], "Stripe subscription price");
  const lookupKey = price["lookup_key"];
  return typeof lookupKey === "string" && lookupKey.length > 0
    ? lookupKey
    : undefined;
}

function isSupportedWebhookEventType(
  eventType: string
): eventType is StripeBillingWebhookEventType {
  return stripeBillingContract.webhooks.events.some(
    (candidate) => candidate === eventType
  );
}

function isSubscriptionEventType(
  eventType: StripeBillingWebhookEventType
): eventType is StripeWebhookSubscriptionEntitlementUpdateIntent["stripeEventType"] {
  return eventType.startsWith("customer.subscription.");
}

function isInvoicePaymentEventType(
  eventType: StripeBillingWebhookEventType
): eventType is StripeWebhookPaymentSignalIntent["stripeEventType"] {
  return eventType.startsWith("invoice.payment_");
}

function subscriptionStatus(status: string): StripeSubscriptionStatus {
  if (
    stripeBillingContract.subscriptionStatusMappings.some(
      (mapping) => mapping.stripeStatus === status
    )
  ) {
    return status as StripeSubscriptionStatus;
  }
  throw new StripeWebhookError(
    "UNSUPPORTED_SUBSCRIPTION_STATUS",
    `Stripe subscription status ${status} is not supported.`
  );
}
