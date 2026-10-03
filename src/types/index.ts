export interface TenantOption {
  id: string
  name: string
}

export interface McpServer {
  id: string
  name: string
  url: string
  status: string
  tenant_id?: string
  auth_type?: string
  has_auth?: boolean
  scopes?: string[]
  is_builtin?: boolean
  last_synced_at?: string
}

export interface McpTool {
  name: string
  original_name?: string
  server_id?: string
  server_name?: string
  app?: string
  description?: string
  parameters?: Record<string, any>
  params_schema?: Record<string, any>
  scopes?: string[]
  is_builtin?: boolean
}

export interface RegisterServerInput {
  name: string
  url: string
  auth_type: string
  auth_token?: string
  auth_header_name?: string
  custom_headers?: Record<string, any>
  scopes?: string[]
}
