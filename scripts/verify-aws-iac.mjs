import { readFile } from "node:fs/promises";

await verifyReportArtifactCleanupTemplate();
await verifyExternalObservationScheduleTemplate();
await verifyCognitoUserPoolTemplate();
await verifySecretVaultTemplate();
await verifyRdsPostgresTemplate();
await verifyArtifactStorageTemplate();
await verifyDashboardStaticHostingTemplate();
await verifyObservabilityTemplate();
await verifyCloudApiTemplate();
await verifyCrawlerWorkerTemplate();

console.log("verified SearchLint AWS IaC contracts");

async function verifyReportArtifactCleanupTemplate() {
  const templatePath =
    "infra/aws/report-artifact-cleanup-schedule.cloudformation.json";
  const template = JSON.parse(await readFile(templatePath, "utf8"));
  const resources = template.Resources ?? {};
  assertOtelHeadersSecretWiring(template, templatePath);

  const requiredResources = {
    ReportArtifactCleanupLogGroup: "AWS::Logs::LogGroup",
    ReportArtifactCleanupDeadLetterQueue: "AWS::SQS::Queue",
    ReportArtifactCleanupTaskExecutionRole: "AWS::IAM::Role",
    ReportArtifactCleanupTaskRole: "AWS::IAM::Role",
    ReportArtifactCleanupTaskDefinition: "AWS::ECS::TaskDefinition",
    ReportArtifactCleanupSchedulerRole: "AWS::IAM::Role",
    ReportArtifactCleanupSchedule: "AWS::Scheduler::Schedule"
  };

  for (const [name, type] of Object.entries(requiredResources)) {
    const resource = requiredResource(templatePath, resources, name);
    assertEqual(resource.Type, type, `${name} must be ${type}`);
  }

  const schedule = requiredResource(
    templatePath,
    resources,
    "ReportArtifactCleanupSchedule"
  ).Properties;
  assertEqual(
    schedule.ScheduleExpression,
    "rate(15 minutes)",
    "Report artifact cleanup schedule must run every 15 minutes"
  );
  assertEqual(
    schedule.FlexibleTimeWindow?.Mode,
    "OFF",
    "Report artifact cleanup schedule flexible time window must be disabled"
  );
  assertEqual(
    schedule.Target?.EcsParameters?.LaunchType,
    "FARGATE",
    "Report artifact cleanup schedule must target Fargate"
  );
  assertEqual(
    schedule.Target?.EcsParameters?.NetworkConfiguration?.AwsVpcConfiguration
      ?.AssignPublicIp,
    "DISABLED",
    "Report artifact cleanup task must not assign public IPs"
  );
  assertHas(
    schedule.Target?.DeadLetterConfig?.Arn,
    "Report artifact cleanup schedule must configure a DLQ"
  );
  assertEqual(
    schedule.Target?.RetryPolicy?.MaximumRetryAttempts,
    2,
    "Report artifact cleanup schedule retry attempts must match the schedule contract"
  );

  const task =
    requiredResource(
      templatePath,
      resources,
      "ReportArtifactCleanupTaskDefinition"
    ).Properties ?? {};
  assertIncludes(
    task.RequiresCompatibilities,
    "FARGATE",
    "Report artifact cleanup task definition must require Fargate"
  );
  assertEqual(
    task.NetworkMode,
    "awsvpc",
    "Report artifact cleanup task definition must use awsvpc networking"
  );
  const container = task.ContainerDefinitions?.[0];
  assertHas(container, "Report artifact cleanup task must define a container");
  assertEqual(
    container.Name,
    "report-artifact-cleanup",
    "Report artifact cleanup container name must be stable"
  );
  assertDeepEqual(
    container.Command,
    ["node", "dist/src/report-artifact-cleanup-bin.js"],
    "Report artifact cleanup container must run the cleanup executable"
  );
  assertEqual(
    container.LogConfiguration?.LogDriver,
    "awslogs",
    "Report artifact cleanup container must use awslogs"
  );
  const env = objectByName(container.Environment ?? []);
  for (const name of [
    "SEARCHLINT_POSTGRES_SSL_MODE",
    "SEARCHLINT_WORKER_REPORT_ARTIFACT_CLEANUP_POLL_INTERVAL_MS",
    "SEARCHLINT_WORKER_REPORT_ARTIFACT_CLEANUP_BATCH_SIZE"
  ]) {
    assertHas(
      env.get(name),
      `${name} must be declared as a container environment variable`
    );
  }
  const secrets = objectByName(container.Secrets ?? []);
  assertHas(
    secrets.get("SEARCHLINT_POSTGRES_DATABASE_URL"),
    "SEARCHLINT_POSTGRES_DATABASE_URL must be sourced from Secrets Manager"
  );
  assertPlaintextSecretAbsent(env, "SEARCHLINT_POSTGRES_DATABASE_URL");
  assertPlaintextSecretAbsent(env, "OTEL_EXPORTER_OTLP_HEADERS");

  const schedulerRole = requiredResource(
    templatePath,
    resources,
    "ReportArtifactCleanupSchedulerRole"
  );
  assertRoleServicePrincipal(
    schedulerRole,
    "scheduler.amazonaws.com",
    "Scheduler role"
  );
  assertRoleAllows(
    schedulerRole,
    "ecs:RunTask",
    "Scheduler role must be allowed to run the cleanup ECS task"
  );
  assertRoleAllows(
    schedulerRole,
    "iam:PassRole",
    "Scheduler role must be allowed to pass cleanup task roles"
  );
  assertRoleAllows(
    schedulerRole,
    "sqs:SendMessage",
    "Scheduler role must be allowed to send failed invocations to the DLQ"
  );

  const executionRole = requiredResource(
    templatePath,
    resources,
    "ReportArtifactCleanupTaskExecutionRole"
  );
  assertRoleServicePrincipal(
    executionRole,
    "ecs-tasks.amazonaws.com",
    "Task execution role"
  );
  assertRoleAllows(
    executionRole,
    "logs:PutLogEvents",
    "Task execution role must be allowed to write logs"
  );
  assertRoleAllows(
    executionRole,
    "secretsmanager:GetSecretValue",
    "Task execution role must read the PostgreSQL database URL secret"
  );

  const taskRole = requiredResource(
    templatePath,
    resources,
    "ReportArtifactCleanupTaskRole"
  );
  assertRoleServicePrincipal(taskRole, "ecs-tasks.amazonaws.com", "Task role");
  assertRoleAllows(
    taskRole,
    "s3:DeleteObject",
    "Task role must be allowed to delete report artifacts"
  );
}

