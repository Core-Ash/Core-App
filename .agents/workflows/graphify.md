---
description: Query or refresh the shared local code graph without model calls.
---

## Graphify local navigation

- Before broad repository exploration or architectural analysis, if graphify-out/graph.json exists, use `graphify query "<question>" --budget 1200` to locate relevant files and symbols. Use `graphify explain "<symbol>"`, `graphify path "<A>" "<B>"`, and `graphify affected "<symbol>"` for focused relationships and impact checks.
- Skip Graphify for trivial tasks or when relevant files are already known. Fall back to targeted conventional search when graph results are missing, incomplete, or stale. Verify actual source before modifying it; source code is authoritative.
- Do not load the entire graph or report into context. Both agents share the same repository-local graphify-out/graph.json; do not build an agent-specific duplicate.
- Local-only policy: use `graphify extract . --code-only --no-cluster --max-workers 2` for incremental code extraction, then `graphify cluster-only . --no-label --no-viz` if structural clustering is useful. Never run semantic extraction, LLM labeling, hosted uploads, or extra model/subagent calls without explicit approval. This policy also applies when invoking the installed Graphify skill or /graphify workflow.
- After a meaningful batch of source edits, refresh once using the local commands above if graph information will be reused. Avoid rebuilding after every edit. No watcher or Git hook is required. Both agents must avoid simultaneous refreshes of the same graph.
