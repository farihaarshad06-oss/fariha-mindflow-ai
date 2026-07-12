variable "project_name" {
  type        = string
  default     = "mindflow"
  description = "Short project prefix used for resource naming."
}

variable "environment" {
  type        = string
  default     = "dev"
  description = "Deployment environment (dev, staging, prod)."
}

variable "location" {
  type        = string
  default     = "swedencentral"
  description = "Azure region for all resources."
}

variable "postgres_admin_username" {
  type        = string
  default     = "mindflow"
  description = "PostgreSQL administrator username (password comes from Key Vault)."
}

variable "container_app_sku" {
  type        = string
  default     = "Consumption"
  description = "Container Apps plan SKU."
}

variable "postgres_admin_password" {
  type        = string
  sensitive   = true
  description = "PostgreSQL administrator password (provided via Key Vault / pipeline, never committed)."
}

variable "tenant_id" {
  type        = string
  description = "Azure AD tenant id for Key Vault access policies."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Resource tags applied to all resources."
}
