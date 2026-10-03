<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import {
  Network,
  Server,
  Cpu,
  Layers,
  Globe,
  Plus,
  RefreshCw,
  Search,
  Building2,
  Trash2,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  Code
} from 'lucide-vue-next'
import { PorticoApiClient } from '../api/client'
import type {
  McpServer,
  McpTool,
  TenantOption,
  RegisterServerInput
} from '../types'

const props = withDefaults(
  defineProps<{
    apiBaseUrl?: string
    adminToken?: string
    tenantId?: string
    tenantsJson?: string | TenantOption[]
    embedded?: boolean
    title?: string
  }>(),
  {
    apiBaseUrl: '',
    adminToken: '',
    tenantId: '',
    tenantsJson: () => [],
    embedded: false,
    title: 'MCP Gateway 管理コンソール'
  }
)

const client = new PorticoApiClient({
  baseUrl: props.apiBaseUrl,
  adminToken: props.adminToken
})

watch(() => props.apiBaseUrl, (url) => client.setBaseUrl(url || ''))
watch(() => props.adminToken, (tok) => client.setAdminToken(tok))

const parsedTenants = computed<TenantOption[]>(() => {
  if (Array.isArray(props.tenantsJson)) {
    return props.tenantsJson
  }
  if (typeof props.tenantsJson === 'string' && props.tenantsJson.trim()) {
    try {
      return JSON.parse(props.tenantsJson)
    } catch {
      return []
    }
  }
  return []
})

// 状態管理
const servers = ref<McpServer[]>([])
const tools = ref<McpTool[]>([])
const isLoading = ref(false)
const statusMessage = ref<string | null>(null)
const statusType = ref<'success' | 'error'>('success')

const activeTab = ref<'servers' | 'tools' | 'system'>('servers')
const serverSearchQuery = ref('')
const toolSearchQuery = ref('')
const selectedTenantFilter = ref<string>('all')

// モーダル
const showAddModal = ref(false)
const newServerTenantId = ref('')
const newServer = ref<RegisterServerInput>({
  name: '',
  url: '',
  auth_type: 'none',
  auth_token: '',
  auth_header_name: '',
  custom_headers: {},
  scopes: []
})
const customHeadersJson = ref('{}')
const scopesInput = ref('crm:read, crm:write')

// Builtin ツール数
const builtinToolsCount = computed(
  () => tools.value.filter((t) => t.is_builtin).length
)

// フィルタ済みサーバー一覧
const filteredServers = computed(() => {
  return servers.value.filter((server) => {
    const q = serverSearchQuery.value.toLowerCase()
    const matchesSearch =
      !q ||
      server.name.toLowerCase().includes(q) ||
      server.url.toLowerCase().includes(q) ||
      (server.tenant_id && server.tenant_id.toLowerCase().includes(q))

    const matchesTenant =
      selectedTenantFilter.value === 'all' ||
      (selectedTenantFilter.value === 'builtin'
        ? server.is_builtin
        : server.tenant_id === selectedTenantFilter.value)

    return matchesSearch && matchesTenant
  })
})

// フィルタ済みツール一覧
const filteredTools = computed(() => {
  return tools.value.filter((tool) => {
    const q = toolSearchQuery.value.toLowerCase()
    return (
      !q ||
      tool.name.toLowerCase().includes(q) ||
      (tool.description && tool.description.toLowerCase().includes(q)) ||
      (tool.server_name && tool.server_name.toLowerCase().includes(q)) ||
      (tool.app && tool.app.toLowerCase().includes(q))
    )
  })
})

function showAlert(msg: string, type: 'success' | 'error' = 'success') {
  statusMessage.value = msg
  statusType.value = type
  if (type === 'success') {
    setTimeout(() => {
      if (statusMessage.value === msg) statusMessage.value = null
    }, 5000)
  }
}

// データ取得
async function refreshData() {
  isLoading.value = true
  statusMessage.value = null
  try {
    const tenantIds = parsedTenants.value.map((t) => t.id)
    const [fetchedServers, fetchedTools] = await Promise.all([
      client.fetchAllServers(tenantIds),
      client.fetchAllTools(tenantIds)
    ])
    servers.value = fetchedServers
    tools.value = fetchedTools
  } catch (err: any) {
    console.error('Failed to load MCP Gateway data:', err)
    showAlert(`データ取得に失敗しました: ${err.message}`, 'error')
  } finally {
    isLoading.value = false
  }
}

