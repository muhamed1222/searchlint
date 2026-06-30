export type CognitoUserPoolProvisioningProvider = "aws-cognito-user-pools";
export type CognitoUserPoolIdentityProtocol = "oidc-jwt";
export type CognitoUserPoolJwtAlgorithm = "RS256";
export type CognitoUserPoolTokenUse = "access";
export type CognitoUserPoolSignInAlias = "email";
export type CognitoUserPoolVerifiedAttribute = "email";
export type CognitoUserPoolAccountRecoveryMechanism = "verified_email";
export type CognitoUserPoolMfaMode = "optional";
export type CognitoUserPoolRbacSource = "searchlint-postgres-memberships";
export type CognitoUserPoolGroupUsage = "coarse-platform-access-only";
export type CognitoUserPoolOAuthFlow = "code";
export type CognitoUserPoolOAuthScope = "openid" | "email" | "profile";

export type CognitoUserPoolEnvironmentVariableName =
  | "SEARCHLINT_COGNITO_ISSUER"
  | "SEARCHLINT_COGNITO_AUDIENCE"
  | "SEARCHLINT_COGNITO_JWKS_URL"
  | "SEARCHLINT_COGNITO_TOKEN_USE";

export type CognitoUserPoolEnvironmentVariableContract = {
  name: CognitoUserPoolEnvironmentVariableName;
  required: true;
  secret: false;
};

export type CognitoUserPoolPasswordPolicyContract = {
  minimumLength: number;
  requireLowercase: true;
  requireUppercase: true;
  requireNumbers: true;
  requireSymbols: true;
};

export type CognitoUserPoolAppClientContract = {
  name: "searchlint-cloud-api";
  audienceEnv: "SEARCHLINT_COGNITO_AUDIENCE";
  generateClientSecret: false;
  tokenUse: CognitoUserPoolTokenUse;
  hostedUi: {
    authorizationCodePkce: true;
    callbackPath: "/auth/callback";
    logoutPath: "/signed-out";
    allowedOAuthFlows: readonly CognitoUserPoolOAuthFlow[];
    allowedOAuthScopes: readonly CognitoUserPoolOAuthScope[];
  };
};

export type CognitoUserPoolProvisioningContract = {
  id: "searchlint-cognito-user-pool-provisioning-v1";
  contractVersion: 1;
  provider: CognitoUserPoolProvisioningProvider;
  identityProtocol: CognitoUserPoolIdentityProtocol;
  userPool: {
    name: "searchlint-cloud-users";
    issuerEnv: "SEARCHLINT_COGNITO_ISSUER";
    jwksUrlEnv: "SEARCHLINT_COGNITO_JWKS_URL";
    jwtAlgorithm: CognitoUserPoolJwtAlgorithm;
    signInAliases: readonly CognitoUserPoolSignInAlias[];
    requiredVerifiedAttributes: readonly CognitoUserPoolVerifiedAttribute[];
    selfSignupEnabled: true;
    accountRecovery: {
      mechanisms: readonly CognitoUserPoolAccountRecoveryMechanism[];
    };
    passwordPolicy: CognitoUserPoolPasswordPolicyContract;
    mfa: {
      mode: CognitoUserPoolMfaMode;
      softwareTokenEnabled: true;
    };
  };
  appClients: readonly [CognitoUserPoolAppClientContract];
  authorization: {
    tenantRbacSource: CognitoUserPoolRbacSource;
    cognitoGroups: {
      allowed: true;
      usage: CognitoUserPoolGroupUsage;
      tenantAuthorizationSource: false;
    };
  };
  environment: {
    variables: readonly CognitoUserPoolEnvironmentVariableContract[];
  };
};

export type CognitoUserPoolProvisioningValidationIssue = {
  path: string;
  message: string;
};

const requiredEnvironment: readonly CognitoUserPoolEnvironmentVariableContract[] =
  [
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
  ];

export const cognitoUserPoolProvisioningContract: CognitoUserPoolProvisioningContract =
  {
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
      passwordPolicy: {
        minimumLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSymbols: true
      },
      mfa: {
        mode: "optional",
        softwareTokenEnabled: true
      }
    },
    appClients: [
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
    ],
    authorization: {
      tenantRbacSource: "searchlint-postgres-memberships",
      cognitoGroups: {
        allowed: true,
        usage: "coarse-platform-access-only",
        tenantAuthorizationSource: false
      }
    },
    environment: {
      variables: requiredEnvironment
    }
  };

