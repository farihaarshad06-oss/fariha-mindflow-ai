output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "container_app_environment_id" {
  value = azurerm_container_app_environment.main.id
}

output "api_container_app_id" {
  value = azurerm_container_app.api.id
}

output "postgresql_flexible_server_id" {
  value = azurerm_postgresql_flexible_server.main.id
}

output "storage_account_id" {
  value = azurerm_storage_account.main.id
}

output "servicebus_namespace_id" {
  value = azurerm_servicebus_namespace.main.id
}

output "key_vault_id" {
  value = azurerm_key_vault.main.id
}

output "application_insights_connection_string" {
  value     = azurerm_application_insights.main.connection_string
  sensitive = true
}
