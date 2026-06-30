# SearchLint API Documentation

Status date: 2026-06-30

This document is the public website source for the Cloud API page. It documents
the intended SearchLint 1.0 API surface without claiming that live production
API endpoints are deployed.

## Cloud API

The SearchLint Cloud API belongs to the closed commercial platform. The planned
scope includes authenticated project management, crawl scheduling, diagnostics
retrieval, report generation, provider evidence ingestion, billing-aware limits,
and agency workflows.

## Release Boundary

Static API contracts and local verifier reports are not live production API
evidence. Public API availability requires deployed API Gateway or equivalent
routing, service acceptance, security testing, monitoring, and owner approval.

## Evidence Rules

API-backed diagnostics must preserve stable rule IDs, deterministic severity,
and machine-readable evidence. External provider observations must include an
observation date and freshness metadata.
