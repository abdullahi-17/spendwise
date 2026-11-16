# SpendWise operations guide

## Deployment boundaries and costs

The website shares its S3 bucket and CloudFront distribution with the main portfolio. Keep uploads under `spendwise/`. Do not replace the bucket, DNS, certificate, distribution or router as part of this build. The deployed role ARN in the workflow is preserved from the existing configuration; confirm its current trust and policies before the first hosted run.

The API template creates a public API Gateway REST API, Python 3.12 Lambda, execution role, bounded log group and three CloudWatch alarms. Optional email creates an SNS topic and subscription. Charges can arise from API requests, Lambda, logs, alarms, SNS, storage, transfer and cache invalidations. The template enables detailed stage metrics, which can add charges. Stage throttling is best effort, not a spending cap. There is no guaranteed free operation.

`budget.yaml` optionally creates an account-wide USD budget (default threshold USD 10). It is not a SpendWise cost estimate or an automatic spending limit. Choose the threshold for the existing account. Reuse an existing suitable budget instead of creating duplicates.

## Prepare the API release

These commands are deployment instructions, not evidence of a completed deployment. Use the existing approved AWS region; no region has been selected by this repository. Use a private artifact bucket in that region. Do not put credentials in configuration files or Git.

```sh
aws sts get-caller-identity
aws configure get region
```

Confirm the account and region. Inspect any existing `spendwise-nudge` function, stack and log group before creating a stack: the template retains those existing fixed resource names and cannot create duplicates in the same account/region. Do not delete existing resources to bypass a collision.

Set task-specific variables using your actual values:

```sh
export SPENDWISE_REGION='your-existing-region'
export SPENDWISE_ARTIFACT_BUCKET='your-private-artifact-bucket'
export SPENDWISE_ALERT_EMAIL='your-operations-email'
aws cloudformation package \
  --region "$SPENDWISE_REGION" \
  --template-file infrastructure/template.yaml \
  --s3-bucket "$SPENDWISE_ARTIFACT_BUCKET" \
  --s3-prefix spendwise-lambda \
  --output-template-file /tmp/spendwise-packaged.yaml
aws cloudformation deploy \
  --region "$SPENDWISE_REGION" \
  --template-file /tmp/spendwise-packaged.yaml \
  --stack-name spendwise-nudge \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides AllowedOrigin=https://spendwise.abdullahiomer.com AlertEmail="$SPENDWISE_ALERT_EMAIL" \
  --no-execute-changeset
```

Review the resulting change set for resource creation, replacement and costs before execution. Leave the shared hosting stack untouched. Execute only the reviewed change set, then wait for stack completion. Confirm the SNS subscription using the email AWS sends; unconfirmed subscriptions cannot deliver alerts.

Read the `ApiEndpoint` stack output and set `nudgeApiEndpoint` in `spendwise/js/demo-config.js`. Use the complete HTTPS `/prod/insight` URL. The browser falls back locally if it is unset or unavailable. For local API testing, CORS must allow the exact localhost origin; avoid changing a production stack's origin just to test locally.

API Gateway deployments are snapshots. The template uses a versioned deployment logical ID. Bump that ID and its stage reference when changing API methods/integrations so CloudFormation creates a fresh snapshot. Lambda code updates do not require a new API snapshot.

## Verify API and operations

Set `SPENDWISE_API_URL` to the stack output, then use sample answers only:

```sh
curl --fail-with-body "$SPENDWISE_API_URL" \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://spendwise.abdullahiomer.com' \
  --data '{"feeling":"Good","planned":"Been planning it","wait":"Yes, easy"}'
curl -i "$SPENDWISE_API_URL" \
  -H 'Content-Type: application/json' \
  --data '{"feeling":"unknown","planned":"Been planning it","wait":"Yes, easy"}'
curl -i -X OPTIONS "$SPENDWISE_API_URL" \
  -H 'Origin: https://spendwise.abdullahiomer.com' \
  -H 'Access-Control-Request-Method: POST'
```

