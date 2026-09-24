"""synthesize — single LLM call, evidence in-context, no tool use in this node.

Prompt enforces the 9-section report (aajmvp.md F7). Without a key, emits a
deterministic template report from collected evidence so the graph runs stubbed.
"""
from __future__ import annotations

import os

SECTIONS = ["Executive thesis", "What happened", "Primary drivers", "Supporting evidence",
            "Contradicting evidence", "Affected assets", "What to watch next", "Confidence",
            "Sources + timestamps"]

PROMPT = """You are a market-intelligence analyst. Output ONLY valid GitHub-flavored Markdown (no HTML).

Structure — use ## for each section title (exact names):
{sections}

Formatting rules:
- Start with a single # title naming the asset (e.g. "# Market Intelligence Report: BRENT")
- Use ## for each numbered section above (not "1." plain text)
- Use short paragraphs, bullet lists (- item), and **bold** for key figures
- Every factual claim must cite evidence as [E0], [E1], … inline
- Include ## Contradicting evidence even if thin
- End with ## Sources + timestamps as a markdown bullet list: url — retrieved_at
- If evidence is sparse, say so in ## Confidence

ASSET: {asset}
QUERY: {query}
PHYSICAL SIGNAL: {physical}
EVIDENCE:
{evidence}
"""


def _evidence_text(evidence: list, limit: int = 12) -> str:
    lines = []
    for i, e in enumerate((evidence or [])[:limit]):
        if not isinstance(e, dict):
            continue
        p = e.get("payload", {})
        title = p.get("title", p.get("snippet", p.get("series_id", str(p)[:160])))
        lines.append(f"[E{i}] provider={e.get('provider')}/{e.get('dataset')} url={e.get('source_url')} retrieved={e.get('retrieved_at')} :: {str(title)[:200]}")
    return "\n".join(lines) or "(no evidence collected)"


def _stub_report(state: dict) -> str:
    asset = state.get("asset") or state.get("query")
    n = len(state.get("evidence", []))
    phys = (state.get("physical_signal") or {}).get("anomaly", {})
    if state.get("asset") is None and n == 0:
        return ("# Research Report: not enough data\n\nThe query did not resolve to a known "
                "entity and no evidence was collected. Try a ticker (e.g. BRENT, AAPL) or "
                "'why is Brent moving?'.\n")
    return (
        f"# Research Report (stub — no LLM_API_KEY): {asset}\n\n"
        f"## Executive thesis\nStubbed run collected {n} evidence records; configure LLM_API_KEY (groq) for the full synthesis.\n\n"
        f"## What happened\nMarket data and news stages ran; see trace for per-stage status.\n\n"
        f"## Primary drivers\nUnresolved in stub mode.\n\n"
        f"## Supporting evidence\n{_evidence_text(state.get('evidence', []), 10)}\n\n"
        f"## Contradicting evidence\nNone assessed in stub mode.\n\n"
        f"## Affected assets\n{asset}\n\n"
        f"## What to watch next\nRe-run with LLM_API_KEY set.\n\n"
        f"## Confidence\nLow (stubbed synthesis).\n\n"
        f"## Sources + timestamps\n{_evidence_text(state.get('evidence', []), 10)}\n"
        f"\nPhysical signal: {phys}\n"
    )


def synthesize(state: dict) -> dict:
    from research_desk.nodes._util import now, trace_entry

    started = now()
    trace = list(state.get("trace", []))
    import os

    if not (os.environ.get("LLM_API_KEY") or os.environ.get("GROQ_API_KEY") or os.environ.get("DEEPSEEK_API_KEY")):
        trace.append(trace_entry("synthesize", "skipped", started_at=started, finished_at=now(), reason="no LLM_API_KEY (groq, stub report)"))
        return {"report": _stub_report(state), "trace": trace}
    try:
        from research_desk.config import llm_client

        llm = llm_client("synthesize")
        prompt = PROMPT.format(
            sections="\n".join(f"{i+1}. {s}" for i, s in enumerate(SECTIONS)),
            asset=state.get("asset"), query=state.get("query"),
            physical=str(state.get("physical_signal"))[:1500],
            evidence=_evidence_text(state.get("evidence", [])),
        )
        raw = llm.invoke(prompt)
        report = getattr(raw, "content", str(raw))
        trace.append(trace_entry("synthesize", "done", started_at=started, finished_at=now()))
        return {"report": report, "trace": trace}
    except Exception as e:
        trace.append(trace_entry("synthesize", "skipped", started_at=started, finished_at=now(), reason=str(e)))
        return {"report": _stub_report(state), "trace": trace}
