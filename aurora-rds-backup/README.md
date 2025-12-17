# Aurora RDS Backup Action

---

This GitHub Action automates the process of taking backups (snapshots) of a specified AWS Aurora RDS cluster across different environments using Workload Identity Federation (WIF) for authentication.

---

## Prerequisites

1. **AWS OIDC Provider**: Configure an OIDC identity provider in AWS IAM for GitHub Actions
2. **IAM Role**: Create an IAM role with:
   - Trust policy allowing GitHub Actions to assume the role
   - Permissions to create RDS cluster snapshots (e.g., `rds:CreateDBClusterSnapshot`, `rds:AddTagsToResource`)

## Required Workflow Permissions

**⚠️ CRITICAL**: Your workflow file **MUST** include the following permissions for OIDC authentication to work. **This is the #1 cause of authentication failures.**

**The permissions must be set at the workflow or job level** - composite actions cannot set permissions themselves.

```yaml
permissions:
  id-token: write   # Required for OIDC authentication - WITHOUT THIS, AUTHENTICATION WILL FAIL
  contents: read    # Required for checkout
```

**Common Error**: If you see `Error: Credentials could not be loaded, please check your action inputs: Could not load credentials from any providers`, it means your workflow is missing the `id-token: write` permission.

---

## Inputs

* **`environment`** (Required)
    * **Options:** `integ`, `staging`, `prod`
    * **Description:** This input helps categorize and manage backups based on the environment.

* **`aurora_cluster_identifier`** (Required)
    * **Description:** The identifier of the Aurora RDS cluster you want to create a backup for (e.g., `my-aurora-cluster`).

* **`rds_backup_description`** (Required)
    * **Description:** This helps identify the backup later (e.g., `Daily backup before deployment`).

* **`iam_role_arn`** (Required)
    * **Description:** IAM Role ARN for Workload Identity Federation (e.g., `arn:aws:iam::123456789012:role/github-actions-role`).

* **`aws_region`** (Required)
    * **Description:** AWS Region where the Aurora RDS cluster is located (e.g., `us-east-1`).

---

## How It Works

This action performs the following steps:

1.  **Authentication**: Authenticates with AWS using OIDC (Workload Identity Federation) by assuming the specified IAM role.
2.  **AWS CLI Setup**: Verifies the AWS CLI is available.
3.  **Snapshot Creation**: Executes the `aws rds create-db-cluster-snapshot` command to initiate a snapshot of the specified Aurora RDS cluster. The snapshot ID is automatically generated with a timestamp, and tags are added for environment and description tracking.

---

## Usage Example

```yaml
name: Manual Aurora RDS Backup

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment (integ, staging, prod)'
        required: true
        type: choice
        options:
          - integ
          - staging
          - prod
      aurora_cluster_identifier:
        description: 'Identifier of the Aurora RDS cluster to backup'
        required: true
        type: string
      rds_backup_description:
        description: 'Description of the RDS backup snapshot'
        required: true
        type: string

permissions:
  id-token: write
  contents: read

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: 'Aurora RDS Backup'
        uses: './.github/actions/aurora-rds-backup' # Path to your action
        with:
          environment: ${{ github.event.inputs.environment }}
          aurora_cluster_identifier: ${{ github.event.inputs.aurora_cluster_identifier }}
          rds_backup_description: ${{ github.event.inputs.rds_backup_description }}
          iam_role_arn: 'arn:aws:iam::123456789012:role/github-actions-rds-backup-role'
          aws_region: 'us-east-1'
```

## AWS Setup

### 1. Create OIDC Identity Provider

If you haven't already created an OIDC provider for GitHub Actions:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 2. Create IAM Role with Trust Policy

The trust policy should allow GitHub Actions to assume the role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:ORG/REPO:*"
        }
      }
    }
  ]
}
```

Replace:
- `ACCOUNT_ID` with your AWS account ID
- `ORG/REPO` with your GitHub organization and repository (e.g., `myorg/myrepo`)

### 3. Attach RDS Permissions

Attach a policy to the role with RDS snapshot permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rds:CreateDBClusterSnapshot",
        "rds:AddTagsToResource",
        "rds:DescribeDBClusterSnapshots"
      ],
      "Resource": [
        "arn:aws:rds:*:ACCOUNT_ID:cluster-snapshot:*",
        "arn:aws:rds:*:ACCOUNT_ID:cluster:CLUSTER_IDENTIFIER"
      ]
    }
  ]
}
```

Replace:
- `ACCOUNT_ID` with your AWS account ID
- `CLUSTER_IDENTIFIER` with your Aurora cluster identifier, or use `*` for all clusters

## Setup Notes
* **IAM Permissions**: The IAM role must have the `rds:CreateDBClusterSnapshot`, `rds:AddTagsToResource`, and `rds:DescribeDBClusterSnapshots` permissions.
* **Action Path**: If this action is located within your repository, update the uses path accordingly (e.g., `./.github/actions/aurora-rds-backup`).
