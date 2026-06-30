import { describe, expect, it } from "vitest";

import {
  cognitoUserPoolProvisioningContract,
  validateCognitoUserPoolProvisioningContract
} from "../src/index.js";

describe("cognitoUserPoolProvisioningContract", () => {
  it("defines the approved Cognito user-pool provisioning target", () => {
    expect(
      validateCognitoUserPoolProvisioningContract(
        cognitoUserPoolProvisioningContract
      )
    ).toEqual([]);

    expect(cognitoUserPoolProvisioningContract).toMatchObject({
      id: "searchlint-cognito-user-pool-provisioning-v1",
      contractVersion: 1,
      provider: "aws-cognito-user-pools",
      identityProtocol: "oidc-jwt",
      userPool: {
        name: "searchlint-cloud-users",
        issuerEnv: "SEARCHLINT_COGNITO_ISSUER",
        jwksUrlEnv: "SEARCHLINT_COGNITO_JWKS_URL",
        jwtAlgorithm: "RS256",
        signInAliases: ["email"],
        requiredVerifiedAttributes: ["email"],
        selfSignupEnabled: true,
        accountRecovery: {
          mechanisms: ["verified_email"]
        },
        mfa: {
          mode: "optional",
          softwareTokenEnabled: true
        }
      }
    });
  });

  it("declares API app-client, environment, password, and RBAC boundaries", () => {
    expect(cognitoUserPoolProvisioningContract.appClients).toEqual([
      {
        name: "searchlint-cloud-api",
        audienceEnv: "SEARCHLINT_COGNITO_AUDIENCE",
        generateClientSecret: false,
        tokenUse: "access",
        hostedUi: {
          authorizationCodePkce: true,
          callbackPath: "/auth/callback",
          logoutPath: "/signed-out",
          allowedOAuthFlows: ["code"],
          allowedOAuthScopes: ["openid", "email", "profile"]
        }
      }
    ]);

    expect(cognitoUserPoolProvisioningContract.environment.variables).toEqual([
      {
        name: "SEARCHLINT_COGNITO_ISSUER",
        required: true,
        secret: false
      },
      {
        name: "SEARCHLINT_COGNITO_AUDIENCE",
        required: true,
        secret: false
      },
      {
        name: "SEARCHLINT_COGNITO_JWKS_URL",
        required: true,
        secret: false
      },
      {
        name: "SEARCHLINT_COGNITO_TOKEN_USE",
        required: true,
        secret: false
      }
    ]);

    expect(cognitoUserPoolProvisioningContract.userPool.passwordPolicy).toEqual(
      {
        minimumLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSymbols: true
      }
    );
    expect(cognitoUserPoolProvisioningContract.authorization).toEqual({
      tenantRbacSource: "searchlint-postgres-memberships",
      cognitoGroups: {
        allowed: true,
        usage: "coarse-platform-access-only",
        tenantAuthorizationSource: false
      }
    });
  });

  it("rejects provider, user-pool, app-client, password, environment, and RBAC drift", () => {
    const issues = validateCognitoUserPoolProvisioningContract({
      ...cognitoUserPoolProvisioningContract,
      provider: "other" as "aws-cognito-user-pools",
      userPool: {
        ...cognitoUserPoolProvisioningContract.userPool,
        jwtAlgorithm: "HS256" as "RS256",
        signInAliases: [],
        requiredVerifiedAttributes: [],
        selfSignupEnabled: false as true,
        accountRecovery: {
          mechanisms: []
        },
        passwordPolicy: {
          ...cognitoUserPoolProvisioningContract.userPool.passwordPolicy,
          minimumLength: 8,
          requireSymbols: false as true
        },
        mfa: {
          ...cognitoUserPoolProvisioningContract.userPool.mfa,
          softwareTokenEnabled: false as true
        }
      },
      appClients: [
        {
          ...cognitoUserPoolProvisioningContract.appClients[0],
          generateClientSecret: true as false,
          tokenUse: "id" as "access",
          hostedUi: {
            authorizationCodePkce: false as true,
            callbackPath: "/callback" as "/auth/callback",
            logoutPath: "/logout" as "/signed-out",
            allowedOAuthFlows: ["implicit" as "code"],
            allowedOAuthScopes: ["openid"]
          }
        }
      ],
      authorization: {
        ...cognitoUserPoolProvisioningContract.authorization,
        tenantRbacSource: "cognito-groups" as "searchlint-postgres-memberships",
        cognitoGroups: {
          allowed: true,
          usage: "tenant-rbac" as "coarse-platform-access-only",
          tenantAuthorizationSource: true as false
        }
      },
      environment: {
        variables:
          cognitoUserPoolProvisioningContract.environment.variables.filter(
            (variable) => variable.name !== "SEARCHLINT_COGNITO_JWKS_URL"
          )
      }
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        {
          path: "provider",
          message: "provider must be aws-cognito-user-pools."
        },
        {
          path: "userPool.jwtAlgorithm",
          message: "userPool.jwtAlgorithm must be RS256."
        },
        {
          path: "userPool.signInAliases",
          message: "email is required."
        },
        {
          path: "userPool.requiredVerifiedAttributes",
          message: "email is required."
        },
        {
          path: "userPool.selfSignupEnabled",
          message: "userPool.selfSignupEnabled must be true."
        },
        {
          path: "userPool.accountRecovery.mechanisms",
          message: "verified_email is required."
        },
        {
          path: "userPool.passwordPolicy.minimumLength",
          message: "Cognito password minimum length must be at least 12."
        },
        {
          path: "userPool.passwordPolicy.requireSymbols",
          message: "userPool.passwordPolicy.requireSymbols must be true."
        },
        {
          path: "userPool.mfa.softwareTokenEnabled",
          message: "userPool.mfa.softwareTokenEnabled must be true."
        },
        {
          path: "appClients.searchlint-cloud-api.generateClientSecret",
          message:
            "appClients.searchlint-cloud-api.generateClientSecret must be false."
        },
        {
          path: "appClients.searchlint-cloud-api.tokenUse",
          message: "appClients.searchlint-cloud-api.tokenUse must be access."
        },
        {
          path: "appClients.searchlint-cloud-api.hostedUi.authorizationCodePkce",
          message:
            "appClients.searchlint-cloud-api.hostedUi.authorizationCodePkce must be true."
        },
        {
          path: "appClients.searchlint-cloud-api.hostedUi.callbackPath",
          message:
            "appClients.searchlint-cloud-api.hostedUi.callbackPath must be /auth/callback."
        },
        {
          path: "appClients.searchlint-cloud-api.hostedUi.logoutPath",
          message:
            "appClients.searchlint-cloud-api.hostedUi.logoutPath must be /signed-out."
        },
        {
          path: "appClients.searchlint-cloud-api.hostedUi.allowedOAuthFlows",
          message: "code is required."
        },
        {
          path: "appClients.searchlint-cloud-api.hostedUi.allowedOAuthFlows",
          message: "implicit is not part of the approved set."
        },
        {
          path: "appClients.searchlint-cloud-api.hostedUi.allowedOAuthScopes",
          message: "email is required."
        },
        {
          path: "appClients.searchlint-cloud-api.hostedUi.allowedOAuthScopes",
          message: "profile is required."
        },
        {
          path: "authorization.tenantRbacSource",
          message:
            "authorization.tenantRbacSource must be searchlint-postgres-memberships."
        },
        {
          path: "authorization.cognitoGroups.usage",
          message:
            "authorization.cognitoGroups.usage must be coarse-platform-access-only."
        },
        {
          path: "authorization.cognitoGroups.tenantAuthorizationSource",
          message:
            "authorization.cognitoGroups.tenantAuthorizationSource must be false."
        },
        {
          path: "environment.variables",
          message:
            "SEARCHLINT_COGNITO_JWKS_URL environment variable contract is required."
        }
      ])
    );
  });
});