async function verifyExternalObservationScheduleTemplate() {
  const templatePath =
    "infra/aws/external-observation-schedule.cloudformation.json";
  const template = JSON.parse(await readFile(templatePath, "utf8"));
  const resources = template.Resources ?? {};
  assertOtelHeadersSecretWiring(template, templatePath);

  const requiredResources = {
    ExternalObservationLogGroup: "AWS::Logs::LogGroup",
    ExternalObservationDeadLetterQueue: "AWS::SQS::Queue",
    ExternalObservationTaskExecutionRole: "AWS::IAM::Role",
    ExternalObservationTaskRole: "AWS::IAM::Role",
    ExternalObservationTaskDefinition: "AWS::ECS::TaskDefinition",
    ExternalObservationSchedulerRole: "AWS::IAM::Role",
    ExternalObservationSchedule: "AWS::Scheduler::Schedule"
  };

  for (const [name, type] of Object.entries(requiredResources)) {
    const resource = requiredResource(templatePath, resources, name);
    assertEqual(resource.Type, type, `${name} must be ${type}`);
  }

  const schedule = requiredResource(
    templatePath,
    resources,
    "ExternalObservationSchedule"
  ).Properties;
  assertEqual(
    schedule.ScheduleExpression,
    "rate(1 hour)",
    "External observation schedule must run hourly"
  );
  assertEqual(
    schedule.FlexibleTimeWindow?.Mode,
    "OFF",
    "External observation schedule flexible time window must be disabled"
  );
  assertEqual(
    schedule.Target?.EcsParameters?.LaunchType,
    "FARGATE",
    "External observation schedule must target Fargate"
  );
  assertEqual(
    schedule.Target?.EcsParameters?.NetworkConfiguration?.AwsVpcConfiguration
      ?.AssignPublicIp,
    "DISABLED",
    "External observation task must not assign public IPs"
  );
  assertHas(
    schedule.Target?.DeadLetterConfig?.Arn,
    "External observation schedule must configure a DLQ"
  );
  assertEqual(
    schedule.Target?.RetryPolicy?.MaximumRetryAttempts,
    2,
    "External observation schedule retry attempts must match the schedule contract"
  );

  const task =
    requiredResource(
      templatePath,
      resources,
      "ExternalObservationTaskDefinition"
    ).Properties ?? {};
  assertIncludes(
    task.RequiresCompatibilities,
    "FARGATE",
    "External observation task definition must require Fargate"
  );
  assertEqual(
    task.NetworkMode,
    "awsvpc",
    "External observation task definition must use awsvpc networking"
  );
  const container = task.ContainerDefinitions?.[0];
  assertHas(container, "External observation task must define a container");
  assertEqual(
    container.Name,
    "external-observation",
    "External observation container name must be stable"
  );
  assertDeepEqual(
    container.Command,
    ["node", "dist/src/external-observation-collection-bin.js"],
    "External observation container must run the collection executable"
  );
  assertEqual(
    container.LogConfiguration?.LogDriver,
    "awslogs",
    "External observation container must use awslogs"
  );

  const env = objectByName(container.Environment ?? []);
  for (const name of [
    "SEARCHLINT_POSTGRES_SSL_MODE",
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_PROVIDER",
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_POLL_INTERVAL_MS",
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_BATCH_SIZE",
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_MAX_BATCHES",
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_SECRET_NAME_PREFIX",
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_SITE_URLS",
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_DISCOVERY_MAX_SUBJECT_URLS",
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_PAGESPEED_ENABLED",
    "SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_GOOGLE_CRUX_ENABLED"
  ]) {
    assertHas(
      env.get(name),
      `${name} must be declared as a container environment variable`
    );
  }
  assertDeepEqual(
    env.get("SEARCHLINT_WORKER_EXTERNAL_OBSERVATION_MAX_BATCHES")?.Value,
    {
      Ref: "ExternalObservationMaxBatches"
    },
    "External observation scheduled task must expose max batch limit"
  );
  assertEqual(
    template.Parameters?.ExternalObservationMaxBatches?.Default,
    1,
    "External observation schedule must default to one batch per scheduled task"
  );

  const secrets = objectByName(container.Secrets ?? []);
  assertHas(
    secrets.get("SEARCHLINT_POSTGRES_DATABASE_URL"),
    "SEARCHLINT_POSTGRES_DATABASE_URL must be sourced from Secrets Manager"
  );
  const serializedSecrets = JSON.stringify(container.Secrets ?? []);
  for (const [name, parameterName] of [
    [
      "SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_ID",
      "GoogleOAuthClientIdSecretArn"
    ],
    [
      "SEARCHLINT_WORKER_GOOGLE_OAUTH_CLIENT_SECRET",
      "GoogleOAuthClientSecretSecretArn"
    ],
    [
      "SEARCHLINT_WORKER_YANDEX_OAUTH_CLIENT_ID",
      "YandexOAuthClientIdSecretArn"
    ],
    [
      "SEARCHLINT_WORKER_YANDEX_OAUTH_CLIENT_SECRET",
      "YandexOAuthClientSecretSecretArn"
    ]
  ]) {
    assertHas(
      template.Parameters?.[parameterName],
      `${parameterName} must be a deployment parameter`
    );
    assertStringIncludes(
      serializedSecrets,
      name,
      `${name} must be sourced through ECS secrets`
    );
    assertStringIncludes(
      serializedSecrets,
      parameterName,
      `${name} must reference ${parameterName}`
    );
    assertPlaintextSecretAbsent(env, name);
  }
  assertPlaintextSecretAbsent(env, "SEARCHLINT_POSTGRES_DATABASE_URL");
  assertPlaintextSecretAbsent(env, "OTEL_EXPORTER_OTLP_HEADERS");

  const schedulerRole = requiredResource(
    templatePath,
    resources,
    "ExternalObservationSchedulerRole"
  );
  assertRoleServicePrincipal(
    schedulerRole,
    "scheduler.amazonaws.com",
    "External observation scheduler role"
  );
  assertRoleAllows(
    schedulerRole,
    "ecs:RunTask",
    "External observation scheduler role must be allowed to run the ECS task"
  );
  assertRoleAllows(
    schedulerRole,
    "iam:PassRole",
    "External observation scheduler role must be allowed to pass task roles"
  );
  assertRoleAllows(
    schedulerRole,
    "sqs:SendMessage",
    "External observation scheduler role must send failed invocations to the DLQ"
  );

  const executionRole = requiredResource(
    templatePath,
    resources,
    "ExternalObservationTaskExecutionRole"
  );
  assertRoleServicePrincipal(
    executionRole,
    "ecs-tasks.amazonaws.com",
    "External observation task execution role"
  );
  assertRoleAllows(
    executionRole,
    "logs:PutLogEvents",
    "External observation task execution role must be allowed to write logs"
  );
  assertRoleAllows(
    executionRole,
    "secretsmanager:GetSecretValue",
    "External observation task execution role must read configured secrets"
  );

  const taskRole = requiredResource(
    templatePath,
    resources,
    "ExternalObservationTaskRole"
  );
  assertRoleServicePrincipal(
    taskRole,
    "ecs-tasks.amazonaws.com",
    "External observation task role"
  );
  assertRoleAllows(
    taskRole,
    "secretsmanager:GetSecretValue",
    "External observation task role must read OAuth token secrets"
  );
  assertRoleAllows(
    taskRole,
    "secretsmanager:PutSecretValue",
    "External observation task role must write refreshed OAuth token secrets"
  );
}

async function verifyCognitoUserPoolTemplate() {
  const templatePath = "infra/aws/cognito-user-pool.cloudformation.json";
  const template = JSON.parse(await readFile(templatePath, "utf8"));
  const resources = template.Resources ?? {};

  const requiredResources = {
    SearchLintUserPool: "AWS::Cognito::UserPool",
    SearchLintCloudApiAppClient: "AWS::Cognito::UserPoolClient",
    SearchLintUserPoolDomain: "AWS::Cognito::UserPoolDomain",
    SearchLintPlatformAccessGroup: "AWS::Cognito::UserPoolGroup"
  };

  for (const [name, type] of Object.entries(requiredResources)) {
    const resource = requiredResource(templatePath, resources, name);
    assertEqual(resource.Type, type, `${name} must be ${type}`);
  }

  const userPool = requiredResource(
    templatePath,
    resources,
    "SearchLintUserPool"
  ).Properties;
  assertIncludes(
    userPool.UsernameAttributes,
    "email",
    "Cognito user pool must support email sign-in"
  );
  assertIncludes(
    userPool.AutoVerifiedAttributes,
    "email",
    "Cognito user pool must verify email addresses"
  );
  assertDeepEqual(
    userPool.AccountRecoverySetting?.RecoveryMechanisms,
    [
      {
        Name: "verified_email",
        Priority: 1
      }
    ],
    "Cognito user pool must recover accounts through verified email"
  );
  assertEqual(
    userPool.AdminCreateUserConfig?.AllowAdminCreateUserOnly,
    false,
    "Cognito user pool must allow self-service signup"
  );
  const passwordPolicy = userPool.Policies?.PasswordPolicy;
  assertEqual(
    passwordPolicy?.MinimumLength,
    12,
    "Cognito password policy must require at least 12 characters"
  );
  for (const property of [
    "RequireLowercase",
    "RequireUppercase",
    "RequireNumbers",
    "RequireSymbols"
  ]) {
    assertEqual(
      passwordPolicy?.[property],
      true,
      `Cognito password policy must set ${property}`
    );
  }
  assertEqual(
    userPool.MfaConfiguration,
    "OPTIONAL",
    "Cognito user pool MFA must be optional"
  );
  assertIncludes(
    userPool.EnabledMfas,
    "SOFTWARE_TOKEN_MFA",
    "Cognito user pool must enable software-token MFA"
  );

  const appClient = requiredResource(
    templatePath,
    resources,
    "SearchLintCloudApiAppClient"
  ).Properties;
  assertEqual(
    appClient.ClientName,
    "searchlint-cloud-api",
    "Cognito API app client name must be stable"
  );
  assertEqual(
    appClient.GenerateSecret,
    false,
    "Cognito API app client must not generate a client secret"
  );
  assertEqual(
    appClient.AllowedOAuthFlowsUserPoolClient,
    true,
    "Cognito API app client must enable hosted UI OAuth flows"
  );
  assertIncludes(
    appClient.AllowedOAuthFlows,
    "code",
    "Cognito API app client must support authorization-code flow"
  );
  for (const scope of ["openid", "email", "profile"]) {
    assertIncludes(
      appClient.AllowedOAuthScopes,
      scope,
      `Cognito API app client must include ${scope} scope`
    );
  }
  assertIncludes(
    appClient.CallbackURLs?.map((value) => JSON.stringify(value)),
    JSON.stringify({ "Fn::Sub": "${AppBaseUrl}/auth/callback" }),
    "Cognito API app client must allow the dashboard auth callback URL"
  );
  assertIncludes(
    appClient.LogoutURLs?.map((value) => JSON.stringify(value)),
    JSON.stringify({ "Fn::Sub": "${AppBaseUrl}/signed-out" }),
    "Cognito API app client must allow the dashboard signed-out URL"
  );
  assertIncludes(
    appClient.SupportedIdentityProviders,
    "COGNITO",
    "Cognito API app client must support Cognito as an identity provider"
  );

  const userPoolDomain = requiredResource(
    templatePath,
    resources,
    "SearchLintUserPoolDomain"
  ).Properties;
  assertEqual(
    userPoolDomain.Domain?.Ref,
    "HostedUiDomainPrefix",
    "Cognito hosted UI domain must come from the checked domain prefix parameter"
  );
  assertEqual(
    userPoolDomain.UserPoolId?.Ref,
    "SearchLintUserPool",
    "Cognito hosted UI domain must attach to the SearchLint user pool"
  );

  const group = requiredResource(
    templatePath,
    resources,
    "SearchLintPlatformAccessGroup"
  ).Properties;
  assertEqual(
    group.GroupName,
    "searchlint-platform-access",
    "Cognito group must be the coarse platform-access group"
  );
  assertStringIncludes(
    group.Description,
    "Tenant RBAC is stored in SearchLint PostgreSQL memberships",
    "Cognito group description must preserve SearchLint-owned tenant RBAC"
  );

  const outputs = template.Outputs ?? {};
  for (const name of [
    "SearchLintCognitoIssuer",
    "SearchLintCognitoAudience",
    "SearchLintCognitoJwksUrl",
    "SearchLintCognitoTokenUse",
    "SearchLintCognitoHostedUiDomain"
  ]) {
    assertHas(outputs[name], `Cognito template must output ${name}`);
  }
  assertEqual(
    outputs.SearchLintCognitoTokenUse?.Value,
    "access",
    "Cognito token-use output must be access"
  );
}