Expected: a JSON insight with HTTP 200, invalid answers with HTTP 400, and preflight allowing the configured origin and POST. Check the browser Network panel as well: curl does not enforce CORS. Block the API request in browser developer tools and confirm a local insight still appears. No reflection text or camera frames belong in the request or diagnostic logs.

Inspect the Lambda log group and API/Lambda metrics after sample requests. Alarms cover API server errors, sustained API latency and Lambda throttles. Missing traffic is treated as non-breaching, so an OK alarm is not an availability test. To demonstrate notifications, use an explicitly labelled synthetic alarm-state test with a confirmed subscription, capture the test email, and let the metric evaluation restore the state. This demonstrates notification wiring, not a real outage or load test.

For budget setup, review a change set using `infrastructure/budget.yaml`, `BudgetEmail`, and `MonthlyLimitUSD` before executing it. Capture the configured thresholds and recipient with personal details redacted. Budget notifications can be delayed; confirm receipt separately when a real threshold is met. Do not manufacture spend to trigger an alert.

## Website release

Repository settings need `AWS_REGION`, `S3_BUCKET`, and `CLOUDFRONT_DISTRIBUTION_ID` secrets for the existing deployment. GitHub Actions assumes the existing `spendwise-github-deploy` role through OIDC; no AWS access key secret is needed. Its trust must match this repository and `refs/heads/main`. Apply the reviewed role-policy update granting `cloudfront:GetInvalidation` alongside `CreateInvalidation` on the existing distribution before the hosted run; the waiter needs that read permission. Editing the template alone does not update the live role.

After the pre-commit review, push to main or manually run **Deploy SpendWise** on main. Checks run before AWS access. The website artifact is retained for 30 days. Deployment copies its bytes without deleting objects, invalidates SpendWise paths, waits, and checks all released files over HTTPS. Capture the successful run ID and evidence before making another release.

Invalidations include the rewritten `/spendwise/*` paths and browser-facing demo asset paths. A distribution is shared across hostnames: root `/js/*` and `/css/*` invalidations can also evict main-portfolio cached assets. They do not edit origin objects but may cause additional origin fetches. The IAM policy scopes the distribution, not individual invalidation paths.

## Website rollback drill

1. Publish a known-good release A and record its successful run ID.
2. Publish release B with a harmless visible change and capture its public result.
3. Run **Roll back SpendWise** from main, entering release A's run ID.
4. Confirm provenance and manifest checks, upload, completed cache invalidation, and public-byte comparison all pass.
5. Capture restored content and the rollback run. Record the time taken and any observed failure.

Rollback uses the same concurrency group as deployment, so they do not upload simultaneously. It requires an unexpired artifact from a successful main-branch deployment in this repository. It restores website files in place without deleting newer extra objects; this is not an atomic release. Visitors can briefly receive mixed versions during upload. It does not restore AWS infrastructure, the Lambda backend, external configuration or database state. A failed deployment may have partially uploaded files: inspect the result and use the known-good release workflow to recover.

Never treat the manifest alone as artifact provenance. The rollback workflow also checks the source run's branch, workflow path, event, conclusion and source revision. Hashes detect corruption or unexpected changes; they are not a signature against a compromised repository administrator.

## Official references used

- [GitHub: OIDC with AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws) — temporary deployment credentials and trust conditions.
- [GitHub: artifact APIs](https://docs.github.com/en/rest/actions/artifacts) — artifact expiry and workflow-run metadata.
- [GitHub: download-artifact](https://github.com/actions/download-artifact) — downloading artifacts from a specified run with a token.
- [AWS: invalidation paths](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/invalidation-specifying-objects.html) — account for URI rewrites when refreshing cache.

- [AWS: CloudWatch alarms](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-cloudwatch-alarm.html) — alarm actions and missing-data behaviour.
- [AWS: API Gateway metrics](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-metrics-and-dimensions.html) — latency, server errors and metric dimensions.
- [AWS: gateway responses](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-apigateway-gatewayresponse.html) — CORS headers on gateway-generated failures.
- [AWS: budgets](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-budgets-budget.html) — monthly limits and notification subscribers.
