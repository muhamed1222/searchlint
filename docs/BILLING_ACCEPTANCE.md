# Billing Acceptance

Status date: 2026-06-22

`pnpm billing:acceptance` verifies deterministic SearchLint billing contracts,
plan limits, Stripe request shapes, entitlement boundaries, usage limits,
overage policy, webhook parsing, and dashboard billing rendering.

## Verified Scope

- Approved Stripe Billing contract from OD-020 / ADR-0021.
- Starter, team, agency, and enterprise plan limits.
- Checkout session request shape for subscription mode.
- Customer portal session request shape.
- Subscription lifecycle summary, including trial state.
- Upgrade, downgrade, and cancellation intents.
- Invoice summary rendering from sanitized data.
- SearchLint-owned entitlement and usage-limit calculations.
- Overage policy: hard caps for starter/team/agency and contract override for
  enterprise.
- Stripe webhook signature/parsing boundary through deterministic fixture data.
- Dashboard billing rendering for plan, subscription status, trial, invoices,
  quota usage, and overage policy.

## Evidence

The verifier writes:

- `reports/billing-acceptance-report.json`
- `docs/examples/billing-acceptance-report.sample.json`

The checked sample is deterministic and sanitized. It must not contain Stripe
secret keys, webhook secrets, card data, raw customer email addresses,
authorization headers, or bearer tokens.

## Command

```bash
pnpm billing:acceptance
```

The command runs focused API and dashboard tests, builds the affected packages,
imports the built artifacts, validates deterministic billing behavior, and
writes the machine-readable evidence report.

## Not Claimed

This acceptance does not claim:

- public pricing release-candidate static packet, covered separately by
  `pnpm billing:pricing-static`;
- live Stripe product or price configuration;
- live Stripe checkout session creation;
- live Stripe customer portal session creation;
- live card payment;
- live invoice settlement;
- deployed Stripe webhook persistence against production RDS;
- production billing UI deployment;
- final pricing/legal terms.

## Remaining Release Gates

- Create and verify real Stripe products and prices. Setup-packet evidence
  exists through `pnpm billing:stripe-setup-packet`; live Stripe account
  mutation and ID verification remain open.
- Approve final public pricing and legal/customer communication. Static
  release-candidate pricing and Stripe blueprint evidence exists through
  `pnpm billing:pricing-static`.
- Create live Stripe checkout sessions and complete a test payment.
  Owner-evidence packet exists through
  `pnpm billing:checkout-acceptance-packet`; live checkout/payment evidence
  remains required before this gate can pass.
- Create live Stripe customer portal sessions. Owner-evidence packet exists
  through `pnpm billing:customer-portal-acceptance-packet`; live customer portal
  evidence remains required before this gate can pass.
- Verify live subscription trial, upgrade, downgrade, cancellation, and invoice
  flows. Owner-evidence packet exists through
  `pnpm billing:subscription-lifecycle-acceptance-packet`; live lifecycle
  evidence remains required before this gate can pass.
- Verify deployed Stripe webhook persistence against production RDS.
  Owner-evidence packet exists through
  `pnpm billing:webhook-rds-acceptance-packet`; deployed RDS evidence remains
  required before this gate can pass.
- Complete final live Stripe acceptance. Final owner-evidence packet exists
  through `pnpm billing:live-stripe-final-acceptance-packet`; real products/
  prices, checkout, portal, lifecycle, webhook/RDS, billing UI, legal approval,
  and owner sign-off evidence remain required before this gate can pass.
- Deploy and run browser E2E for billing UI.
- Finalize pricing, overage policy, terms of service, and customer
  communication.