// サーバー追加
async function handleAddServer() {
  if (!newServer.value.name.trim() || !newServer.value.url.trim()) {
    showAlert('サーバー名と URL は必須です。', 'error')
    return
  }

  try {
    if (customHeadersJson.value.trim()) {
      newServer.value.custom_headers = JSON.parse(customHeadersJson.value)
    }
  } catch {
    showAlert('カスタムヘッダーの JSON 形式が正しくありません。', 'error')
    return
  }

  newServer.value.scopes = scopesInput.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const targetTenantId = newServerTenantId.value || props.tenantId || 'tenant_default'

  try {
    isLoading.value = true
    await client.registerServer(targetTenantId, newServer.value)
    showAlert(`MCP サーバー「${newServer.value.name}」を登録しました。`, 'success')
    showAddModal.value = false
    newServer.value = {
      name: '',
      url: '',
      auth_type: 'none',
      auth_token: '',
      auth_header_name: '',
      custom_headers: {},
      scopes: []
    }
    customHeadersJson.value = '{}'
    await refreshData()
  } catch (err: any) {
    showAlert(`サーバー登録に失敗しました: ${err.message}`, 'error')
  } finally {
    isLoading.value = false
  }
}

// サーバー削除
async function handleDeleteServer(server: McpServer) {
  if (!confirm(`MCP サーバー「${server.name}」を削除しますか？`)) return
  try {
    isLoading.value = true
    const targetTenantId = server.tenant_id || props.tenantId || 'tenant_default'
    await client.deleteServer(targetTenantId, server.id)
    showAlert(`MCP サーバー「${server.name}」を削除しました。`, 'success')
    await refreshData()
  } catch (err: any) {
    showAlert(`削除に失敗しました: ${err.message}`, 'error')
  } finally {
    isLoading.value = false
  }
}

