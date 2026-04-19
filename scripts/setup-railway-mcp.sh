#!/usr/bin/env bash
# Sets up Railway MCP for Claude Code in this project.
# Run once after cloning. Requires: node, npx, claude CLI.

set -e

echo "=== Railway MCP Setup ==="

# 1. Verify claude CLI
if ! command -v claude &> /dev/null; then
  echo "Installing Claude Code CLI..."
  npm install -g @anthropic-ai/claude-code
fi

# 2. Register Railway MCP server in Claude Code
echo "Registering Railway MCP server..."
claude mcp add railway -- npx -y @railway/mcp-server

# 3. Confirm
echo ""
echo "Registered MCP servers:"
claude mcp list

echo ""
echo "=== Next steps ==="
echo "1. Export your Railway API token:"
echo "   export RAILWAY_API_TOKEN=<your-token>"
echo "   (Get one at https://railway.app/account/tokens)"
echo ""
echo "2. Link this project to Railway:"
echo "   npx railway link"
echo ""
echo "3. Start Claude and use Railway via natural language:"
echo "   claude"
echo "   > Liste meus projetos Railway"
echo "   > Faça deploy do projeto atual"
echo "   > Crie um banco Postgres"
