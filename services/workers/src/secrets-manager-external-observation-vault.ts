import {
  DeleteSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  type GetSecretValueCommandOutput,
  type SecretsManagerClient
} from "@aws-sdk/client-secrets-manager";

import type { ExternalObservationAccessTokenVault } from "./external-observation-collection-worker.js";

export type SecretsManagerGetSecretValueClient = Pick<
  SecretsManagerClient,
  "send"
>;

export type SecretsManagerExternalObservationSecretIdResolverInput = {
  organizationId: string;
  secretRef: string;
};

export type SecretsManagerExternalObservationSecretIdResolver = (
  input: SecretsManagerExternalObservationSecretIdResolverInput
) => string;

export type SecretsManagerExternalObservationAccessTokenVaultOptions = {
  client: SecretsManagerGetSecretValueClient;
  secretNamePrefix?: string;
  resolveSecretId?: SecretsManagerExternalObservationSecretIdResolver;
};

export function createSecretsManagerExternalObservationAccessTokenVault(
  options: SecretsManagerExternalObservationAccessTokenVaultOptions
): ExternalObservationAccessTokenVault {
  const resolveSecretId =
    options.resolveSecretId ??
    createSearchLintSecretRefResolver(
      options.secretNamePrefix === undefined
        ? {}
        : { prefix: options.secretNamePrefix }
    );

  return {
    async getSecret(input) {
      const secretId = resolveSecretId(input);
      const output = await options.client.send(
        new GetSecretValueCommand({
          SecretId: secretId
        })
      );
      return {
        value: secretString(output)
      };
    },
    async putSecret(input) {
      const secretId = resolveSecretId(input);
      await options.client.send(
        new PutSecretValueCommand({
          SecretId: secretId,
          SecretString: nonEmptySecretValue(input.value)
        })
      );
    },
    async deleteSecret(input) {
      const secretId = resolveSecretId(input);
      await options.client.send(
        new DeleteSecretCommand({
          SecretId: secretId,
          RecoveryWindowInDays: 7
        })
      );
    }
  };
}

export function createSearchLintSecretRefResolver(
  options: {
    prefix?: string;
  } = {}
): SecretsManagerExternalObservationSecretIdResolver {
  const prefix = normalizeSecretPath(options.prefix ?? "");

  return (input) => {
    const path = searchLintSecretRefPath(input.secretRef);
    assertOrganizationScopedSecretRef(input.organizationId, path);
    if (prefix.length === 0) {
      return path;
    }
    return `${prefix}/${path}`;
  };
}

function searchLintSecretRefPath(secretRef: string): string {
  const trimmed = secretRef.trim();
  if (trimmed.length === 0) {
    throw new Error("External observation secret ref is required.");
  }
  if (!trimmed.startsWith("secret://")) {
    throw new Error(
      "External observation secret ref must use the secret:// scheme."
    );
  }

  const path = normalizeSecretPath(trimmed.slice("secret://".length));
  if (path.length === 0) {
    throw new Error("External observation secret ref path is required.");
  }
  return path;
}

function assertOrganizationScopedSecretRef(
  organizationId: string,
  path: string
): void {
  const expectedPrefix = normalizeSecretPath(organizationId);
  if (expectedPrefix.length === 0) {
    throw new Error("External observation organization id is required.");
  }
  if (path !== expectedPrefix && !path.startsWith(`${expectedPrefix}/`)) {
    throw new Error(
      "External observation secret ref must be scoped to the connection organization."
    );
  }
}

function normalizeSecretPath(path: string): string {
  return path
    .trim()
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("/");
}

function secretString(output: GetSecretValueCommandOutput): string {
  if (output.SecretString === undefined) {
    throw new Error(
      "External observation access token secret must contain SecretString."
    );
  }

  const value = output.SecretString.trim();
  if (value.length === 0) {
    throw new Error("External observation access token secret is empty.");
  }
  return value;
}

function nonEmptySecretValue(value: string): string {
  if (value.trim().length === 0) {
    throw new Error("External observation token secret value is empty.");
  }
  return value;
}