// ツール同期
async function handleSyncTools() {
  try {
    isLoading.value = true
    const targetTenantId = props.tenantId || parsedTenants.value[0]?.id || 'tenant_default'
    await client.syncTools(targetTenantId)
    showAlert('ツールカタログの同期をトリガーしました。', 'success')
    await refreshData()
  } catch (err: any) {
    showAlert(`同期に失敗しました: ${err.message}`, 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  if (parsedTenants.value.length > 0 && !newServerTenantId.value) {
    newServerTenantId.value = parsedTenants.value[0].id
  }
  refreshData()
})
</script>

<template>
  <div class="portico-root min-h-[600px] w-full bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans antialiased space-y-8 rounded-2xl border border-slate-800/80 shadow-2xl">
    
    <!-- ページヘッダー -->
    <div v-if="!embedded" class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner">
          <Network class="w-6 h-6" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-black tracking-tight text-white">{{ title }}</h1>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-400 border border-purple-800/60">
              Fast MCP Hub
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-400 mt-1">
            社内 SaaS / 外部 FastMCP サーバー連携・ツールカタログの統合管理
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button
          @click="showAddModal = true"
          class="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all active:scale-95 cursor-pointer"
        >
          <Plus class="w-4 h-4" />
          <span>MCP サーバー追加</span>
        </button>

        <button
          @click="refreshData"
          :disabled="isLoading"
          class="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-colors cursor-pointer"
          title="更新"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
        </button>
      </div>
    </div>

    <!-- アラート表示 -->
    <div
      v-if="statusMessage"
      class="p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm border"
      :class="statusType === 'success' ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-rose-950/40 border-rose-800 text-rose-300'"
    >
      <div class="flex items-center gap-2">
        <CheckCircle2 v-if="statusType === 'success'" class="w-5 h-5 text-emerald-400 shrink-0" />
        <AlertCircle v-else class="w-5 h-5 text-rose-400 shrink-0" />
        <span>{{ statusMessage }}</span>
      </div>
      <button @click="statusMessage = null" class="text-slate-400 hover:text-white">&times;</button>
    </div>

    <!-- 4大メトリクスサマリー -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">登録済み MCP サーバー</span>
          <div class="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Server class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-2xl sm:text-3xl font-black text-white">{{ servers.length }}</span>
          <span class="text-xs text-slate-500 font-medium">Servers</span>
        </div>
        <p class="mt-1 text-[11px] text-slate-400">SaaS コネクタ &amp; FastMCP</p>
      </div>

      <div class="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">公開ツール数 (カタログ)</span>
          <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Cpu class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-2xl sm:text-3xl font-black text-emerald-400">{{ tools.length }}</span>
          <span class="text-xs text-slate-500 font-medium">Tools</span>
        </div>
        <p class="mt-1 text-[11px] text-slate-400">Gateway 統合ツールマニフェスト</p>
      </div>

      <div class="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">FastMCP 内包ツール</span>
          <div class="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Layers class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-2xl sm:text-3xl font-black text-cyan-400">{{ builtinToolsCount }}</span>
          <span class="text-xs text-slate-500 font-medium">Tools</span>
        </div>
        <p class="mt-1 text-[11px] text-slate-400">社内標準 SaaS 連携</p>
      </div>

      <div class="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Gateway エンドポイント</span>
          <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Globe class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-xl sm:text-2xl font-black font-mono text-indigo-300 truncate">:8002/mcp</span>
        </div>
        <p class="mt-1 text-[11px] text-slate-400">SSE ストリーミング対応</p>
      </div>
    </div>

    <!-- タブ切り替え -->
    <div class="flex items-center gap-2 border-b border-slate-800">
      <button
        @click="activeTab = 'servers'"
        class="pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer"
        :class="activeTab === 'servers' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        <Server class="w-4 h-4" />
        <span>MCP サーバー一覧</span>
        <span class="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-medium">
          {{ servers.length }}
        </span>
      </button>

      <button
        @click="activeTab = 'tools'"
        class="pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer"
        :class="activeTab === 'tools' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        <Cpu class="w-4 h-4" />
        <span>ツールカタログ</span>
        <span class="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-medium">
          {{ tools.length }}
        </span>
      </button>

      <button
        @click="activeTab = 'system'"
        class="pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer"
        :class="activeTab === 'system' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        <Sliders class="w-4 h-4" />
        <span>システム構成</span>
      </button>
    </div>

    <!-- ─── タブ 1: サーバー一覧 ──────────────────────────────────────── -->
    <div v-if="activeTab === 'servers'" class="space-y-6">
      
      <!-- 検索 & フィルタバー -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-3 w-full sm:w-auto flex-1">
          <div class="relative flex-1 max-w-md">
            <Search class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              v-model="serverSearchQuery"
              type="text"
              placeholder="サーバー名, URL, テナントIDで検索..."
              class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div v-if="parsedTenants.length > 0" class="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 shrink-0">
            <Building2 class="w-4 h-4 text-purple-400 shrink-0" />
            <span class="text-xs text-slate-400 font-medium">テナント:</span>
            <select
              v-model="selectedTenantFilter"
              class="bg-transparent border-0 text-purple-300 text-xs font-bold focus:outline-none cursor-pointer pr-2 py-0.5 max-w-[160px] truncate"
            >
              <option value="all" class="bg-slate-900 text-slate-200">すべてのテナント</option>
              <option value="builtin" class="bg-slate-900 text-cyan-300">Built-in (共通)</option>
              <option v-for="t in parsedTenants" :key="t.id" :value="t.id" class="bg-slate-900 text-slate-200 font-normal">
                {{ t.name }}
              </option>
            </select>
          </div>
        </div>

        <button
          @click="handleSyncTools"
          :disabled="isLoading"
          class="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-purple-300 border border-purple-800 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors shrink-0"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
          <span>カタログ手動同期</span>
        </button>
      </div>

      <!-- テーブル -->
      <div class="bg-slate-900/60 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Server class="w-4 h-4 text-purple-400" />
            <h2 class="text-sm font-bold text-white">接続先 MCP サーバー一覧</h2>
          </div>
          <span class="text-xs text-slate-500 font-medium">該当: {{ filteredServers.length }} 件</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <th class="py-3 px-4">サーバー名 / 種別</th>
                <th class="py-3 px-4">エンドポイント URL</th>
                <th class="py-3 px-4">認証タイプ</th>
                <th class="py-3 px-4">ステータス</th>
                <th class="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 text-slate-200">
              <tr v-for="s in filteredServers" :key="s.id" class="hover:bg-slate-800/30 transition-colors">
                <td class="py-3 px-4">
                  <div class="font-bold text-white flex items-center gap-2">
                    <span>{{ s.name }}</span>
                    <span v-if="s.is_builtin" class="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                      Built-in
                    </span>
                  </div>
                  <div class="text-[11px] text-slate-500 font-mono mt-0.5">{{ s.tenant_id ? `Tenant: ${s.tenant_id}` : 'Global' }}</div>
                </td>

                <td class="py-3 px-4 font-mono text-purple-300/90 text-[11px]">
                  {{ s.url }}
                </td>

                <td class="py-3 px-4">
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                    {{ s.auth_type || (s.has_auth ? 'Authenticated' : 'None') }}
                  </span>
                </td>

                <td class="py-3 px-4">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/80">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Ready</span>
                  </span>
                </td>

                <td class="py-3 px-4 text-right">
                  <button
                    v-if="!s.is_builtin"
                    @click="handleDeleteServer(s)"
                    class="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    title="削除"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                  <span v-else class="text-[11px] text-slate-600 font-mono">保護</span>
                </td>
              </tr>

              <tr v-if="filteredServers.length === 0">
                <td colspan="5" class="py-8 text-center text-slate-500">
                  該当する MCP サーバーはありません。
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ─── タブ 2: ツールカタログ ────────────────────────────────────── -->
    <div v-if="activeTab === 'tools'" class="space-y-6">
      <div class="relative max-w-md">
        <Search class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          v-model="toolSearchQuery"
          type="text"
          placeholder="ツール名, 説明, サーバー名で検索..."
          class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
        />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="tool in filteredTools"
          :key="tool.name"
          class="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 shadow-lg hover:border-purple-500/40 transition-all flex flex-col justify-between space-y-3"
        >
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="font-mono text-xs font-bold text-purple-300">{{ tool.name }}</span>
              <span v-if="tool.app" class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                {{ tool.app }}
              </span>
            </div>
            <p class="text-xs text-slate-400 leading-relaxed line-clamp-3">
              {{ tool.description || '説明はありません。' }}
            </p>
          </div>

          <div class="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <span class="font-mono">{{ tool.server_name || 'Portico Hub' }}</span>
            <span v-if="tool.is_builtin" class="text-cyan-400 font-bold">Built-in</span>
          </div>
        </div>
      </div>

      <div v-if="filteredTools.length === 0" class="py-12 text-center text-slate-500">
        該当するツールは見つかりませんでした。
      </div>
    </div>

    <!-- ─── タブ 3: システム構成 ──────────────────────────────────────── -->
    <div v-if="activeTab === 'system'" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3">
          <div class="flex items-center gap-2 text-purple-400">
            <Network class="w-5 h-5" />
            <h3 class="font-bold text-white text-sm">FastMCP Gateway Hub</h3>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed">
            社内SaaS・外部FastMCPツールへのルーティング、動的マニフェスト集約、リバースプロキシ連携を一元化します。
          </p>
        </div>

        <div class="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3">
          <div class="flex items-center gap-2 text-indigo-400">
            <ShieldCheck class="w-5 h-5" />
            <h3 class="font-bold text-white text-sm">セキュア認証 &amp; 透過</h3>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed">
            APIキー認証およびBearerトークンを透過付与し、マルチテナント環境下でのツール呼び出し認可を厳密に制御します。
          </p>
        </div>

        <div class="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3">
          <div class="flex items-center gap-2 text-cyan-400">
            <Layers class="w-5 h-5" />
            <h3 class="font-bold text-white text-sm">SSE ストリーミング</h3>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed">
            Server-Sent Events を介した双方向 MCP プロトコル通信に対応し、リアルタイムなツール呼び出しとステータス配信をサポートします。
          </p>
        </div>
      </div>
    </div>

    <!-- ─── モーダル: MCP サーバー追加 ────────────────────────────────── -->
    <div v-if="showAddModal" class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 class="text-base font-bold text-white">新規 MCP サーバー登録</h3>
          <button @click="showAddModal = false" class="text-slate-400 hover:text-white">&times;</button>
        </div>

        <div class="space-y-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-300 mb-1">サーバー名 *</label>
            <input
              v-model="newServer.name"
              type="text"
              placeholder="例: Salesforce FastMCP"
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-300 mb-1">エンドポイント URL *</label>
            <input
              v-model="newServer.url"
              type="text"
              placeholder="http://mcp-salesforce:8000/mcp"
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-300 mb-1">所属テナント</label>
              <select
                v-model="newServerTenantId"
                class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
              >
                <option value="tenant_default">デフォルト (tenant_default)</option>
                <option v-for="t in parsedTenants" :key="t.id" :value="t.id">
                  {{ t.name }}
                </option>
              </select>
            </div>

            <div>
              <label class="block font-semibold text-slate-300 mb-1">認証タイプ</label>
              <select
                v-model="newServer.auth_type"
                class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
              >
                <option value="none">認証なし (None)</option>
                <option value="bearer">Bearer トークン</option>
                <option value="custom_header">カスタムヘッダー</option>
              </select>
            </div>
          </div>

          <div v-if="newServer.auth_type !== 'none'" class="space-y-3">
            <div v-if="newServer.auth_type === 'custom_header'">
              <label class="block font-semibold text-slate-300 mb-1">認証ヘッダー名</label>
              <input
                v-model="newServer.auth_header_name"
                type="text"
                placeholder="X-API-Key"
                class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label class="block font-semibold text-slate-300 mb-1">認証トークン / シークレット</label>
              <input
                v-model="newServer.auth_token"
                type="password"
                placeholder="secret-token-value"
                class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            @click="showAddModal = false"
            class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
          >
            キャンセル
          </button>
          <button
            @click="handleAddServer"
            class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
          >
            登録する
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style>
@import '../styles/main.css';
</style>
