#!/usr/bin/env bash
# Personal Assistant bootstrap — runs after blueprint files are copied
set -euo pipefail

WORKSPACE="${1:-.}"

echo "✨ Setting up your Personal Assistant..."

# Create memory directories
mkdir -p "$WORKSPACE/memory"

# Create a simple TODO
cat > "$WORKSPACE/TODO.md" << 'EOF'
# My Tasks

## ✅ Done
- Assistant is set up and ready!

## 📋 To Do
- (Add your first task here!)
EOF

echo "✅ Personal Assistant is ready!"
