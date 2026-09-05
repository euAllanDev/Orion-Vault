# OpenCode Adapter

## Role

This adapter exposes `Orion Agent Skill` to OpenCode. `../SKILL.md` is source of truth for Vault access, authorization scope, transparency, deep retrieval, tool selection, and fallback.

## Registration

Register `agent-integration/skills` in global OpenCode config through `skills.paths`. OpenCode scans this directory recursively and loads `orion-agent/SKILL.md` as skill `orion-agent`.

Register primary agent file at `~/.config/opencode/agents/orion.md`. Its prompt binds selected Orion agent to registered `orion-agent` skill. Keep normal development tools enabled and inherit global MCP server `orion`; do not add separate MCP configuration or tool permission override.

## OpenCode Contract

- `mode: primary` exposes `Orion` alongside Build, Plan, and General.
- Selecting `Orion` only selects agent behavior. It never authorizes Vault retrieval or writing.
- Global `mcp.orion` provides technical access to `orion_ping`, `orion_search`, `orion_read`, `orion_context`, and `orion_remember`.
- Agent behavior enforces `SKILL.md`: before tools, it contextually routes each request to `ORION`, `LOCAL`, or `CLARIFY` using whole-request meaning and immediate conversation context, not literal noun matching. `ORION` routing still requires separate explicit current read authorization; `CLARIFY` asks before any source is searched. Authorized Orion reads then use deep, evidence-guided retrieval with intent routing, batched relevant reads, and no redundant context. Separate current explicit write intent permits one scoped `orion_remember` call. First authorized read or write is announced. No fixed tool sequence or artificial retrieval cap applies.
