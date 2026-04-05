# E3 Assistant

NYCU E3 LMS 助手工具 — CLI + Core Library。

> **Extension** 和 **Calendar** 已拆到獨立 repo：
> - [viecon/e3-extension](https://github.com/viecon/e3-extension) — Chrome / Firefox Extension
> - [viecon/e3-calendar](https://github.com/viecon/e3-calendar) — ICS 行事曆訂閱 + GitHub Pages

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
e3 calendar --ics            # 輸出 .ics 檔（作業 + 考試，可訂閱）
e3 calendar --ics cal.ics --ics-days 120  # 自訂檔名和天數
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

# 比較與工具
e3 diff                      # 比對 E3 與本地 vault 差異
e3 completions bash          # 產生 shell 自動補全腳本

# Obsidian 同步
e3 sync                      # 同步講義 + 作業到 Obsidian vault
```

所有指令支援 `--json` 輸出。

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

### 前置需求

- **Node.js 22+**（見 `.nvmrc`）
- **pnpm** — `npm install -g pnpm`

### 建置

```bash
git clone https://github.com/viecon/e3-assistant.git
cd e3-assistant
pnpm install
pnpm build
```

### CLI 登入

```bash
# 方法 1: 帳密登入（推薦，會自動取得 token）
node packages/cli/dist/bin/e3.js login -u <學號>

# 方法 2: Token 登入（從 E3 網頁取得）
node packages/cli/dist/bin/e3.js login --token <your-token>
```

### 加入 PATH（讓 `e3` 全域可用）

```bash
cd packages/cli && npm link
```

設定檔：`~/.e3.env`（帳密）、`~/.e3rc.json`（token + vault 路徑 + 排除設定）

## 專案結構

```
packages/
  core/          — 共享 Moodle API 客戶端（REST + AJAX + 頁面爬取）
  cli/           — CLI 工具（24 個指令）
scripts/
  e3-sync.bat    — 自動同步 workflow
  extract-slides.py  — 投影片文字提取
.claude/skills/  — Claude Code Skills
```

## License

MIT
