---
name: e3-courses
description: 列出 NYCU E3 的所有選修課程
---

# E3 課程列表

```bash
node "packages\cli\dist\bin\e3.js" courses --json
```

輸出 JSON 陣列：`id`, `shortname`, `fullname`。
加 `--all` 列出所有課程含已結束的。