export function validateCognitoUserPoolProvisioningContract(
  contract: CognitoUserPoolProvisioningContract
): CognitoUserPoolProvisioningValidationIssue[] {
  const issues: CognitoUserPoolProvisioningValidationIssue[] = [];

  expectEqual(
    issues,
    "id",
    contract.id,
    "searchlint-cognito-user-pool-provisioning-v1"
  );
  expectEqual(issues, "contractVersion", contract.contractVersion, 1);
  expectEqual(issues, "provider", contract.provider, "aws-cognito-user-pools");
  expectEqual(
    issues,
    "identityProtocol",
    contract.identityProtocol,
    "oidc-jwt"
  );
  validateUserPool(contract, issues);
  validateAppClients(contract, issues);
  validateAuthorization(contract, issues);
  validateEnvironment(contract, issues);

  return issues;
}

function validateUserPool(
  contract: CognitoUserPoolProvisioningContract,
  issues: CognitoUserPoolProvisioningValidationIssue[]
): void {
  expectEqual(
    issues,
    "userPool.name",
    contract.userPool.name,
    "searchlint-cloud-users"
  );
  expectEqual(
    issues,
    "userPool.issuerEnv",
    contract.userPool.issuerEnv,
    "SEARCHLINT_COGNITO_ISSUER"
  );
  expectEqual(
    issues,
    "userPool.jwksUrlEnv",
    contract.userPool.jwksUrlEnv,
    "SEARCHLINT_COGNITO_JWKS_URL"
  );
  expectEqual(
    issues,
    "userPool.jwtAlgorithm",
    contract.userPool.jwtAlgorithm,
    "RS256"
  );
  expectSetEqual(
    issues,
    "userPool.signInAliases",
    contract.userPool.signInAliases,
    ["email"]
  );
  expectSetEqual(
    issues,
    "userPool.requiredVerifiedAttributes",
    contract.userPool.requiredVerifiedAttributes,
    ["email"]
  );
  expectEqual(
    issues,
    "userPool.selfSignupEnabled",
    contract.userPool.selfSignupEnabled,
    true
  );
  expectSetEqual(
    issues,
    "userPool.accountRecovery.mechanisms",
    contract.userPool.accountRecovery?.mechanisms ?? [],
    ["verified_email"]
  );
  validatePasswordPolicy(contract.userPool.passwordPolicy, issues);
  expectEqual(
    issues,
    "userPool.mfa.mode",
    contract.userPool.mfa.mode,
    "optional"
  );
  expectEqual(
    issues,
    "userPool.mfa.softwareTokenEnabled",
    contract.userPool.mfa.softwareTokenEnabled,
    true
  );
}

function validatePasswordPolicy(
  policy: CognitoUserPoolPasswordPolicyContract,
  issues: CognitoUserPoolProvisioningValidationIssue[]
): void {
  if (!Number.isInteger(policy.minimumLength) || policy.minimumLength < 12) {
    issues.push({
      path: "userPool.passwordPolicy.minimumLength",
      message: "Cognito password minimum length must be at least 12."
    });
  }
  expectEqual(
    issues,
    "userPool.passwordPolicy.requireLowercase",
    policy.requireLowercase,
    true
  );
  expectEqual(
    issues,
    "userPool.passwordPolicy.requireUppercase",
    policy.requireUppercase,
    true
  );
  expectEqual(
    issues,
    "userPool.passwordPolicy.requireNumbers",
    policy.requireNumbers,
    true
  );
  expectEqual(
    issues,
    "userPool.passwordPolicy.requireSymbols",
    policy.requireSymbols,
    true
  );
}

