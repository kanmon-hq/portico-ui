import type { McpServer, McpTool, RegisterServerInput } from '../types'

export class PorticoApiClient {
  private baseUrl: string
  private adminToken?: string

  constructor(options?: { baseUrl?: string; adminToken?: string }) {
    this.baseUrl = (options?.baseUrl || '').replace(/\/$/, '')
    this.adminToken = options?.adminToken
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '')
  }

  public setAdminToken(token?: string) {
    this.adminToken = token
  }

  private async request<T>(path: string, options: RequestInit & { tenantId?: string } = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    }

    if (this.adminToken) {
      headers['Authorization'] = `Bearer ${this.adminToken}`
      headers['X-Admin-Secret'] = this.adminToken
    }

    if (options.tenantId) {
      headers['X-Tenant-ID'] = options.tenantId
    }

    const res = await fetch(url, {
      ...options,
      headers
    })

    if (!res.ok) {
      let errMsg = `HTTP Error: ${res.status} ${res.statusText}`
      try {
        const errorJson = await res.json()
        errMsg = errorJson.message || errorJson.error || errorJson.detail || errMsg
      } catch {
        // fallback
      }
      throw new Error(errMsg)
    }

    if (res.status === 204) {
      return {} as T
    }

    return (await res.json()) as T
  }

  async fetchServers(tenantId: string): Promise<McpServer[]> {
    const data = await this.request<McpServer[]>('/gateway/servers', { tenantId })
    return Array.isArray(data) ? data : []
  }

  async fetchAllServers(tenantIds: string[]): Promise<McpServer[]> {
    const ids = tenantIds && tenantIds.length > 0 ? tenantIds : ['tenant_default']
    const results = await Promise.allSettled(
      ids.map((tId) => this.fetchServers(tId))
    )
    const allServers: McpServer[] = []
    const seen = new Set<string>()
    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        for (const s of res.value) {
          if (!seen.has(s.id)) {
            seen.add(s.id)
            allServers.push(s)
          }
        }
      }
    }
    return allServers
  }

  async fetchTools(tenantId: string): Promise<McpTool[]> {
    const data = await this.request<McpTool[]>('/gateway/tools', { tenantId })
    return Array.isArray(data) ? data : []
  }

  async fetchAllTools(tenantIds: string[]): Promise<McpTool[]> {
    const ids = tenantIds && tenantIds.length > 0 ? tenantIds : ['tenant_default']
    const results = await Promise.allSettled(
      ids.map((tId) => this.fetchTools(tId))
    )
    const allTools: McpTool[] = []
    const seen = new Set<string>()
    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        for (const t of res.value) {
          if (!seen.has(t.name)) {
            seen.add(t.name)
            allTools.push(t)
          }
        }
      }
    }
    return allTools
  }

  async registerServer(tenantId: string, payload: RegisterServerInput): Promise<any> {
    return this.request('/gateway/servers', {
      method: 'POST',
      tenantId,
      body: JSON.stringify(payload)
    })
  }

  async deleteServer(tenantId: string, serverId: string): Promise<void> {
    await this.request(`/gateway/servers/${serverId}`, {
      method: 'DELETE',
      tenantId
    })
  }

  async syncTools(tenantId: string): Promise<any> {
    return this.request('/api/tools/sync', {
      method: 'POST',
      tenantId
    })
  }
}
