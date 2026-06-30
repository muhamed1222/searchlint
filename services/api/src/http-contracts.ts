import type { CloudPermission } from "./types.js";

export type CloudApiStability = "stable" | "experimental" | "internal";
export type CloudHttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type CloudApiOperation =
  | "createOrganization"
  | "addMember"
  | "createProject"
  | "createEnvironment"
  | "getDashboardSnapshot"
  | "requestCrawl"
  | "startExternalProviderOAuthConnection"
  | "completeExternalProviderOAuthConnection"
  | "acceptStripeWebhook";

export type CloudHttpRouteContract = {
  operation: CloudApiOperation;
  method: CloudHttpMethod;
  path: string;
  apiVersion: "v1";
  stability: CloudApiStability;
  permission?: CloudPermission;
  requestSchemaVersion: string;
  responseSchemaVersion: string;
};

export const cloudHttpRouteContracts: readonly CloudHttpRouteContract[] = [
  {
    operation: "createOrganization",
    method: "POST",
    path: "/v1/organizations",
    apiVersion: "v1",
    stability: "stable",
    requestSchemaVersion: "cloud.createOrganization.v1",
    responseSchemaVersion: "cloud.organizationWithMembership.v1"
  },
  {
    operation: "addMember",
    method: "POST",
    path: "/v1/organizations/{organizationId}/members",
    apiVersion: "v1",
    stability: "stable",
    permission: "member:manage",
    requestSchemaVersion: "cloud.addMember.v1",
    responseSchemaVersion: "cloud.membership.v1"
  },
  {
    operation: "createProject",
    method: "POST",
    path: "/v1/organizations/{organizationId}/projects",
    apiVersion: "v1",
    stability: "stable",
    permission: "project:create",
    requestSchemaVersion: "cloud.createProject.v1",
    responseSchemaVersion: "cloud.project.v1"
  },
  {
    operation: "createEnvironment",
    method: "POST",
    path: "/v1/organizations/{organizationId}/projects/{projectId}/environments",
    apiVersion: "v1",
    stability: "stable",
    permission: "environment:create",
    requestSchemaVersion: "cloud.createEnvironment.v1",
    responseSchemaVersion: "cloud.environment.v1"
  },
  {
    operation: "getDashboardSnapshot",
    method: "GET",
    path: "/v1/organizations/{organizationId}/projects/{projectId}/environments/{environmentId}/dashboard-snapshot",
    apiVersion: "v1",
    stability: "stable",
    permission: "project:read",
    requestSchemaVersion: "cloud.getDashboardSnapshot.v1",
    responseSchemaVersion: "cloud.dashboardSnapshot.v1"
  },
  {
    operation: "requestCrawl",
    method: "POST",
    path: "/v1/organizations/{organizationId}/projects/{projectId}/environments/{environmentId}/crawl-requests",
    apiVersion: "v1",
    stability: "stable",
    permission: "crawl:create",
    requestSchemaVersion: "cloud.requestCrawl.v1",
    responseSchemaVersion: "cloud.crawlRequestQueued.v1"
  },
  {
    operation: "startExternalProviderOAuthConnection",
    method: "POST",
    path: "/v1/organizations/{organizationId}/projects/{projectId}/environments/{environmentId}/external-providers/{provider}/oauth/start",
    apiVersion: "v1",
    stability: "stable",
    permission: "connector:manage",
    requestSchemaVersion: "cloud.startExternalProviderOAuthConnection.v1",
    responseSchemaVersion: "cloud.externalProviderOAuthAuthorization.v1"
  },
  {
    operation: "completeExternalProviderOAuthConnection",
    method: "POST",
    path: "/v1/organizations/{organizationId}/projects/{projectId}/environments/{environmentId}/external-providers/{provider}/oauth/callback",
    apiVersion: "v1",
    stability: "stable",
    permission: "connector:manage",
    requestSchemaVersion: "cloud.completeExternalProviderOAuthConnection.v1",
    responseSchemaVersion: "cloud.oauthConnection.v1"
  },
  {
    operation: "acceptStripeWebhook",
    method: "POST",
    path: "/v1/billing/stripe/webhook",
    apiVersion: "v1",
    stability: "stable",
    requestSchemaVersion: "stripe.webhook.rawPayload.v1",
    responseSchemaVersion: "stripe.webhook.accepted.v1"
  }
];

export function routeContractForOperation(
  operation: CloudApiOperation
): CloudHttpRouteContract {
  const contract = cloudHttpRouteContracts.find(
    (candidate) => candidate.operation === operation
  );
  if (!contract) {
    throw new Error(`Missing route contract for ${operation}.`);
  }
  return contract;
}
