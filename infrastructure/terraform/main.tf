# ---------------------------------------------------------------------------
# Fariha MindFlow AI — Azure Terraform skeleton (non-destructive definitions)
# ---------------------------------------------------------------------------
# This is a Phase 1 skeleton. It provisions the resource group and the
# managed services the platform depends on. Secrets are NOT defined here;
# they are expected to be supplied at apply time via Azure Key Vault or
# pipeline variables.
# ---------------------------------------------------------------------------

resource "azurerm_resource_group" "main" {
  name     = "${var.project_name}-${var.environment}-rg"
  location = var.location
  tags     = var.tags
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.project_name}-${var.environment}-logs"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

resource "azurerm_application_insights" "main" {
  name                = "${var.project_name}-${var.environment}-ai"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
  tags                = var.tags
}

resource "azurerm_container_app_environment" "main" {
  name                       = "${var.project_name}-${var.environment}-cae"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  tags                       = var.tags
}

resource "azurerm_container_app" "api" {
  name                         = "${var.project_name}-${var.environment}-api"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  template {
    min_replicas = 1
    max_replicas = 3
    container {
      name   = "api"
      image  = "ghcr.io/farihaarshad06-oss/mindflow-api:latest"
      cpu    = 0.5
      memory = "1Gi"
      env {
        name  = "APPLICATIONINSIGHTS_CONNECTION_STRING"
        value = azurerm_application_insights.main.connection_string
      }
    }
  }
  tags = var.tags
}

resource "azurerm_container_app" "ai_worker" {
  name                         = "${var.project_name}-${var.environment}-ai-worker"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  template {
    min_replicas = 0
    max_replicas = 2
    container {
      name  = "ai-worker"
      image = "ghcr.io/farihaarshad06-oss/mindflow-ai-worker:latest"
      cpu   = 0.5
      memory = "1Gi"
    }
  }
  tags = var.tags
}

resource "azurerm_container_app" "transcription_worker" {
  name                         = "${var.project_name}-${var.environment}-transcription-worker"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  template {
    min_replicas = 0
    max_replicas = 2
    container {
      name  = "transcription-worker"
      image = "ghcr.io/farihaarshad06-oss/mindflow-transcription-worker:latest"
      cpu   = 0.5
      memory = "1Gi"
    }
  }
  tags = var.tags
}

resource "azurerm_postgresql_flexible_server" "main" {
  name                = "${var.project_name}-${var.environment}-pg"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  version             = "16"
  administrator_login = var.postgres_admin_username
  administrator_password = var.postgres_admin_password
  sku_name            = "B_Standard_B1ms"
  storage_mb          = 32768
  zone                = "1"
  tags                = var.tags
}

resource "azurerm_storage_account" "main" {
  name                     = "${replace(var.project_name, "-", "")}${var.environment}storage"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  tags                     = var.tags
}

resource "azurerm_servicebus_namespace" "main" {
  name                = "${var.project_name}-${var.environment}-sb"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "Standard"
  tags                = var.tags
}

resource "azurerm_key_vault" "main" {
  name                        = "${replace(var.project_name, "-", "")}${var.environment}kv"
  location                    = azurerm_resource_group.main.location
  resource_group_name         = azurerm_resource_group.main.name
  tenant_id                   = var.tenant_id
  sku_name                    = "standard"
  enabled_for_template_deployment = true
  tags                        = var.tags
}
