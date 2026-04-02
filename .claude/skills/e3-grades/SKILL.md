---
name: e3-grades
description: 查看 E3 成績
---

# E3 成績

```bash
# 所有課程成績總覽
node "packages\cli\dist\bin\e3.js" grades --json

# 特定課程詳細成績
node "packages\cli\dist\bin\e3.js" grades <course-id> --json
```

需要 token 模式（REST API）。
