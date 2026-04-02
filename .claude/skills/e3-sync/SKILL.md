---
name: e3-sync
description: 同步 E3 講義和作業到 Obsidian，並用 AI 為新講義生成筆記
---

# E3 同步 Workflow

## 快速執行（完整 workflow，含 AI 生筆記）

```bash
"scripts\e3-sync.bat"
```

Log 在 `scripts/sync.log`。

## 手動分步執行

### Step 1: 同步講義和作業

```bash
node "packages\cli\dist\bin\e3.js" sync
```

下載新講義到 `{vault}/{課程}/slides/`，建 stub 筆記，同步作業到 `Calendar/`。

### Step 2: 找需要 AI 生成的 stub 筆記

```bash
node "scripts\find-stubs.js"
```

輸出 JSON，列出 vault 中 <300 bytes 的筆記（有對應 slide 的）。

### Step 3: AI 生成筆記

讀 `scripts/stubs.json` 裡的每一項，讀 PDF，生成完整筆記。
Prompt 規則在 `scripts/generate-notes-prompt.md`。

## Vault 位置

`<VAULT_PATH>`

## 排除的課程

服務學習、高效能計算概論、日文二、Gender Equity