async function verifySecretVaultTemplate() {
  const templatePath = "infra/aws/secret-vault-kms.cloudformation.json";
  const template = JSON.parse(await readFile(templatePath, "utf8"));
  const resources = template.Resources ?? {};

  const requiredResources = {
    SearchLintSecretsKey: "AWS::KMS::Key",
    SearchLintSecretsKeyAlias: "AWS::KMS::Alias",
    StripeWebhookSecret: "AWS::SecretsManager::Secret",
    OtelHeadersSecret: "AWS::SecretsManager::Secret"
  };

  for (const [name, type] of Object.entries(requiredResources)) {
    const resource = requiredResource(templatePath, resources, name);
    assertEqual(resource.Type, type, `${name} must be ${type}`);
  }

  const key = requiredResource(
    templatePath,
    resources,
    "SearchLintSecretsKey"
  ).Properties;
  assertEqual(
    key.EnableKeyRotation,
    true,
    "SearchLint secrets KMS key must enable rotation"
  );
  const keyStatements = key.KeyPolicy?.Statement ?? [];
  const accountRootStatement = keyStatements.find(
    (statement) =>
      statement.Effect === "Allow" &&
      statement.Action === "kms:*" &&
      statement.Resource === "*"
  );
  assertHas(
    accountRootStatement?.Principal?.AWS?.["Fn::Sub"],
    "SearchLint secrets KMS key must allow account-root IAM policy administration"
  );

  const alias = requiredResource(
    templatePath,
    resources,
    "SearchLintSecretsKeyAlias"
  ).Properties;
  assertStringIncludes(
    alias.AliasName?.["Fn::Sub"],
    "alias/searchlint/",
    "SearchLint secrets KMS alias must be stable and namespaced"
  );
  assertEqual(
    alias.TargetKeyId?.Ref,
    "SearchLintSecretsKey",
    "SearchLint secrets KMS alias must target the managed key"
  );

  for (const [name, runtimeName] of [
    ["StripeWebhookSecret", "SEARCHLINT_STRIPE_WEBHOOK_SECRET"],
    ["OtelHeadersSecret", "OTEL_EXPORTER_OTLP_HEADERS"]
  ]) {
    const secret = requiredResource(templatePath, resources, name).Properties;
    assertStringIncludes(
      secret.Description,
      runtimeName,
      `${name} description must name ${runtimeName}`
    );
    assertEqual(
      secret.KmsKeyId?.["Fn::GetAtt"]?.[0],
      "SearchLintSecretsKey",
      `${name} must use the SearchLint secrets KMS key`
    );
    assertHas(
      secret.GenerateSecretString,
      `${name} must generate a placeholder instead of committing plaintext`
    );
    assertEqual(
      secret.SecretString,
      undefined,
      `${name} must not commit a plaintext SecretString`
    );
  }

  const outputs = template.Outputs ?? {};
  for (const name of [
    "SearchLintSecretsKeyArn",
    "SearchLintSecretsKeyAliasName",
    "StripeWebhookSecretArn",
    "OtelHeadersSecretArn"
  ]) {
    assertHas(outputs[name], `Secret vault template must output ${name}`);
  }
}

async function verifyRdsPostgresTemplate() {
  const templatePath = "infra/aws/rds-postgres.cloudformation.json";
  const template = JSON.parse(await readFile(templatePath, "utf8"));
  const resources = template.Resources ?? {};

  const requiredResources = {
    PostgresPasswordSecret: "AWS::SecretsManager::Secret",
    PostgresSubnetGroup: "AWS::RDS::DBSubnetGroup",
    PostgresSecurityGroup: "AWS::EC2::SecurityGroup",
    PostgresInstance: "AWS::RDS::DBInstance",
    PostgresDatabaseUrlSecret: "AWS::SecretsManager::Secret"
  };

  for (const [name, type] of Object.entries(requiredResources)) {
    const resource = requiredResource(templatePath, resources, name);
    assertEqual(resource.Type, type, `${name} must be ${type}`);
  }

  const deletionProtection = template.Parameters?.DeletionProtection;
  assertEqual(
    deletionProtection?.Default,
    "true",
    "RDS deletion protection must be enabled by default"
  );
  assertIncludes(
    deletionProtection?.AllowedValues,
    "true",
    "RDS deletion protection parameter must allow true"
  );
  assertIncludes(
    deletionProtection?.AllowedValues,
    "false",
    "RDS deletion protection parameter must allow deliberate false override"
  );

  const passwordSecret = requiredResource(
    templatePath,
    resources,
    "PostgresPasswordSecret"
  ).Properties;
  assertEqual(
    passwordSecret.GenerateSecretString?.PasswordLength,
    40,
    "PostgreSQL generated password must be long enough"
  );
  assertStringIncludes(
    passwordSecret.GenerateSecretString?.ExcludeCharacters,
    "@",
    "PostgreSQL generated password must exclude URL-unsafe @"
  );
  assertStringIncludes(
    passwordSecret.GenerateSecretString?.ExcludeCharacters,
    "/",
    "PostgreSQL generated password must exclude URL-unsafe slash"
  );
  assertStringIncludes(
    passwordSecret.GenerateSecretString?.ExcludeCharacters,
    ":",
    "PostgreSQL generated password must exclude URL-unsafe colon"
  );
  assertEqual(
    passwordSecret.GenerateSecretString?.RequireEachIncludedType,
    true,
    "PostgreSQL generated password must require each included character type"
  );

  const subnetGroup = requiredResource(
    templatePath,
    resources,
    "PostgresSubnetGroup"
  ).Properties;
  assertHas(
    subnetGroup.SubnetIds?.Ref,
    "RDS subnet group must use deployment-provided private subnets"
  );

  const securityGroup = requiredResource(
    templatePath,
    resources,
    "PostgresSecurityGroup"
  ).Properties;
  const ingress = securityGroup.SecurityGroupIngress ?? [];
  assertEqual(
    ingress.length,
    2,
    "RDS security group must only allow API and worker ingress"
  );
  for (const sourceRef of [
    "ApiServiceSecurityGroupId",
    "WorkerServiceSecurityGroupId"
  ]) {
    const rule = ingress.find(
      (candidate) => candidate.SourceSecurityGroupId?.Ref === sourceRef
    );
    assertHas(rule, `RDS security group must allow ${sourceRef}`);
    assertEqual(
      rule?.IpProtocol,
      "tcp",
      `RDS ${sourceRef} ingress must be TCP`
    );
    assertEqual(
      rule?.FromPort,
      5432,
      `RDS ${sourceRef} ingress must start at port 5432`
    );
    assertEqual(
      rule?.ToPort,
      5432,
      `RDS ${sourceRef} ingress must end at port 5432`
    );
  }

  const instance = requiredResource(
    templatePath,
    resources,
    "PostgresInstance"
  ).Properties;
  assertEqual(instance.Engine, "postgres", "RDS instance must use PostgreSQL");
  assertEqual(
    instance.StorageEncrypted,
    true,
    "RDS instance storage must be encrypted"
  );
  assertEqual(
    instance.PubliclyAccessible,
    false,
    "RDS instance must not be publicly accessible"
  );
  assertHas(
    instance.MasterUserPassword?.["Fn::Sub"],
    "RDS instance password must use the generated secret"
  );
  assertEqual(instance.StorageType, "gp3", "RDS instance must use gp3 storage");
  assertHas(
    instance.DeletionProtection?.["Fn::If"],
    "RDS instance deletion protection must be parameterized"
  );

  const databaseUrlSecret = requiredResource(
    templatePath,
    resources,
    "PostgresDatabaseUrlSecret"
  ).Properties;
  assertStringIncludes(
    databaseUrlSecret.Description,
    "SEARCHLINT_POSTGRES_DATABASE_URL",
    "Database URL secret description must name the runtime env variable"
  );
  const secretSub = databaseUrlSecret.SecretString?.["Fn::Sub"];
  assertHas(secretSub, "Database URL secret must compose a PostgreSQL URL");
  assertStringIncludes(
    secretSub?.[0],
    "postgres://",
    "Database URL secret must use the postgres scheme"
  );
  assertStringIncludes(
    secretSub?.[0],
    "EndpointAddress",
    "Database URL secret must include the RDS endpoint address"
  );
  assertStringIncludes(
    secretSub?.[0],
    "EndpointPort",
    "Database URL secret must include the RDS endpoint port"
  );

  const outputs = template.Outputs ?? {};
  for (const name of [
    "PostgresDatabaseUrlSecretArn",
    "PostgresEndpointAddress",
    "PostgresEndpointPort",
    "PostgresSecurityGroupId",
    "PostgresSslMode"
  ]) {
    assertHas(outputs[name], `RDS template must output ${name}`);
  }
  assertEqual(
    outputs.PostgresSslMode?.Value,
    "require",
    "RDS template must output SEARCHLINT_POSTGRES_SSL_MODE=require"
  );
}

