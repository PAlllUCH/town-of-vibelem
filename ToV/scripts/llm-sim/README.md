# llm-sim (DEPRECATED)

This directory contains an experimental LLM-based game simulator that was discontinued.

**Status:** Do not use unless explicitly reactivated.

**Contents:**
- `runner.js` - Game loop + LLM spawn pool
- `knowledge.js` - Prompt builders + per-player memory journal
- `fallback.js` - Heuristic fallback policies

**Reason for deprecation:** The approach did not yield reliable balance data. Use `scripts/agentic.js` for heuristic-AI simulation instead.
