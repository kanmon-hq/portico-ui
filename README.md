# @kanmon/portico-ui

Portico FastMCP Hub & Gateway 向けの組み込み型 Web Components UI ライブラリ。  
Vue 3、React、Next.js、Vanilla HTML などあらゆるフロントエンド環境に単一のカスタム要素として簡単に組み込み可能です。

## 特徴

- ⚡ **Web Components (Custom Elements)**: `<portico-console>` タグで即座にマウント可能
- 🛡️ **Shadow DOM スコープ保護**: ホストアプリケーションの CSS と干渉しない完全隔離スタイリング
- 🔌 **FastMCP サーバー管理**: 社内 SaaS Built-in ツールおよびテナント個別 MCP サーバーの動的追加・削除・ステータス監視
- 🛠️ **統合ツールカタログ**: 認識済みツール一覧、引数スキーマ、許可スコープのリアルタイムブラウズ

## インストール

```bash
npm install @kanmon/portico-ui
```

## 使い方 (Vue 3 / React)

### Vue 3
```vue
<script setup lang="ts">
import '@kanmon/portico-ui'

const tenants = [
  { id: 'tenant-corp-a', name: '企業 A' },
  { id: 'tenant-corp-b', name: '企業 B' }
]
</script>

<template>
  <portico-console
    api-base-url=""
    admin-token="your-admin-secret"
    :tenants-json="tenants"
  />
</template>
```

### React
```tsx
import React, { useEffect } from 'react'

export function PorticoAdminPage() {
  useEffect(() => {
    import('@kanmon/portico-ui')
  }, [])

  return (
    <portico-console
      api-base-url={process.env.NEXT_PUBLIC_PORTICO_API_URL}
      admin-token="secret"
    />
  )
}
```

## ライセンス

Apache-2.0