async function verifyArtifactStorageTemplate() {
  const templatePath = "infra/aws/artifact-storage-s3.cloudformation.json";
  const template = JSON.parse(await readFile(templatePath, "utf8"));
  const resources = template.Resources ?? {};

  const requiredResources = {
    ArtifactAccessLogBucket: "AWS::S3::Bucket",
    ArtifactAccessLogBucketPolicy: "AWS::S3::BucketPolicy",
    CrawlArtifactBucket: "AWS::S3::Bucket",
    ReportArtifactBucket: "AWS::S3::Bucket",
    CrawlArtifactBucketPolicy: "AWS::S3::BucketPolicy",
    ReportArtifactBucketPolicy: "AWS::S3::BucketPolicy"
  };

  for (const [name, type] of Object.entries(requiredResources)) {
    const resource = requiredResource(templatePath, resources, name);
    assertEqual(resource.Type, type, `${name} must be ${type}`);
  }

  assertEqual(
    template.Parameters?.CrawlArtifactExpirationDays?.Default,
    14,
    "Crawl artifact lifecycle expiration must default to short retention"
  );

  const crawlBucket = requiredResource(
    templatePath,
    resources,
    "CrawlArtifactBucket"
  ).Properties;
  const reportBucket = requiredResource(
    templatePath,
    resources,
    "ReportArtifactBucket"
  ).Properties;
  const accessLogBucket = requiredResource(
    templatePath,
    resources,
    "ArtifactAccessLogBucket"
  ).Properties;

  for (const [label, bucket] of [
    ["Crawl artifact bucket", crawlBucket],
    ["Report artifact bucket", reportBucket]
  ]) {
    assertPublicAccessBlocked(bucket, label);
    assertBucketOwnerEnforced(bucket, label);
    assertBucketEncrypted(bucket, label);
    assertEqual(
      bucket.VersioningConfiguration?.Status,
      "Enabled",
      `${label} must enable versioning`
    );
    assertEqual(
      bucket.LoggingConfiguration?.DestinationBucketName?.Ref,
      "ArtifactAccessLogBucket",
      `${label} must write S3 server access logs`
    );
  }

  assertPublicAccessBlocked(accessLogBucket, "Artifact access log bucket");
  assertBucketEncrypted(accessLogBucket, "Artifact access log bucket");
  assertEqual(
    accessLogBucket.VersioningConfiguration?.Status,
    "Enabled",
    "Artifact access log bucket must enable versioning"
  );
  assertHas(
    accessLogBucket.LifecycleConfiguration?.Rules?.find(
      (rule) => rule.Id === "expire-artifact-access-logs"
    ),
    "Artifact access log bucket must retain logs through lifecycle policy"
  );

  const crawlLifecycleRules = crawlBucket.LifecycleConfiguration?.Rules ?? [];
  const crawlExpirationRule = crawlLifecycleRules.find(
    (rule) => rule.Id === "expire-raw-crawl-artifacts"
  );
  assertHas(
    crawlExpirationRule,
    "Crawl artifact bucket must expire raw crawl artifacts"
  );
  assertEqual(
    crawlExpirationRule?.Status,
    "Enabled",
    "Crawl artifact expiration rule must be enabled"
  );
  assertHas(
    crawlExpirationRule?.Prefix?.["Fn::Sub"],
    "Crawl artifact expiration rule must be scoped by prefix"
  );
  assertHas(
    crawlExpirationRule?.ExpirationInDays?.Ref,
    "Crawl artifact expiration must use the retention parameter"
  );
  assertHas(
    crawlExpirationRule?.NoncurrentVersionExpiration?.NoncurrentDays?.Ref,
    "Crawl artifact expiration must remove noncurrent versions"
  );

  const reportLifecycleRules = reportBucket.LifecycleConfiguration?.Rules ?? [];
  const reportDeletionRule = reportLifecycleRules.find(
    (rule) => rule.ExpirationInDays !== undefined
  );
  assertEqual(
    reportDeletionRule,
    undefined,
    "Report artifact bucket must not bypass metadata retention with lifecycle expiration"
  );
  assertHas(
    reportLifecycleRules.find(
      (rule) => rule.AbortIncompleteMultipartUpload !== undefined
    ),
    "Report artifact bucket must abort incomplete multipart uploads"
  );

  assertTlsOnlyBucketPolicy(
    requiredResource(templatePath, resources, "ArtifactAccessLogBucketPolicy"),
    "ArtifactAccessLogBucket"
  );
  assertTlsOnlyBucketPolicy(
    requiredResource(templatePath, resources, "CrawlArtifactBucketPolicy"),
    "CrawlArtifactBucket"
  );
  assertTlsOnlyBucketPolicy(
    requiredResource(templatePath, resources, "ReportArtifactBucketPolicy"),
    "ReportArtifactBucket"
  );

  const outputs = template.Outputs ?? {};
  for (const name of [
    "CrawlArtifactBucketName",
    "CrawlArtifactBucketArn",
    "CrawlArtifactKeyPrefix",
    "ReportArtifactBucketName",
    "ReportArtifactBucketArn",
    "ArtifactAccessLogBucketName",
    "ArtifactAccessLogBucketArn"
  ]) {
    assertHas(outputs[name], `S3 artifact template must output ${name}`);
  }
}

