---
name: e3-download
description: 下載 E3 課程講義
---

# E3 講義下載

```bash
# 列出檔案（不下載）
e3 download <course-id> --list

# 下載到指定目錄
e3 download <course-id> -o ./downloads

# 只下載 PDF
e3 download <course-id> --type pdf -o ./downloads
```

用 `e3 courses --json` 查課程 ID。
Token 模式用 REST API，session 模式用頁面爬取（自動 fallback）。