function validateAppClients(
  contract: CognitoUserPoolProvisioningContract,
  issues: CognitoUserPoolProvisioningValidationIssue[]
): void {
  const apiClient = contract.appClients.find(
    (client) => client.name === "searchlint-cloud-api"
  );
  if (!apiClient) {
    issues.push({
      path: "appClients",
      message: "searchlint-cloud-api app client is required."
    });
    return;
  }
  expectEqual(
    issues,
    "appClients.searchlint-cloud-api.audienceEnv",
    apiClient.audienceEnv,
    "SEARCHLINT_COGNITO_AUDIENCE"
  );
  expectEqual(
    issues,
    "appClients.searchlint-cloud-api.generateClientSecret",
    apiClient.generateClientSecret,
    false
  );
  expectEqual(
    issues,
    "appClients.searchlint-cloud-api.tokenUse",
    apiClient.tokenUse,
    "access"
  );
  validateHostedUiAppClient(apiClient, issues);
}

function validateHostedUiAppClient(
  apiClient: CognitoUserPoolAppClientContract,
  issues: CognitoUserPoolProvisioningValidationIssue[]
): void {
  if (!apiClient.hostedUi) {
    issues.push({
      path: "appClients.searchlint-cloud-api.hostedUi",
      message: "Cognito Hosted UI app-client contract is required."
    });
    return;
  }
  expectEqual(
    issues,
    "appClients.searchlint-cloud-api.hostedUi.authorizationCodePkce",
    apiClient.hostedUi.authorizationCodePkce,
    true
  );
  expectEqual(
    issues,
    "appClients.searchlint-cloud-api.hostedUi.callbackPath",
    apiClient.hostedUi.callbackPath,
    "/auth/callback"
  );
  expectEqual(
    issues,
    "appClients.searchlint-cloud-api.hostedUi.logoutPath",
    apiClient.hostedUi.logoutPath,
    "/signed-out"
  );
  expectSetEqual(
    issues,
    "appClients.searchlint-cloud-api.hostedUi.allowedOAuthFlows",
    apiClient.hostedUi.allowedOAuthFlows,
    ["code"]
  );
  expectSetEqual(
    issues,
    "appClients.searchlint-cloud-api.hostedUi.allowedOAuthScopes",
    apiClient.hostedUi.allowedOAuthScopes,
    ["openid", "email", "profile"]
  );
}

function validateAuthorization(
  contract: CognitoUserPoolProvisioningContract,
  issues: CognitoUserPoolProvisioningValidationIssue[]
): void {
  expectEqual(
    issues,
    "authorization.tenantRbacSource",
    contract.authorization.tenantRbacSource,
    "searchlint-postgres-memberships"
  );
  expectEqual(
    issues,
    "authorization.cognitoGroups.allowed",
    contract.authorization.cognitoGroups.allowed,
    true
  );
  expectEqual(
    issues,
    "authorization.cognitoGroups.usage",
    contract.authorization.cognitoGroups.usage,
    "coarse-platform-access-only"
  );
  expectEqual(
    issues,
    "authorization.cognitoGroups.tenantAuthorizationSource",
    contract.authorization.cognitoGroups.tenantAuthorizationSource,
    false
  );
}

function validateEnvironment(
  contract: CognitoUserPoolProvisioningContract,
  issues: CognitoUserPoolProvisioningValidationIssue[]
): void {
  const variables = new Map(
    contract.environment.variables.map((variable) => [variable.name, variable])
  );

  for (const expected of requiredEnvironment) {
    const variable = variables.get(expected.name);
    if (!variable) {
      issues.push({
        path: "environment.variables",
        message: `${expected.name} environment variable contract is required.`
      });
      continue;
    }
    const basePath = `environment.variables.${expected.name}`;
    expectEqual(issues, `${basePath}.required`, variable.required, true);
    expectEqual(issues, `${basePath}.secret`, variable.secret, false);
  }
}

function expectEqual(
  issues: CognitoUserPoolProvisioningValidationIssue[],
  path: string,
  actual: unknown,
  expected: unknown
): void {
  if (actual !== expected) {
    issues.push({
      path,
      message: `${path} must be ${String(expected)}.`
    });
  }
}

function expectSetEqual(
  issues: CognitoUserPoolProvisioningValidationIssue[],
  path: string,
  actual: readonly string[],
  expected: readonly string[]
): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  for (const value of expectedSet) {
    if (!actualSet.has(value)) {
      issues.push({
        path,
        message: `${value} is required.`
      });
    }
  }

  for (const value of actualSet) {
    if (!expectedSet.has(value)) {
      issues.push({
        path,
        message: `${value} is not part of the approved set.`
      });
    }
  }
}
