# Terraform AWS CI actions

Public composite actions for Terraform plan/apply on AWS (OIDC + private modules).

**Do not put secrets, account IDs, role ARNs, backend bucket names, or org-specific
security policy in this library.** Callers pass those as inputs/vars/secrets.
Checkov and other security gates live in the private `securityplatform` repo.

## Actions

| Action | Purpose |
|--------|---------|
| `terraform-setup` | GitHub App token for private modules + AWS OIDC + Terraform install |
| `terraform-plan` | fmt / init / validate / plan / destroy detection / artifact upload |
| `terraform-pr-comment` | Sticky PR comment + optional fail-on-destroy gate |
| `terraform-apply` | init + auto-approve apply, or plan-then-apply saved plan |

`auth-using-GApp` remains available for non-Terraform workflows.

## Multi-region / single-region

Region × env pairs belong in the **caller** matrix only. Adding a region later is
adding matrix rows that point at existing `backend-config/` and `env-tfvars/` files:

```yaml
strategy:
  fail-fast: false
  matrix:
    include:
      - env: stage
        region: eu-west-2
        backend_config: backend-config/eu-west-2-stag.hcl
        var_file: env-tfvars/eu-west-2-stage.tfvars
        role_arn_var: AWS_ROLE_ARN_STAG
      # add another region:
      # - env: stage
      #   region: us-east-2
      #   backend_config: backend-config/us-east-2-stag.hcl
      #   var_file: env-tfvars/us-east-2-stage.tfvars
      #   role_arn_var: AWS_ROLE_ARN_STAG
```

Convention: `backend-config/{region}-{env}.hcl`, `env-tfvars/{region}-{env}.tfvars`.

## Security scan (private)

```yaml
jobs:
  security-scan:
    uses: urbint/securityplatform/.github/workflows/reusable-terraform-scan.yml@v1
    with:
      directory: .
      # skip_path: terraform   # optional
```

## Minimal plan job sketch

```yaml
plan:
  needs: security-scan
  runs-on: ubuntu-latest
  strategy:
    fail-fast: false
    matrix:
      include: []  # caller-owned env×region rows
  steps:
    - uses: actions/checkout@v4

    - name: Resolve OIDC role ARN
      id: role
      run: |
        case "${{ matrix.role_arn_var }}" in
          AWS_ROLE_ARN_INTG) echo "arn=${{ vars.AWS_ROLE_ARN_INTG }}" >> "$GITHUB_OUTPUT" ;;
          AWS_ROLE_ARN_STAG) echo "arn=${{ vars.AWS_ROLE_ARN_STAG }}" >> "$GITHUB_OUTPUT" ;;
          AWS_ROLE_ARN_PROD) echo "arn=${{ vars.AWS_ROLE_ARN_PROD }}" >> "$GITHUB_OUTPUT" ;;
        esac

    - uses: urbint/github-actions-library/terraform-setup@v1
      with:
        github_app_id: ${{ vars.RELEASE_APP_ID }}
        github_app_private_key: ${{ secrets.RELEASE_APP_PRIVATE_KEY }}
        aws_role_arn: ${{ steps.role.outputs.arn }}
        aws_region: ${{ env.AWS_REGION }}
        terraform_version: ${{ env.TF_VERSION }}

    - id: tf
      uses: urbint/github-actions-library/terraform-plan@v1
      with:
        backend_config: ${{ matrix.backend_config }}
        var_file: ${{ matrix.var_file }}
        env: ${{ matrix.env }}
        region: ${{ matrix.region }}

    - uses: urbint/github-actions-library/terraform-pr-comment@v1
      if: always()
      with:
        env: ${{ matrix.env }}
        region: ${{ matrix.region }}
        destroy_count: ${{ steps.tf.outputs.destroy_count }}
```

Pin action refs to a release tag after publishing (do not leave `@main` in production).
