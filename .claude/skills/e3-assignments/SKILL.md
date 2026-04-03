---
name: e3-assignments
description: 查看 E3 未完成作業
---

# E3 未完成作業

```bash
e3 assignments --json
```

用 calendar API 取得未繳作業（actionable=true 的 assignment 事件）。
輸出：`id`, `courseId`, `courseShortname`, `name`, `duedate` (unix timestamp), `isOverdue`。
加 `--days 90` 可調查詢範圍。
