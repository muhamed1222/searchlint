import {
  DeleteSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand
} from "@aws-sdk/client-secrets-manager";
import type { GetSecretValueCommandOutput } from "@aws-sdk/client-secrets-manager";
import { describe, expect, it } from "vitest";

import {
  createSearchLintSecretRefResolver,
  createSecretsManagerExternalObservationAccessTokenVault
} from "../src/index.js";
import type { SecretsManagerGetSecretValueClient } from "../src/index.js";

describe("createSearchLintSecretRefResolver", () => {
  it("maps SearchLint secret refs to AWS Secrets Manager SecretId values", () => {
    const resolveSecretId = createSearchLintSecretRefResolver();

    expect(
      resolveSecretId({
        organizationId: "org-1",
        secretRef: "secret://org-1/google/access-token"
      })
    ).toBe("org-1/google/access-token");
  });

  it("normalizes optional secret name prefixes", () => {
    const resolveSecretId = createSearchLintSecretRefResolver({
      prefix: "/searchlint/prod/oauth/"
    });

    expect(
      resolveSecretId({
        organizationId: "org-1",
        secretRef: "secret:///org-1//yandex//access-token"
      })
    ).toBe("searchlint/prod/oauth/org-1/yandex/access-token");
  });

  it("rejects unsupported or empty secret refs before AWS calls", () => {
    const resolveSecretId = createSearchLintSecretRefResolver();

    expect(() =>
      resolveSecretId({
        organizationId: "org-1",
        secretRef: ""
      })
    ).toThrow("External observation secret ref is required.");
    expect(() =>
      resolveSecretId({
        organizationId: "org-1",
        secretRef: "arn:aws:secretsmanager:region:account:secret:name"
      })
    ).toThrow("External observation secret ref must use the secret:// scheme.");
    expect(() =>
      resolveSecretId({
        organizationId: "org-1",
        secretRef: "secret:///"
      })
    ).toThrow("External observation secret ref path is required.");
    expect(() =>
      resolveSecretId({
        organizationId: "",
        secretRef: "secret://org-1/google/access-token"
      })
    ).toThrow("External observation organization id is required.");
    expect(() =>
      resolveSecretId({
        organizationId: "org-1",
        secretRef: "secret://org-2/google/access-token"
      })
    ).toThrow(
      "External observation secret ref must be scoped to the connection organization."
    );
  });
});

describe("createSecretsManagerExternalObservationAccessTokenVault", () => {
  it("reads access tokens through GetSecretValue without exposing token metadata", async () => {
    const harness = createHarness({
      output: {
        SecretString: "google-access-token",
        $metadata: {}
      }
    });
    const vault = createSecretsManagerExternalObservationAccessTokenVault({
      client: harness.client,
      secretNamePrefix: "searchlint/prod/oauth"
    });

    await expect(
      vault.getSecret({
        organizationId: "org-1",
        secretRef: "secret://org-1/google/access-token"
      })
    ).resolves.toEqual({
      value: "google-access-token"
    });

    expect(harness.commands).toHaveLength(1);
    expect(harness.commands[0]?.input).toEqual({
      SecretId: "searchlint/prod/oauth/org-1/google/access-token"
    });
  });

  it("propagates Secrets Manager client failures", async () => {
    const harness = createHarness({
      sendError: new Error("secrets manager unavailable")
    });
    const vault = createSecretsManagerExternalObservationAccessTokenVault({
      client: harness.client
    });

    await expect(
      vault.getSecret({
        organizationId: "org-1",
        secretRef: "secret://org-1/google/access-token"
      })
    ).rejects.toThrow("secrets manager unavailable");
    expect(harness.commands).toHaveLength(1);
  });

  it("writes refreshed tokens through PutSecretValue", async () => {
    const harness = createHarness({});
    const vault = createSecretsManagerExternalObservationAccessTokenVault({
      client: harness.client,
      secretNamePrefix: "searchlint/prod/oauth"
    });

    await expect(
      vault.putSecret?.({
        organizationId: "org-1",
        secretRef: "secret://org-1/google/access-token",
        value: "refreshed-access-token"
      })
    ).resolves.toBeUndefined();

    expect(harness.commands).toHaveLength(1);
    expect(harness.commands[0]?.input).toEqual({
      SecretId: "searchlint/prod/oauth/org-1/google/access-token",
      SecretString: "refreshed-access-token"
    });
  });

  it("rejects empty refreshed token values before Secrets Manager writes", async () => {
    const harness = createHarness({});
    const vault = createSecretsManagerExternalObservationAccessTokenVault({
      client: harness.client
    });

    await expect(
      vault.putSecret?.({
        organizationId: "org-1",
        secretRef: "secret://org-1/google/access-token",
        value: "   "
      })
    ).rejects.toThrow("External observation token secret value is empty.");
    expect(harness.commands).toEqual([]);
  });

  it("deletes token secrets through Secrets Manager with a recovery window", async () => {
    const harness = createHarness({});
    const vault = createSecretsManagerExternalObservationAccessTokenVault({
      client: harness.client,
      secretNamePrefix: "searchlint/prod/oauth"
    });

    await expect(
      vault.deleteSecret?.({
        organizationId: "org-1",
        secretRef: "secret://org-1/google/access-token"
      })
    ).resolves.toBeUndefined();

    expect(harness.commands).toHaveLength(1);
    expect(harness.commands[0]).toBeInstanceOf(DeleteSecretCommand);
    expect(harness.commands[0]?.input).toEqual({
      SecretId: "searchlint/prod/oauth/org-1/google/access-token",
      RecoveryWindowInDays: 7
    });
  });

  it("rejects missing, empty, and binary-only secret values", async () => {
    await expectSecretOutput({ $metadata: {} }).rejects.toThrow(
      "External observation access token secret must contain SecretString."
    );
    await expectSecretOutput({
      SecretString: "   ",
      $metadata: {}
    }).rejects.toThrow("External observation access token secret is empty.");
    await expectSecretOutput({
      SecretBinary: new Uint8Array([1, 2, 3]),
      $metadata: {}
    }).rejects.toThrow(
      "External observation access token secret must contain SecretString."
    );
  });
});

function expectSecretOutput(output: GetSecretValueCommandOutput) {
  const harness = createHarness({ output });
  const vault = createSecretsManagerExternalObservationAccessTokenVault({
    client: harness.client
  });

  return expect(
    vault.getSecret({
      organizationId: "org-1",
      secretRef: "secret://org-1/google/access-token"
    })
  );
}

function createHarness(options: {
  output?: GetSecretValueCommandOutput;
  sendError?: Error;
}) {
  const commands: Array<
    GetSecretValueCommand | PutSecretValueCommand | DeleteSecretCommand
  > = [];
  const client: SecretsManagerGetSecretValueClient = {
    async send(command) {
      if (
        !(
          command instanceof GetSecretValueCommand ||
          command instanceof PutSecretValueCommand ||
          command instanceof DeleteSecretCommand
        )
      ) {
        throw new Error("Expected Secrets Manager token command.");
      }
      commands.push(command);
      if (
        command instanceof PutSecretValueCommand ||
        command instanceof DeleteSecretCommand
      ) {
        return {
          $metadata: {}
        };
      }
      if (options.sendError) {
        throw options.sendError;
      }
      return (
        options.output ?? {
          SecretString: "access-token",
          $metadata: {}
        }
      );
    }
  };

  return {
    client,
    commands
  };
}
