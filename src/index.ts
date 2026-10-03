import { defineCustomElement } from 'vue'
import PorticoConsoleSFC from './components/PorticoConsole.ce.vue'
import { PorticoApiClient } from './api/client'
import type {
  McpServer,
  McpTool,
  TenantOption,
  RegisterServerInput
} from './types'

// Custom Element の定義
export const PorticoConsoleElement = defineCustomElement(PorticoConsoleSFC)

/**
 * Web Components を登録する関数
 * @param tagName カスタムタグ名 (デフォルト: 'portico-console')
 */
export function registerPorticoUI(tagName = 'portico-console') {
  if (typeof window !== 'undefined' && !customElements.get(tagName)) {
    customElements.define(tagName, PorticoConsoleElement)
  }
}

// 自動登録
if (typeof window !== 'undefined') {
  registerPorticoUI()
}

export {
  PorticoConsoleSFC,
  PorticoApiClient
}

export type {
  McpServer,
  McpTool,
  TenantOption,
  RegisterServerInput
}

export default registerPorticoUI