async function verifyDashboardStaticHostingTemplate() {
  const templatePath = "infra/aws/dashboard-static-hosting.cloudformation.json";
  const template = JSON.parse(await readFile(templatePath, "utf8"));
  const resources = template.Resources ?? {};

  const requiredResources = {
    DashboardAssetBucket: "AWS::S3::Bucket",
    DashboardAssetBucketPolicy: "AWS::S3::BucketPolicy",
    DashboardCloudFrontOriginAccessControl:
      "AWS::CloudFront::OriginAccessControl",
    DashboardResponseHeadersPolicy: "AWS::CloudFront::ResponseHeadersPolicy",
    DashboardCloudFrontDistribution: "AWS::CloudFront::Distribution"
  };

  for (const [name, type] of Object.entries(requiredResources)) {
    const resource = requiredResource(templatePath, resources, name);
    assertEqual(resource.Type, type, `${name} must be ${type}`);
  }

  const bucket = requiredResource(
    templatePath,
    resources,
    "DashboardAssetBucket"
  ).Properties;
  assertPublicAccessBlocked(bucket, "Dashboard asset bucket");
  assertBucketOwnerEnforced(bucket, "Dashboard asset bucket");
  assertBucketEncrypted(bucket, "Dashboard asset bucket");
  assertEqual(
    bucket.VersioningConfiguration?.Status,
    "Enabled",
    "Dashboard asset bucket must enable versioning"
  );

  const bucketPolicy = requiredResource(
    templatePath,
    resources,
    "DashboardAssetBucketPolicy"
  );
  assertTlsOnlyBucketPolicy(bucketPolicy, "DashboardAssetBucket");
  const bucketPolicyJson = JSON.stringify(
    bucketPolicy.Properties?.PolicyDocument ?? {}
  );
  assertStringIncludes(
    bucketPolicyJson,
    "cloudfront.amazonaws.com",
    "Dashboard bucket policy must allow CloudFront service principal"
  );
  assertStringIncludes(
    bucketPolicyJson,
    "s3:GetObject",
    "Dashboard bucket policy must allow CloudFront object reads"
  );
  assertStringIncludes(
    bucketPolicyJson,
    "AWS:SourceArn",
    "Dashboard bucket policy must restrict CloudFront reads by distribution ARN"
  );

  const originAccessControl = requiredResource(
    templatePath,
    resources,
    "DashboardCloudFrontOriginAccessControl"
  ).Properties?.OriginAccessControlConfig;
  assertEqual(
    originAccessControl?.OriginAccessControlOriginType,
    "s3",
    "Dashboard CloudFront OAC must target S3"
  );
  assertEqual(
    originAccessControl?.SigningBehavior,
    "always",
    "Dashboard CloudFront OAC must always sign origin requests"
  );
  assertEqual(
    originAccessControl?.SigningProtocol,
    "sigv4",
    "Dashboard CloudFront OAC must use sigv4"
  );

  const headersPolicy = requiredResource(
    templatePath,
    resources,
    "DashboardResponseHeadersPolicy"
  ).Properties?.ResponseHeadersPolicyConfig;
  const securityHeaders = headersPolicy?.SecurityHeadersConfig ?? {};
  assertHas(
    securityHeaders.ContentSecurityPolicy?.ContentSecurityPolicy?.Ref,
    "Dashboard response headers policy must set a CSP parameter"
  );
  assertEqual(
    securityHeaders.FrameOptions?.FrameOption,
    "DENY",
    "Dashboard response headers policy must deny framing"
  );
  assertEqual(
    securityHeaders.ContentTypeOptions?.Override,
    true,
    "Dashboard response headers policy must enable content type options"
  );
  assertEqual(
    securityHeaders.StrictTransportSecurity?.AccessControlMaxAgeSec,
    31536000,
    "Dashboard response headers policy must set one-year HSTS"
  );

  const distribution = requiredResource(
    templatePath,
    resources,
    "DashboardCloudFrontDistribution"
  ).Properties?.DistributionConfig;
  assertEqual(
    distribution?.Enabled,
    true,
    "Dashboard CloudFront distribution must be enabled"
  );
  assertEqual(
    distribution?.DefaultRootObject,
    "index.html",
    "Dashboard CloudFront distribution must serve index.html by default"
  );
  assertEqual(
    distribution?.HttpVersion,
    "http2and3",
    "Dashboard CloudFront distribution must enable HTTP/2 and HTTP/3"
  );
  assertEqual(
    distribution?.IPV6Enabled,
    true,
    "Dashboard CloudFront distribution must enable IPv6"
  );
  assertEqual(
    distribution?.ViewerCertificate?.CloudFrontDefaultCertificate,
    true,
    "Dashboard CloudFront distribution must be deployable before custom domain proof"
  );
  assertEqual(
    distribution?.ViewerCertificate?.MinimumProtocolVersion,
    "TLSv1.2_2021",
    "Dashboard CloudFront distribution must require TLS 1.2+"
  );

  const origin = distribution?.Origins?.[0];
  assertEqual(
    origin?.Id,
    "dashboard-s3-origin",
    "Dashboard CloudFront origin id must be stable"
  );
  assertHas(
    origin?.DomainName?.["Fn::GetAtt"],
    "Dashboard CloudFront origin must use the S3 regional domain name"
  );
  assertHas(
    origin?.OriginAccessControlId?.Ref,
    "Dashboard CloudFront origin must use origin access control"
  );
  assertHas(
    origin?.S3OriginConfig,
    "Dashboard CloudFront origin must be an S3 origin"
  );

  const cacheBehavior = distribution?.DefaultCacheBehavior ?? {};
  assertEqual(
    cacheBehavior.TargetOriginId,
    "dashboard-s3-origin",
    "Dashboard CloudFront cache behavior must target the dashboard S3 origin"
  );
  assertEqual(
    cacheBehavior.ViewerProtocolPolicy,
    "redirect-to-https",
    "Dashboard CloudFront cache behavior must redirect HTTP to HTTPS"
  );
  assertEqual(
    cacheBehavior.Compress,
    true,
    "Dashboard CloudFront cache behavior must enable compression"
  );
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assertIncludes(
      cacheBehavior.AllowedMethods,
      method,
      `Dashboard CloudFront cache behavior must allow ${method}`
    );
    assertIncludes(
      cacheBehavior.CachedMethods,
      method,
      `Dashboard CloudFront cache behavior must cache ${method}`
    );
  }
  assertHas(
    cacheBehavior.ResponseHeadersPolicyId?.Ref,
    "Dashboard CloudFront cache behavior must attach security headers"
  );

  for (const statusCode of [403, 404]) {
    const response = distribution?.CustomErrorResponses?.find(
      (entry) => entry.ErrorCode === statusCode
    );
    assertHas(
      response,
      `Dashboard CloudFront distribution must map ${statusCode} to index.html`
    );
    assertEqual(
      response?.ResponseCode,
      200,
      `Dashboard CloudFront ${statusCode} fallback must return 200`
    );
    assertEqual(
      response?.ResponsePagePath,
      "/index.html",
      `Dashboard CloudFront ${statusCode} fallback must serve index.html`
    );
  }

  const outputs = template.Outputs ?? {};
  for (const name of [
    "DashboardAssetBucketName",
    "DashboardCloudFrontDistributionId",
    "DashboardCloudFrontDomainName",
    "DashboardBaseUrl"
  ]) {
    assertHas(outputs[name], `Dashboard hosting template must output ${name}`);
  }
}

async function verifyObservabilityTemplate() {
  const templatePath = "infra/aws/observability-cloudwatch.cloudformation.json";
  const template = JSON.parse(await readFile(templatePath, "utf8"));
  const resources = template.Resources ?? {};

  const requiredResources = {
    CloudApiLogGroup: "AWS::Logs::LogGroup",
    CrawlerWorkerLogGroup: "AWS::Logs::LogGroup",
    ReportArtifactCleanupLogGroup: "AWS::Logs::LogGroup",
    ApiServerErrorMetricFilter: "AWS::Logs::MetricFilter",
    ApiTimeoutMetricFilter: "AWS::Logs::MetricFilter",
    CrawlerFailureMetricFilter: "AWS::Logs::MetricFilter",
    ReportCleanupFailureMetricFilter: "AWS::Logs::MetricFilter",
    WorkerErrorMetricFilter: "AWS::Logs::MetricFilter",
    ApiServerErrorAlarm: "AWS::CloudWatch::Alarm",
    ApiTimeoutAlarm: "AWS::CloudWatch::Alarm",
    CrawlerFailureAlarm: "AWS::CloudWatch::Alarm",
    ReportCleanupFailureAlarm: "AWS::CloudWatch::Alarm",
    WorkerErrorAlarm: "AWS::CloudWatch::Alarm"
  };

  for (const [name, type] of Object.entries(requiredResources)) {
    const resource = requiredResource(templatePath, resources, name);
    assertEqual(resource.Type, type, `${name} must be ${type}`);
  }

  assertEqual(
    template.Parameters?.LogRetentionDays?.Default,
    30,
    "Observability log retention must default to 30 days"
  );

  const logGroups = {
    CloudApiLogGroup: "cloud-api",
    CrawlerWorkerLogGroup: "crawler-worker",
    ReportArtifactCleanupLogGroup: "report-artifact-cleanup"
  };

  for (const [name, suffix] of Object.entries(logGroups)) {
    const logGroup = requiredResource(templatePath, resources, name).Properties;
    assertStringIncludes(
      logGroup.LogGroupName?.["Fn::Sub"],
      `/aws/ecs/searchlint/\${EnvironmentName}/${suffix}`,
      `${name} must use the checked ECS log group path`
    );
    assertEqual(
      logGroup.RetentionInDays?.Ref,
      "LogRetentionDays",
      `${name} must use the retention parameter`
    );
    assertEqual(
      logGroup.KmsKeyId?.Ref,
      "KmsKeyArn",
      `${name} must use the deployment-provided KMS key ARN`
    );
  }

  const metricFilters = {
    ApiServerErrorMetricFilter: {
      logGroup: "CloudApiLogGroup",
      metric: "ApiServerErrors"
    },
    ApiTimeoutMetricFilter: {
      logGroup: "CloudApiLogGroup",
      metric: "ApiTimedOutRequests"
    },
    CrawlerFailureMetricFilter: {
      logGroup: "CrawlerWorkerLogGroup",
      metric: "CrawlerFailedJobs"
    },
    ReportCleanupFailureMetricFilter: {
      logGroup: "ReportArtifactCleanupLogGroup",
      metric: "ReportArtifactCleanupFailed"
    },
    WorkerErrorMetricFilter: {
      logGroup: "CrawlerWorkerLogGroup",
      metric: "WorkerErrors"
    }
  };

  for (const [name, expected] of Object.entries(metricFilters)) {
    const metricFilter = requiredResource(
      templatePath,
      resources,
      name
    ).Properties;
    assertEqual(
      metricFilter.LogGroupName?.Ref,
      expected.logGroup,
      `${name} must target ${expected.logGroup}`
    );
    assertHas(metricFilter.FilterPattern, `${name} must define a pattern`);
    const transformation = metricFilter.MetricTransformations?.[0];
    assertEqual(
      transformation?.MetricNamespace,
      "SearchLint/Cloud",
      `${name} must publish to the SearchLint/Cloud namespace`
    );
    assertEqual(
      transformation?.MetricName,
      expected.metric,
      `${name} must publish the expected metric`
    );
  }

  const alarms = {
    ApiServerErrorAlarm: "ApiServerErrors",
    ApiTimeoutAlarm: "ApiTimedOutRequests",
    CrawlerFailureAlarm: "CrawlerFailedJobs",
    ReportCleanupFailureAlarm: "ReportArtifactCleanupFailed",
    WorkerErrorAlarm: "WorkerErrors"
  };

  for (const [name, metricName] of Object.entries(alarms)) {
    const alarm = requiredResource(templatePath, resources, name).Properties;
    assertEqual(
      alarm.Namespace,
      "SearchLint/Cloud",
      `${name} must read from the SearchLint/Cloud namespace`
    );
    assertEqual(
      alarm.MetricName,
      metricName,
      `${name} must read ${metricName}`
    );
    assertEqual(alarm.Statistic, "Sum", `${name} must alarm on metric sums`);
    assertEqual(
      alarm.ComparisonOperator,
      "GreaterThanThreshold",
      `${name} must alarm above the threshold`
    );
    assertEqual(alarm.Threshold, 0, `${name} must alarm on any matching event`);
    assertEqual(
      alarm.EvaluationPeriods?.Ref,
      "AlarmEvaluationPeriods",
      `${name} must use the alarm evaluation-period parameter`
    );
    assertEqual(
      alarm.Period?.Ref,
      "AlarmPeriodSeconds",
      `${name} must use the alarm period parameter`
    );
    assertEqual(
      alarm.TreatMissingData,
      "notBreaching",
      `${name} must treat missing data as not breaching`
    );
  }

  const outputs = template.Outputs ?? {};
  for (const name of [
    "CloudApiLogGroupName",
    "CrawlerWorkerLogGroupName",
    "ReportArtifactCleanupLogGroupName",
    "ApiServerErrorAlarmName",
    "ApiTimeoutAlarmName",
    "CrawlerFailureAlarmName",
    "ReportCleanupFailureAlarmName",
    "WorkerErrorAlarmName"
  ]) {
    assertHas(outputs[name], `Observability template must output ${name}`);
  }
}

