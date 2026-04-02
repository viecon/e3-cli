# E3 Assistant

NYCU E3 LMS 助手工具 — 讓交大 E3 更好用。

## CLI 工具

```bash
# 認證
e3 login -u <帳號>           # 帳密登入（互動式密碼輸入）
e3 login --token <token>     # Token 登入
e3 logout                    # 登出
e3 whoami                    # 查看登入狀態

# 總覽
e3 status                    # 一鍵總覽（作業 + 通知 + 課程）

# 課程
e3 courses                   # 列出選修課程
e3 open <課程名>             # 用瀏覽器開啟課程（支援模糊搜尋）
e3 open calendar             # 開啟 E3 行事曆

# 作業
e3 assignments               # 未完成作業
e3 submission <id>           # 作業提交詳情與回饋

# 教材
e3 download <course-id>      # 下載課程教材
e3 download --all            # 下載所有課程教材
e3 download --all --skip-existing  # 跳過已下載的

# 上傳
e3 upload <assignment-id> file1 file2  # 上傳並提交

# 資訊
e3 grades [course-id]        # 成績查詢
e3 calendar --days 14        # 行事曆事件
e3 news                      # 課程公告
e3 updates                   # 課程最近更新
e3 notifications             # 系統通知

# 匯出
e3 export grades -o grades.csv       # 成績匯出 CSV
e3 export assignments -o hw.csv      # 作業匯出 CSV

# 設定
e3 config get                # 查看設定
e3 config set vaultPath "..."        # 設定 Obsidian vault 路徑
e3 config set excludedCourses "..."  # 設定排除課程

# Obsidian 同步
e3 sync                      # 同步講義 + 作業到 Obsidian vault
```

所有指令支援 `--json` 輸出。

## 瀏覽器 Extension (Chrome + Zen Browser)

- **快速面板** — E3 頁面右下角按鈕，展開顯示未繳作業和課程連結，直接跳轉
- **批次下載** — 課程頁面一鍵下載所有教材
- **截止日提醒** — 首頁自動提醒 7 天內到期的作業
- **作業提示** — 作業提交頁面提示批次上傳功能
- **Popup** — 未繳作業列表 + 課程列表
- **Side Panel** — 完整功能面板（作業/課程/公告/行事曆/成績/通知）
- **Badge** — Toolbar icon 顯示未繳作業數量

## Obsidian 自動同步 Workflow

```bash
scripts/e3-sync.bat          # 完整 workflow（下載 + AI 生成筆記）
```

1. 下載新講義到 `{課程}/slides/`，按章節建立筆記
2. 同步未繳作業到 `Calendar/`（Obsidian Calendar 格式）
3. 用 Python 提取投影片文字（PDF/PPTX/DOCX）
4. Claude Code 讀取內容生成結構化筆記
5. Token 過期時自動用帳密重新登入

設定檔：`~/.e3.env`（帳密）、`~/.e3rc.json`（token + vault 路徑 + 排除設定）
用 `e3 config` 管理設定。

## Claude Code Skills

```
/e3-status        — 總覽
/e3-courses       — 課程
/e3-assignments   — 作業
/e3-submission    — 作業提交詳情
/e3-news          — 公告
/e3-updates       — 課程更新
/e3-notifications — 通知
/e3-download      — 下載
/e3-upload        — 上傳
/e3-grades        — 成績
/e3-export        — 匯出 CSV
/e3-open          — 開啟 E3 頁面
/e3-config        — 設定管理
/e3-sync          — Obsidian 同步 + AI 筆記
```

## 安裝

```bash
# 建置
pnpm install && pnpm build

# Extension (Chrome)
# chrome://extensions → 開發者模式 → 載入 packages/extension/.output/chrome-mv3

# Extension (Zen/Firefox)
# about:debugging → 載入 .output/firefox-mv2/manifest.json

# CLI 登入
node packages/cli/dist/bin/e3.js login -u <帳號>
```

需要 Node.js 22+（見 .nvmrc）、pnpm、Python 3（投影片提取）。

## 專案結構

```
packages/
  core/          — 共享 Moodle API 客戶端（REST + AJAX + 頁面爬取）
  cli/           — CLI 工具（21 個指令）
  extension/     — 瀏覽器 Extension（WXT + React + Tailwind）
scripts/
  e3-sync.bat    — 自動同步 workflow
  extract-slides.py  — 投影片文字提取
  generate-notes-prompt.md  — AI 筆記生成 prompt
.claude/skills/  — Claude Code Skills
```

## License

MIT
