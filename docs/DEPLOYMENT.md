# Deployment

Phase 1 targets Azure via Terraform. Kubernetes is explicitly out of scope.

## Target topology

- Azure Container Apps environment hosting `api`, `ai-worker`,
  `transcription-worker`.
- Azure Database for PostgreSQL Flexible Server (pgvector).
- Azure Blob Storage for audio/documents.
- Azure Service Bus for job queues.
- Azure Key Vault for secrets.
- Application Insights + Log Analytics for observability.

## Environments

- `dev` (local + ephemeral Azure)
- `staging`
- `prod` (EU/Swiss region)

## Apply (manual, not in CI)

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars   # fill in real values
terraform init
terraform validate
terraform plan
terraform apply
```

Never commit `terraform.tfvars`.

## Container images

Images are published to `ghcr.io/farihaarshad06-oss/*` and referenced by the
Container Apps. CI does not deploy in Phase 1.

## Configuration

Runtime configuration is injected via environment variables (see
`.env.example`). Secrets come from Key Vault, not the image.
