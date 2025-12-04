# Docker Push to ECR

This GitHub Action builds and pushes Docker images to Amazon Elastic Container Registry (ECR) using Workload Identity Federation (WIF) for authentication.

## Prerequisites

1. **AWS OIDC Provider**: Configure an OIDC identity provider in AWS IAM for GitHub Actions
2. **IAM Role**: Create an IAM role with:
   - Trust policy allowing GitHub Actions to assume the role
   - Permissions to push to ECR (e.g., `ecr:PutImage`, `ecr:BatchCheckLayerAvailability`, `ecr:GetAuthorizationToken`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`)
3. **ECR Repository**: Create the ECR repository where images will be pushed

## Required Workflow Permissions

**Important**: Your workflow file must include the following permissions for OIDC authentication to work:

```yaml
permissions:
  id-token: write   # Required for OIDC authentication
  contents: read    # Required for checkout
```

Example workflow:

```yaml
name: Build and Push to ECR

on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - name: Push to ECR
        uses: urbint/github-actions-library/docker-push-ecr@main
        with:
          tag: ${{ github.sha }}
          aws_account_id: '837207188996'
          aws_region: 'eu-west-2'
          iam_role_arn: 'arn:aws:iam::837207188996:role/github-actions-ecr-push-role'
          ecr_repository: 'staging/worker-safety-service'
          dockerfile: 'Dockerfile'
          target: 'runtime'  # Optional: for multi-stage builds
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `tag` | Tag for the Docker image (e.g., latest or commit SHA) | Yes | - |
| `aws_account_id` | AWS Account ID | Yes | - |
| `aws_region` | AWS Region (e.g., us-east-1) | Yes | - |
| `iam_role_arn` | IAM Role ARN for Workload Identity Federation | Yes | - |
| `ecr_repository` | ECR repository name | Yes | - |
| `dockerfile` | Path to the Dockerfile | No | `Dockerfile` |
| `target` | Optional build target for multi-stage builds | No | - |

## AWS Setup

### 1. Create OIDC Identity Provider

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

### 3. Attach ECR Permissions

Attach a policy to the role with ECR push permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    }
  ]
}
```

## Troubleshooting

### Error: "Could not load credentials from any providers"

This error occurs when the workflow doesn't have the required `id-token: write` permission. Make sure your workflow file includes:

```yaml
permissions:
  id-token: write
  contents: read
```

### Error: "Access Denied" when pushing to ECR

- Verify the IAM role has the correct ECR permissions
- Check that the trust policy allows your GitHub repository
- Ensure the ECR repository exists and the role has access to it

