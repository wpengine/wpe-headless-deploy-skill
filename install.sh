#!/bin/bash
# Install WP Engine Headless skills for Claude Code.
#
# Project-level (current directory):
#   ./install.sh
#
# Global (available in every project):
#   ./install.sh --global

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ "${1:-}" == "--global" ]]; then
  DEST="$HOME/.claude/skills"
  SCOPE="global"
else
  DEST="$(pwd)/.claude/skills"
  SCOPE="project ($(pwd))"
fi

mkdir -p "$DEST"
cp -r "$SCRIPT_DIR/skills/wpe-direct"                 "$DEST/"
cp -r "$SCRIPT_DIR/skills/wpe-package"                "$DEST/"
cp -r "$SCRIPT_DIR/skills/wpe-next"                   "$DEST/"
cp -r "$SCRIPT_DIR/skills/replit-default-deployment"  "$DEST/"

# Write CLAUDE.md into the project root so Claude Code reads the skills at
# session start. Only written for project-level installs.
if [[ "$SCOPE" != "global" ]]; then
  CLAUDE_MD="$(pwd)/CLAUDE.md"
  if [ ! -f "$CLAUDE_MD" ]; then
    cat "$SCRIPT_DIR/CLAUDE.md.template" > "$CLAUDE_MD"
    echo "Created CLAUDE.md with skill references."
  else
    echo "CLAUDE.md already exists — add skill references manually if needed."
  fi
fi

echo "Installed wpe-direct, wpe-package, wpe-next, and replit-default-deployment to: $DEST"
echo "Scope: $SCOPE"
echo ""
echo "Restart Claude Code for the skills to be picked up."