async function verifyCloudApiTemplate() {
  const templatePath = "infra/aws/cloud-api-ecs-fargate.cloudformation.json";
  const template = JSON.parse(await readFile(templatePath, "utf8"));
  const resources = template.Resources ?? {};
  assertOtelHeadersSecretWiring(template, templatePath);

  const requiredResources = {
    CloudApiLogGroup: "AWS::Logs::LogGroup",
    CloudApiLoadBalancerSecurityGroup: "AWS::EC2::SecurityGroup",
    CloudApiServiceSecurityGroup: "AWS::EC2::SecurityGroup",
    CloudApiLoadBalancer: "AWS::ElasticLoadBalancingV2::LoadBalancer",
    CloudApiTargetGroup: "AWS::ElasticLoadBalancingV2::TargetGroup",
    CloudApiListener: "AWS::ElasticLoadBalancingV2::Listener",
    CloudApiTaskExecutionRole: "AWS::IAM::Role",
    CloudApiTaskRole: "AWS::IAM::Role",
    CloudApiTaskDefinition: "AWS::ECS::TaskDefinition",
    CloudApiService: "AWS::ECS::Service",
    CloudApiHttpApi: "AWS::ApiGatewayV2::Api",
    CloudApiVpcLink: "AWS::ApiGatewayV2::VpcLink",
    CloudApiIntegration: "AWS::ApiGatewayV2::Integration",
    CloudApiDefaultRoute: "AWS::ApiGatewayV2::Route",
    CloudApiHealthRoute: "AWS::ApiGatewayV2::Route",
    CloudApiStage: "AWS::ApiGatewayV2::Stage"
  };

  for (const [name, type] of Object.entries(requiredResources)) {
    const resource = requiredResource(templatePath, resources, name);
    assertEqual(resource.Type, type, `${name} must be ${type}`);
  }

  const api = requiredResource(templatePath, resources, "CloudApiHttpApi");
  assertEqual(
    api.Properties?.ProtocolType,
    "HTTP",
    "Cloud API ingress must be API Gateway HTTP API"
  );

  const integration = requiredResource(
    templatePath,
    resources,
    "CloudApiIntegration"
  ).Properties;
  assertEqual(
    integration.IntegrationType,
    "HTTP_PROXY",
    "Cloud API integration must proxy to the load balancer"
  );
  assertEqual(
    integration.ConnectionType,
    "VPC_LINK",
    "Cloud API integration must use VPC Link"
  );
  assertEqual(
    integration.IntegrationMethod,
    "ANY",
    "Cloud API integration must forward all methods"
  );

  const defaultRoute = requiredResource(
    templatePath,
    resources,
    "CloudApiDefaultRoute"
  ).Properties;
  assertEqual(
    defaultRoute.RouteKey,
    "$default",
    "Cloud API must define a default route"
  );
  const healthRoute = requiredResource(
    templatePath,
    resources,
    "CloudApiHealthRoute"
  ).Properties;
  assertEqual(
    healthRoute.RouteKey,
    "GET /healthz",
    "Cloud API must expose the health route through API Gateway"
  );
  const stage = requiredResource(templatePath, resources, "CloudApiStage");
  assertEqual(stage.Properties?.StageName, "v1", "Cloud API stage must be v1");
  assertEqual(
    stage.Properties?.AutoDeploy,
    true,
    "Cloud API stage must auto-deploy checked template changes"
  );

  const loadBalancer = requiredResource(
    templatePath,
    resources,
    "CloudApiLoadBalancer"
  ).Properties;
  assertEqual(
    loadBalancer.Scheme,
    "internal",
    "Cloud API load balancer must be internal"
  );
  assertEqual(
    loadBalancer.Type,
    "application",
    "Cloud API load balancer must be an ALB"
  );
  const targetGroup = requiredResource(
    templatePath,
    resources,
    "CloudApiTargetGroup"
  ).Properties;
  assertEqual(
    targetGroup.Port,
    3000,
    "Cloud API target group must use port 3000"
  );
  assertEqual(
    targetGroup.TargetType,
    "ip",
    "Cloud API target group must use ip targets for Fargate"
  );
  assertEqual(
    targetGroup.HealthCheckPath,
    "/healthz",
    "Cloud API target group must use the API health path"
  );

  const task =
    requiredResource(templatePath, resources, "CloudApiTaskDefinition")
      .Properties ?? {};
  assertIncludes(
    task.RequiresCompatibilities,
    "FARGATE",
    "Cloud API task definition must require Fargate"
  );
  assertEqual(
    task.NetworkMode,
    "awsvpc",
    "Cloud API task definition must use awsvpc networking"
  );
  const container = task.ContainerDefinitions?.[0];
  assertHas(container, "Cloud API task must define a container");
  assertEqual(
    container.Name,
    "cloud-api",
    "Cloud API container name must be stable"
  );
  assertDeepEqual(
    container.Command,
    ["node", "dist/src/bin.js"],
    "Cloud API container must run the API executable"
  );
  assertEqual(
    container.PortMappings?.[0]?.ContainerPort,
    3000,
    "Cloud API container must expose port 3000"
  );
  assertEqual(
    container.LogConfiguration?.LogDriver,
    "awslogs",
    "Cloud API container must use awslogs"
  );

  const env = objectByName(container.Environment ?? []);
  for (const name of [
    "SEARCHLINT_API_HOST",
    "SEARCHLINT_API_PORT",
    "SEARCHLINT_POSTGRES_SSL_MODE",
    "SEARCHLINT_API_RATE_LIMIT_STORE",
    "SEARCHLINT_API_RATE_LIMIT_WINDOW_MS",
    "SEARCHLINT_API_RATE_LIMIT_MAX_REQUESTS",
    "SEARCHLINT_API_DISPATCH_TIMEOUT_MS",
    "SEARCHLINT_API_MAX_BODY_BYTES",
    "SEARCHLINT_COGNITO_ISSUER",
    "SEARCHLINT_COGNITO_AUDIENCE",
    "SEARCHLINT_COGNITO_JWKS_URL",
    "SEARCHLINT_COGNITO_TOKEN_USE",
    "OTEL_SERVICE_NAME",
    "SEARCHLINT_ENVIRONMENT",
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "OTEL_EXPORTER_OTLP_PROTOCOL",
    "OTEL_EXPORTER_OTLP_TIMEOUT"
  ]) {
    assertHas(
      env.get(name),
      `${name} must be declared as a Cloud API environment variable`
    );
  }
  assertEqual(
    env.get("SEARCHLINT_API_HOST")?.Value,
    "0.0.0.0",
    "Cloud API host must bind all container interfaces"
  );
  assertEqual(
    env.get("SEARCHLINT_API_PORT")?.Value,
    "3000",
    "Cloud API port must match the deployment contract"
  );
  assertEqual(
    env.get("SEARCHLINT_API_RATE_LIMIT_STORE")?.Value,
    "postgres",
    "Cloud API must use the PostgreSQL distributed rate limit store"
  );
  assertEqual(
    env.get("OTEL_EXPORTER_OTLP_PROTOCOL")?.Value,
    "http/protobuf",
    "Cloud API OTLP protocol must be http/protobuf"
  );
  assertHas(
    env.get("SEARCHLINT_COGNITO_ISSUER")?.Value,
    "Cloud API must receive the Cognito issuer"
  );
  assertHas(
    env.get("SEARCHLINT_COGNITO_AUDIENCE")?.Value,
    "Cloud API must receive the Cognito audience"
  );
  assertHas(
    env.get("SEARCHLINT_COGNITO_JWKS_URL")?.Value,
    "Cloud API must receive the Cognito JWKS URL"
  );
  assertEqual(
    env.get("SEARCHLINT_COGNITO_TOKEN_USE")?.Value?.Ref,
    "CognitoTokenUse",
    "Cloud API Cognito token-use must come from the checked CognitoTokenUse parameter"
  );

  const secrets = objectByName(container.Secrets ?? []);
  for (const name of [
    "SEARCHLINT_POSTGRES_DATABASE_URL",
    "SEARCHLINT_STRIPE_WEBHOOK_SECRET"
  ]) {
    assertHas(
      secrets.get(name),
      `${name} must be sourced from Secrets Manager`
    );
    assertPlaintextSecretAbsent(env, name);
  }
  assertPlaintextSecretAbsent(env, "OTEL_EXPORTER_OTLP_HEADERS");

  const service = requiredResource(
    templatePath,
    resources,
    "CloudApiService"
  ).Properties;
  assertEqual(
    service.LaunchType,
    "FARGATE",
    "Cloud API service must launch Fargate tasks"
  );
  assertEqual(
    service.NetworkConfiguration?.AwsvpcConfiguration?.AssignPublicIp,
    "DISABLED",
    "Cloud API service must not assign public IPs"
  );
  assertEqual(
    service.LoadBalancers?.[0]?.ContainerName,
    "cloud-api",
    "Cloud API service load balancer must target the API container"
  );
  assertEqual(
    service.LoadBalancers?.[0]?.ContainerPort,
    3000,
    "Cloud API service load balancer must target port 3000"
  );

  const executionRole = requiredResource(
    templatePath,
    resources,
    "CloudApiTaskExecutionRole"
  );
  assertRoleServicePrincipal(
    executionRole,
    "ecs-tasks.amazonaws.com",
    "Cloud API task execution role"
  );
  assertRoleAllows(
    executionRole,
    "logs:PutLogEvents",
    "Cloud API task execution role must write logs"
  );
  assertRoleAllows(
    executionRole,
    "secretsmanager:GetSecretValue",
    "Cloud API task execution role must read runtime secrets"
  );

  const taskRole = requiredResource(
    templatePath,
    resources,
    "CloudApiTaskRole"
  );
  assertRoleServicePrincipal(
    taskRole,
    "ecs-tasks.amazonaws.com",
    "Cloud API task role"
  );
}

