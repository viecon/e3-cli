---
name: e3-upload
description: 上傳檔案到 E3 並提交作業
---

# E3 作業上傳

```bash
# 上傳並提交
node "packages\cli\dist\bin\e3.js" upload <assignment-id> file1.pdf file2.zip

# 只上傳不提交
node "packages\cli\dist\bin\e3.js" upload <assignment-id> file1.pdf --no-submit
```

用 `e3 assignments --json` 查 assignment ID。
需要 token 模式（REST API）。
