# openclaw-max-proxy

Use your **Claude Max subscription** with OpenClaw — no API keys, no per-token costs.

This proxy sits between OpenClaw and Claude Code CLI. It exposes an OpenAI-compatible HTTP endpoint that OpenClaw talks to, while the actual LLM calls go through your Claude Max subscription via the Claude Code CLI. It also connects to the OpenClaw Gateway as a trusted operator to silently auto-approve execution requests — no more TUI consent prompts.

Optionally, it exposes OpenClaw's tools (browser, exec, canvas, nodes) to Claude CLI as MCP tools, letting Claude wear OpenClaw like a glove.

---

## How it works

```
You (chat via Telegram/Discord/WebChat/etc.)
        ↓
  OpenClaw Gateway (ws://localhost:18789)
        ↓ LLM call (OpenAI-compatible)
  openclaw-max-proxy (http://localhost:3456/v1)
        ↓ subprocess
  Claude Code CLI (your Max subscription)
        ↓
  Anthropic — no API key needed

  [gateway operator running in same process]
        ↓ WebSocket operator connection
  OpenClaw Gateway — auto-approves exec requests silently
```

---

## Prerequisites

1. **OpenClaw** installed and running
   - Install: `npm install -g openclaw@latest`
   - Docs: https://docs.openclaw.ai

2. **Claude Code CLI** installed and authenticated with a Claude Max account
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude login
   ```

3. **Node.js 22+**

---

## Installation

```bash
# Clone the repo
git clone https://github.com/AmrDab/openclaw-max-proxy.git
cd openclaw-max-proxy

# Install dependencies and build
npm install
npm run build

# Install globally
npm install -g .
```

---

## Configuration

Point OpenClaw to the proxy. In `~/.openclaw/openclaw.json`:

```json
{
  "agent": {
    "model": "claude-code-cli/claude-sonnet-4-6"
  },
  "models": {
    "providers": {
      "claude-code-cli": {
        "baseUrl": "http://127.0.0.1:3456/v1",
        "apiKey": "local",
        "api": "openai-completions",
        "authHeader": false,
        "models": [
          { "id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6", "api": "openai-completions", "contextWindow": 200000, "maxTokens": 8192, "cost": { "input": 0, "output": 0 } },
          { "id": "claude-opus-4", "name": "Claude Opus 4", "api": "openai-completions", "contextWindow": 200000, "maxTokens": 8192, "cost": { "input": 0, "output": 0 } }
        ]
      }
    }
  }
}
```

---

## Running

### Standard — HTTP proxy only

Routes OpenClaw LLM calls through Claude Max. No API cost.

```bash
claude-max-api 3456
```

### Recommended — HTTP proxy + gateway operator

Same as above, plus auto-approves all OpenClaw exec requests silently. No more TUI consent prompts.

```bash
claude-max-api 3456 --gateway
```

You'll see:
```
[Gateway] Connected to ws://localhost:18789
[Gateway] Auto-approved exec: <command>
```

### Daily startup sequence

```bash
# 1. Start OpenClaw
openclaw gateway start

# 2. Start the proxy (background terminal tab)
claude-max-api 3456 --gateway

# 3. Use OpenClaw normally — it now runs on your Claude Max subscription
```

---

## MCP Glove Mode (optional)

Makes Claude CLI aware of OpenClaw's tools — browser control, exec, canvas, web search — so Claude can drive them directly.

**Step 1:** Add to `~/.claude/settings.json` under `mcpServers`:

```json
{
  "mcpServers": {
    "openclaw": {
      "command": "openclaw-mcp",
      "args": []
    }
  }
}
```

**Step 2:** Run `claude` in any terminal. It now has these tools available:

| Tool | What it does |
|------|-------------|
| `openclaw_browser_open` | Opens a URL in OpenClaw's browser |
| `openclaw_exec` | Runs a command via OpenClaw |
| `openclaw_web_search` | Searches the web through OpenClaw |
| `openclaw_send_agent_message` | Sends a message to an OpenClaw session |

The MCP server requires `claude-max-api 3456 --gateway` to be running first.

---

## Available models

| Model ID | Name |
|----------|------|
| `claude-sonnet-4-6` | Claude Sonnet 4.6 |
| `claude-opus-4` | Claude Opus 4 |
| `claude-sonnet-4` | Claude Sonnet 4.5 |
| `claude-haiku-4` | Claude Haiku 4 |

Set in `openclaw.json` as `claude-code-cli/<model-id>`.

---

## How the gateway operator works

When OpenClaw needs to run a shell command, it broadcasts an `exec.approval.requested` event over its WebSocket gateway. Normally this surfaces as a TUI consent prompt.

With `--gateway`, this proxy connects to the gateway as a trusted operator (`role: operator`, `scopes: operator.approvals`), listens for those events, and immediately calls `exec.approval.resolve` to approve them. The approval is invisible — OpenClaw proceeds without waiting for human input.

The operator authenticates using:
- The gateway auth token from `~/.openclaw/openclaw.json`
- A stable Ed25519 device keypair stored at `~/.openclaw/proxy-device-key.json` (auto-generated on first run)

---

## Forked from

[GodYeh/claude-max-api-proxy](https://github.com/GodYeh/claude-max-api-proxy) — extended with the OpenClaw gateway operator and MCP server layer.