async function verifyCrawlerWorkerTemplate() {
  const templatePath =
    "infra/aws/crawler-worker-ecs-fargate.cloudformation.json";
  const template = JSON.parse(await readFile(templatePath, "utf8"));
  const resources = template.Resources ?? {};
  assertOtelHeadersSecretWiring(template, templatePath);

  const requiredResources = {
    CrawlerWorkerLogGroup: "AWS::Logs::LogGroup",
    CrawlerWorkerDeadLetterQueue: "AWS::SQS::Queue",
    CrawlerWorkerQueue: "AWS::SQS::Queue",
    CrawlerWorkerServiceSecurityGroup: "AWS::EC2::SecurityGroup",
    CrawlerWorkerTaskExecutionRole: "AWS::IAM::Role",
    CrawlerWorkerTaskRole: "AWS::IAM::Role",
    CrawlerWorkerAutoscalingRole: "AWS::IAM::Role",
    CrawlerWorkerTaskDefinition: "AWS::ECS::TaskDefinition",
    CrawlerWorkerService: "AWS::ECS::Service",
    CrawlerWorkerScalableTarget: "AWS::ApplicationAutoScaling::ScalableTarget",
    CrawlerWorkerBacklogScalingPolicy:
      "AWS::ApplicationAutoScaling::ScalingPolicy"
  };

  for (const [name, type] of Object.entries(requiredResources)) {
    const resource = requiredResource(templatePath, resources, name);
    assertEqual(resource.Type, type, `${name} must be ${type}`);
  }

  const dlq = requiredResource(
    templatePath,
    resources,
    "CrawlerWorkerDeadLetterQueue"
  ).Properties;
  assertEqual(
    dlq.MessageRetentionPeriod,
    1209600,
    "Crawler worker DLQ retention must match the SQS provisioning contract"
  );
  assertEqual(
    dlq.SqsManagedSseEnabled,
    true,
    "Crawler worker DLQ must use SQS-managed encryption"
  );

  const queue = requiredResource(
    templatePath,
    resources,
    "CrawlerWorkerQueue"
  ).Properties;
  assertHas(
    queue.VisibilityTimeout,
    "Crawler worker queue must declare a visibility timeout"
  );
  assertEqual(
    queue.MessageRetentionPeriod,
    1209600,
    "Crawler worker queue retention must match the SQS provisioning contract"
  );
  assertHas(
    queue.ReceiveMessageWaitTimeSeconds,
    "Crawler worker queue must declare long polling wait time"
  );
  assertEqual(
    queue.SqsManagedSseEnabled,
    true,
    "Crawler worker queue must use SQS-managed encryption"
  );
  assertHas(
    queue.RedrivePolicy?.deadLetterTargetArn,
    "Crawler worker queue must target a DLQ"
  );
  assertEqual(
    queue.RedrivePolicy?.maxReceiveCount,
    5,
    "Crawler worker queue DLQ max receive count must match the SQS provisioning contract"
  );

  const task =
    requiredResource(templatePath, resources, "CrawlerWorkerTaskDefinition")
      .Properties ?? {};
  assertIncludes(
    task.RequiresCompatibilities,
    "FARGATE",
    "Crawler worker task definition must require Fargate"
  );
  assertEqual(
    task.NetworkMode,
    "awsvpc",
    "Crawler worker task definition must use awsvpc networking"
  );
  const container = task.ContainerDefinitions?.[0];
  assertHas(container, "Crawler worker task must define a container");
  assertEqual(
    container.Name,
    "crawler-worker",
    "Crawler worker container name must be stable"
  );
  assertDeepEqual(
    container.Command,
    ["node", "dist/src/bin.js"],
    "Crawler worker container must run the crawler executable"
  );
  assertEqual(
    container.LogConfiguration?.LogDriver,
    "awslogs",
    "Crawler worker container must use awslogs"
  );

  const env = objectByName(container.Environment ?? []);
  for (const name of [
    "SEARCHLINT_POSTGRES_SSL_MODE",
    "SEARCHLINT_CRAWL_QUEUE_URL",
    "SEARCHLINT_CRAWL_ARTIFACT_BUCKET",
    "SEARCHLINT_CRAWL_ARTIFACT_KEY_PREFIX",
    "SEARCHLINT_RULE_CATALOG_PATH",
    "SEARCHLINT_WORKER_CRAWLER_POLL_INTERVAL_MS",
    "SEARCHLINT_WORKER_CRAWLER_BATCH_SIZE",
    "SEARCHLINT_WORKER_CRAWLER_WAIT_TIME_SECONDS",
    "SEARCHLINT_WORKER_CRAWLER_VISIBILITY_TIMEOUT_SECONDS",
    "OTEL_SERVICE_NAME",
    "SEARCHLINT_ENVIRONMENT",
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "OTEL_EXPORTER_OTLP_PROTOCOL",
    "OTEL_EXPORTER_OTLP_TIMEOUT"
  ]) {
    assertHas(
      env.get(name),
      `${name} must be declared as a crawler worker environment variable`
    );
  }
  assertEqual(
    env.get("OTEL_SERVICE_NAME")?.Value,
    "searchlint-crawler-worker",
    "Crawler worker OTLP service name must be stable"
  );
  assertEqual(
    env.get("SEARCHLINT_RULE_CATALOG_PATH")?.Value,
    "/app/specs/RULE_CATALOG.yaml",
    "Crawler worker rule catalog path must point at the runtime image catalog"
  );
  assertEqual(
    env.get("OTEL_EXPORTER_OTLP_PROTOCOL")?.Value,
    "http/protobuf",
    "Crawler worker OTLP protocol must be http/protobuf"
  );

  const secrets = objectByName(container.Secrets ?? []);
  assertHas(
    secrets.get("SEARCHLINT_POSTGRES_DATABASE_URL"),
    "SEARCHLINT_POSTGRES_DATABASE_URL must be sourced from Secrets Manager"
  );
  assertPlaintextSecretAbsent(env, "SEARCHLINT_POSTGRES_DATABASE_URL");
  assertPlaintextSecretAbsent(env, "OTEL_EXPORTER_OTLP_HEADERS");

  const service = requiredResource(
    templatePath,
    resources,
    "CrawlerWorkerService"
  ).Properties;
  assertEqual(
    service.LaunchType,
    "FARGATE",
    "Crawler worker service must launch Fargate tasks"
  );
  assertEqual(
    service.NetworkConfiguration?.AwsvpcConfiguration?.AssignPublicIp,
    "DISABLED",
    "Crawler worker service must not assign public IPs"
  );
  const scalableTarget = requiredResource(
    templatePath,
    resources,
    "CrawlerWorkerScalableTarget"
  ).Properties;
  assertDeepEqual(
    scalableTarget.MinCapacity,
    { Ref: "WorkerMinCapacity" },
    "Crawler worker scalable target must use WorkerMinCapacity"
  );
  assertDeepEqual(
    scalableTarget.MaxCapacity,
    { Ref: "WorkerMaxCapacity" },
    "Crawler worker scalable target must use WorkerMaxCapacity"
  );
  assertEqual(
    scalableTarget.ServiceNamespace,
    "ecs",
    "Crawler worker autoscaling namespace must be ECS"
  );
  assertEqual(
    scalableTarget.ScalableDimension,
    "ecs:service:DesiredCount",
    "Crawler worker autoscaling dimension must scale ECS desired count"
  );
  assertStringIncludes(
    JSON.stringify(scalableTarget.ResourceId),
    "CrawlerWorkerService.Name",
    "Crawler worker scalable target must reference the ECS service name"
  );

  const scalingPolicy = requiredResource(
    templatePath,
    resources,
    "CrawlerWorkerBacklogScalingPolicy"
  ).Properties;
  assertEqual(
    scalingPolicy.PolicyType,
    "TargetTrackingScaling",
    "Crawler worker scaling policy must use target tracking"
  );
  const targetTracking =
    scalingPolicy.TargetTrackingScalingPolicyConfiguration ?? {};
  assertDeepEqual(
    targetTracking.TargetValue,
    { Ref: "WorkerTargetBacklogPerTask" },
    "Crawler worker scaling policy must use WorkerTargetBacklogPerTask"
  );
  assertEqual(
    targetTracking.ScaleInCooldown,
    300,
    "Crawler worker scale-in cooldown must be 300 seconds"
  );
  assertEqual(
    targetTracking.ScaleOutCooldown,
    60,
    "Crawler worker scale-out cooldown must be 60 seconds"
  );
  assertEqual(
    targetTracking.DisableScaleIn,
    false,
    "Crawler worker scaling policy must allow scale-in"
  );
  assertEqual(
    targetTracking.CustomizedMetricSpecification?.Namespace,
    "AWS/SQS",
    "Crawler worker scaling policy must use SQS queue metrics"
  );
  assertEqual(
    targetTracking.CustomizedMetricSpecification?.MetricName,
    "ApproximateNumberOfMessagesVisible",
    "Crawler worker scaling policy must use visible SQS backlog"
  );
  assertStringIncludes(
    JSON.stringify(
      targetTracking.CustomizedMetricSpecification?.Dimensions ?? []
    ),
    "CrawlerWorkerQueue",
    "Crawler worker scaling policy must target the crawl request queue"
  );

  const executionRole = requiredResource(
    templatePath,
    resources,
    "CrawlerWorkerTaskExecutionRole"
  );
  assertRoleServicePrincipal(
    executionRole,
    "ecs-tasks.amazonaws.com",
    "Crawler worker task execution role"
  );
  assertRoleAllows(
    executionRole,
    "logs:PutLogEvents",
    "Crawler worker task execution role must write logs"
  );
  assertRoleAllows(
    executionRole,
    "secretsmanager:GetSecretValue",
    "Crawler worker task execution role must read the PostgreSQL database URL secret"
  );

  const taskRole = requiredResource(
    templatePath,
    resources,
    "CrawlerWorkerTaskRole"
  );
  assertRoleServicePrincipal(
    taskRole,
    "ecs-tasks.amazonaws.com",
    "Crawler worker task role"
  );
  for (const action of [
    "sqs:ReceiveMessage",
    "sqs:DeleteMessage",
    "sqs:ChangeMessageVisibility",
    "sqs:GetQueueAttributes",
    "s3:PutObject"
  ]) {
    assertRoleAllows(
      taskRole,
      action,
      `Crawler worker task role must allow ${action}`
    );
  }
  assertRolePolicyJsonIncludes(
    taskRole,
    "kms:GenerateDataKey",
    "Crawler worker task role must allow KMS data key generation for KMS-encrypted artifact writes"
  );

  const autoscalingRole = requiredResource(
    templatePath,
    resources,
    "CrawlerWorkerAutoscalingRole"
  );
  assertRoleServicePrincipal(
    autoscalingRole,
    "application-autoscaling.amazonaws.com",
    "Crawler worker autoscaling role"
  );
  for (const action of [
    "application-autoscaling:RegisterScalableTarget",
    "application-autoscaling:PutScalingPolicy",
    "cloudwatch:PutMetricAlarm",
    "sqs:GetQueueAttributes",
    "ecs:DescribeServices",
    "ecs:UpdateService"
  ]) {
    assertRoleAllows(
      autoscalingRole,
      action,
      `Crawler worker autoscaling role must allow ${action}`
    );
  }
}

