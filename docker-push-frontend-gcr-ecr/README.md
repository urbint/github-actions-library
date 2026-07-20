# Docker Push Frontend to GCR and ECR

Builds a frontend app **once** (`yarn install` → `yarn build` → Docker build) and pushes the same image to both Google Container Registry and Amazon ECR.

## Prerequisites

1. Caller workflow **must checkout** the repo before invoking this action (local prep such as AASA file copies is preserved because this action does not re-checkout).
2. Workflow/job permissions for AWS OIDC and GitHub Packages:

```yaml
permissions:
  id-token: write   # AWS OIDC — required
  contents: read
  packages: read    # npm.pkg.github.com (@urbint)
```

3. AWS IAM role trust + ECR push permissions (same as `docker-push-ecr`).
4. GCP service account key with GCR push access (`GCR_SA_KEY`).

## Example

```yaml
jobs:
  push_docker_image:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
      packages: read
    steps:
      - uses: actions/checkout@v4
      - name: Use develop AASA
        run: cp public/.well-known/apple-app-site-association.develop public/.well-known/apple-app-site-association
      - uses: urbint/github-actions-library/docker-push-frontend-gcr-ecr@main
        with:
          image_name: worker-safety-client
          tag: ${{ github.sha }}
          gcr_sa_key: ${{ secrets.GCR_SA_KEY }}
          aws_account_id: ${{ vars.AWS_ACCOUNT_ID }}
          aws_region: ${{ vars.AWS_REGION }}
          iam_role_arn: ${{ vars.AWS_IAM_ROLE_ARN }}
          ecr_repository: staging/worker-safety-client
          node-version: '20.19.6'
          node-auth-token: ${{ github.token }}
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `tag` | Image tag | Yes | - |
| `image_name` | GCR image short name | Yes | - |
| `gcr_sa_key` | GCP SA JSON key | Yes | - |
| `gcr_project` | GCP project for GCR | No | `urbint-1259` |
| `aws_account_id` | AWS account ID | Yes | - |
| `aws_region` | AWS region | Yes | - |
| `iam_role_arn` | IAM role ARN for OIDC | Yes | - |
| `ecr_repository` | ECR repository name | Yes | - |
| `dockerfile` | Dockerfile path | No | `Dockerfile` |
| `node-version` | Node.js version | Yes | `20` |
| `node-auth-token` | Token for GitHub Packages | Yes | - |
