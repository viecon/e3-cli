# E3 Assistant

NYCU E3 LMS 助手工具，包含瀏覽器 Extension、CLI 工具（24 個指令）和 Claude Code Skills。

## 專案結構

- `packages/core/` - 共享 Moodle API 客戶端 (TypeScript library)
- `packages/cli/` - CLI 工具 (24 個指令)
- `packages/extension/` - 瀏覽器 Extension (Chrome + Firefox/Zen, WXT + React)
- `scripts/` - 自動化 workflow (sync + AI note generation)
- `.claude/skills/` - Claude Code Skills (16 個)

## 開發指令

```bash
pnpm install          # 安裝依賴
pnpm build            # 建置全部 (core → cli → extension，順序保證)
pnpm test             # 跑測試 (vitest, 35 tests)
pnpm lint             # ESLint
pnpm dev              # Extension 開發 (Chrome, watch mode)
pnpm dev:firefox      # Extension 開發 (Firefox/Zen)
pnpm cli              # 執行 CLI (開發用)
e3                    # 全域指令 (npm link 安裝)
```

## E3 API

基於 Moodle REST API + AJAX API，基底 URL: `https://e3p.nycu.edu.tw`
- 認證: Token (REST API) 或 Session cookie + sesskey (AJAX API)
- REST: `/webservice/rest/server.php?wstoken=TOKEN&moodlewsrestformat=json&wsfunction=FUNCTION`
- AJAX: `/lib/ajax/service.php?sesskey=KEY&info=FUNCTION` (POST JSON)
- Extension 可透過 Vite alias import @e3/core

## 設定

- `~/.e3rc.json` — token, authMode, vaultPath, excludedCourses, excludedExtensions
- `~/.e3.env` — E3_USERNAME, E3_PASSWORD (帳密，分開存放)
- 用 `e3 config get/set` 管理

## Skills

CLI 所有指令都支援 `--json` 輸出，方便 skills 解析。
使用前需先 `e3 login` 取得 token。
