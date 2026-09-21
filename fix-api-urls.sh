#!/bin/bash

# 批量修复所有硬编码的API URL

echo "🔧 开始修复 API URLs..."

# 查找所有需要修复的文件
files=$(grep -rl "http://localhost:3001/api" web/src --include="*.ts" --include="*.tsx" 2>/dev/null)

for file in $files; do
  echo "处理: $file"

  # 1. 替换所有 fetch('http://localhost:3001/api/xxx'
  sed -i "s|fetch('http://localhost:3001/api/|apiFetch('/|g" "$file"

  # 2. 替换所有 fetch(\'http://localhost:3001/api/xxx\'
  sed -i "s|fetch(\\'http://localhost:3001/api/|apiFetch('/|g" "$file"

  # 3. 替换所有 fetch("http://localhost:3001/api/xxx"
  sed -i 's|fetch("http://localhost:3001/api/|apiFetch("/|g' "$file"

  # 4. 替换所有 fetch(\`http://localhost:3001/api/xxx\`
  sed -i 's|fetch(`http://localhost:3001/api/|apiFetch(`/|g' "$file"

  # 5. 检查是否有 apiFetch 的导入，如果没有则添加
  if grep -q "apiFetch" "$file" && ! grep -q "import.*apiFetch.*from.*api-config" "$file"; then
    # 在第一个 import 之后添加
    sed -i '1a import { apiFetch } from "@/utils/api-config";' "$file"
  fi
done

echo "✅ 修复完成！"
echo ""
echo "修复的文件:"
echo "$files"