function requiredResource(templatePath, resources, name) {
  const resource = resources[name];
  if (!resource) {
    throw new Error(`${templatePath} is missing ${name}`);
  }
  return resource;
}

function assertRoleServicePrincipal(role, service, label) {
  const statements = role.Properties?.AssumeRolePolicyDocument?.Statement ?? [];
  const hasPrincipal = statements.some(
    (statement) => statement.Principal?.Service === service
  );
  if (!hasPrincipal) {
    throw new Error(`${label} must be assumable by ${service}`);
  }
}

function assertRoleAllows(role, action, message) {
  const statements = rolePolicyStatements(role);
  const allowed = statements.some((statement) =>
    arrayOf(statement.Action).includes(action)
  );
  if (!allowed) {
    throw new Error(message);
  }
}

function assertRolePolicyJsonIncludes(role, expected, message) {
  if (!JSON.stringify(role.Properties?.Policies ?? []).includes(expected)) {
    throw new Error(message);
  }
}

function rolePolicyStatements(role) {
  const policies = role.Properties?.Policies ?? [];
  return policies.flatMap((policy) => policy.PolicyDocument?.Statement ?? []);
}

function objectByName(values) {
  return new Map(values.map((value) => [value.Name, value]));
}

function assertPlaintextSecretAbsent(env, name) {
  if (env.has(name)) {
    throw new Error(`${name} must not be a plaintext environment variable`);
  }
}

function assertOtelHeadersSecretWiring(template, templatePath) {
  assertHas(
    template.Parameters?.OtelHeadersSecretArn,
    `${templatePath} must accept OTEL headers secret ARN`
  );
  assertHas(
    template.Conditions?.HasOtelHeadersSecret,
    `${templatePath} must conditionally wire OTEL headers secret`
  );
  const serialized = JSON.stringify(template);
  assertStringIncludes(
    serialized,
    "OTEL_EXPORTER_OTLP_HEADERS",
    `${templatePath} must inject OTEL headers through ECS secrets`
  );
  assertStringIncludes(
    serialized,
    "OtelHeadersSecretArn",
    `${templatePath} must reference the OTEL headers secret ARN`
  );
}

function assertPublicAccessBlocked(bucket, label) {
  const config = bucket.PublicAccessBlockConfiguration ?? {};
  for (const key of [
    "BlockPublicAcls",
    "BlockPublicPolicy",
    "IgnorePublicAcls",
    "RestrictPublicBuckets"
  ]) {
    assertEqual(config[key], true, `${label} must set ${key}`);
  }
}

function assertBucketOwnerEnforced(bucket, label) {
  const rules = bucket.OwnershipControls?.Rules ?? [];
  assertHas(
    rules.find((rule) => rule.ObjectOwnership === "BucketOwnerEnforced"),
    `${label} must enforce bucket-owner object ownership`
  );
}

function assertBucketEncrypted(bucket, label) {
  const encryption =
    bucket.BucketEncryption?.ServerSideEncryptionConfiguration?.[0];
  assertHas(encryption, `${label} must configure server-side encryption`);
  assertHas(
    encryption.ServerSideEncryptionByDefault?.SSEAlgorithm,
    `${label} must declare an SSE algorithm`
  );
}

function assertTlsOnlyBucketPolicy(policyResource, bucketResourceName) {
  const statements = policyResource.Properties?.PolicyDocument?.Statement ?? [];
  const denyInsecureTransport = statements.find(
    (statement) =>
      statement.Effect === "Deny" &&
      statement.Principal === "*" &&
      arrayOf(statement.Action).includes("s3:*") &&
      statement.Condition?.Bool?.["aws:SecureTransport"] === "false"
  );
  assertHas(
    denyInsecureTransport,
    `${bucketResourceName} policy must deny non-TLS access`
  );
  assertStringIncludes(
    JSON.stringify(denyInsecureTransport.Resource),
    bucketResourceName,
    `${bucketResourceName} policy must cover the bucket and objects`
  );
}

function assertHas(value, message) {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
}

function assertStringIncludes(value, expected, message) {
  if (typeof value !== "string" || !value.includes(expected)) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${expected}, got ${String(actual)}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}. Expected ${JSON.stringify(expected)}`);
  }
}

function assertIncludes(values, expected, message) {
  if (!arrayOf(values).includes(expected)) {
    throw new Error(message);
  }
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [value];
}
