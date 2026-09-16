# SerpApi India Hackathon 2026 — Problem Statement & Competition Brief

## 1. Hackathon

**Event:** SerpApi India Hackathon 2026  
**Official website:** https://serpapi.github.io/serpapi-india-hackathon-2026/  
**Build period:** September 1 – October 5, 2026  
**Submission deadline:** October 5, 2026, 11:59 PM IST  
**Format:** Online / async  
**Team size:** Up to 5  
**Eligibility:** India-focused hackathon; verify current eligibility wording on the live rules before submission.

The hackathon is centered on building useful products powered by SerpApi's live search data. The official event announcement describes the event as a build with live search data, including AI agents, open-source integrations and applications powered by SerpApi. citeturn989758search0

---

## 2. Core Challenge

This is an **open-ended product hackathon**, not a conventional single fixed problem statement.

The fundamental challenge is:

> **Build a useful, original application that uses SerpApi meaningfully to access live web/search data and turns that data into a compelling user experience or solution.**

The key requirement for our project is therefore not merely “call SerpApi.” SerpApi usage must materially contribute to the product's functionality and outcome.

### Important rule from the competition brief

> **Adding an isolated or cosmetic API call solely to meet eligibility requirements is insufficient.**

Therefore, our implementation must make SerpApi a meaningful part of the product rather than adding one search call to an otherwise unrelated application. fileciteturn0file1L5-L9

---

## 3. Judging Criteria

The competition brief identifies the major evaluation dimensions as:

1. **Idea strength**
2. **Originality**
3. **Technical complexity**
4. **Usefulness**
5. **Meaningful SerpApi usage**

These criteria are unweighted in the current project notes, so the product should be designed to perform well across all five rather than optimizing for one metric. fileciteturn0file1L3-L7

### Practical implication for our project

We should demonstrate:

- a clear real-world problem,
- a distinctive solution,
- substantial but realistic engineering,
- an immediately understandable user benefit,
- and SerpApi doing work that would be difficult or materially worse without it.

---

## 4. Tracks

The competition provides multiple tracks, including:

- **AI Agents**
- **Open-Source Integrations**
- **Travel & Local Discovery**
- **Commerce & Market Intelligence**
- **Knowledge & Public Interest**
- **Open Innovation**

Our project is a market-intelligence product and therefore fits naturally within:

# Commerce & Market Intelligence

We can still use substantial agentic functionality without entering the dedicated AI Agents track. The track describes the product domain; it does not require the project to avoid agents.

---

## 5. Submission Requirements

Current project notes identify the principal submission components as:

### Public GitHub repository

The repository should contain:

- source code,
- setup instructions,
- architecture / implementation explanation,
- SerpApi usage explanation,
- required environment variables,
- demo instructions.

### Demo video

A **sub-3-minute local demo video** is expected.

The demo should prove the product works end-to-end rather than spending most of the runtime explaining architecture.

### Written explanation

Submission material should explicitly explain:

- which SerpApi products / engines were used,
- what each engine contributes,
- why SerpApi is necessary,
- how the application combines SerpApi data with other data sources.

The project notes specifically recommend making SerpApi usage visible during the demo rather than hiding it inside the backend. fileciteturn0file1L98-L102

---

## 6. Project We Are Building

### Working concept

**AI-Native Market Intelligence Terminal**

### Product thesis

> **Markets move because the financial world and the physical world interact. Our terminal connects market movements to the real-world events, information, demand, supply chains, logistics, macro conditions and expectations behind them.**

The intended user journey is:

```text
SEE WHAT MOVED
      ↓
UNDERSTAND THE FACTORS
      ↓
CONNECT THE FACTORS
      ↓
SEE WHO / WHAT IS EXPOSED
      ↓
INVESTIGATE DEEPLY
```

The project's central product spine is:

> **Something happened → is it real → who is exposed → what's priced in → what should I investigate next?**

This is a project design decision, not an official hackathon requirement.

---

## 7. Why This Fits Commerce & Market Intelligence

Traditional financial terminals are strong at showing structured market information:

- prices,
- charts,
- financial statements,
- rates,
- commodities,
- news,
- analytics.

Our differentiation is the connection between those numbers and the **world producing them**.

Examples:

```text
Oil price shock
      ↓
Shipping / chokepoint activity
      ↓
Energy supply risk
      ↓
Inflation / FX
      ↓
Industries
      ↓
Companies
      ↓
Equity prices
```

or:

```text
Extreme weather
      ↓
Crop / power / transport disruption
      ↓
Commodity prices
      ↓
Company exposure
      ↓
Market reaction
```

The terminal should make these relationships visible and investigable.

---

## 8. Where SerpApi Matters

SerpApi should be treated as the **web-intelligence / discovery layer**, while deterministic structured APIs provide specialized financial or physical-world data.

### Primary SerpApi roles

#### Google News

Use for:

- catalyst discovery,
- market-moving news,
- company developments,
- geopolitical events,
- event timelines,
- corroborating physical-world anomalies.

#### Google Search

Use for:

- deep investigation,
- finding context,
- discovering supplier/customer relationships,
- verifying events,
- domain-specific research,
- targeted research queries from the agent.

#### Google Trends

Use for:

- search-interest signals,
- demand/attention changes,
- regional interest,
- breakout related searches,
- price-vs-attention divergence.

#### Google Autocomplete

Potentially use for:

- emerging questions,
- early narrative discovery,
- unusual changes in what users are starting to search.

Other SerpApi engines may be used selectively where they create actual product value.

### Important principle

We do **not** use SerpApi merely because the hackathon requires it.

We use it where live search-derived information is materially valuable.

---

## 9. Product Scope

The current product concept consists of the following major surfaces.

### Market Overview

Global indices, sectors, movers, FX, rates, commodities and crypto.

### Asset / Company Intelligence

Price, fundamentals, earnings, filings, ownership/insider information, news and attention signals.

### Macro

Rates, inflation, GDP, labor and central-bank / economic indicators.

### Commodities & Energy

Oil, gas, metals, agriculture and physical supply indicators.

### Logistics / Physical World Map

Interactive map showing selected:

- ships,
- shipping routes,
- ports,
- chokepoints,
- flights,
- airports,
- weather,
- wildfires,
- earthquakes,
- hurricanes / disasters,
- relevant infrastructure.

### Events / Geopolitics

A timeline + geographic view of market-relevant world events.

### Cross-Market Intelligence

Interactive network / graph showing how factors propagate across:

```text
Event → Commodity → Macro → Sector → Company → Asset
```

### AI Research Desk

A user asks a natural-language market question and an existing research/agent framework orchestrates the investigation and generates a cited report.

### Signals / Alerts

Surface unusual combinations such as:

```text
Price move
+
News spike
+
Search-interest change
+
Physical-world anomaly
```

### Morning / Periodic Memo

A concise, cited market briefing generated from the same data ecosystem.

---

## 10. Agentic Scope

Agents are **not the entire product**.

The majority of the terminal is deterministic:

```text
Data → analytics → visualizations → maps → relationships
```

The agent is primarily used when reasoning or research is valuable:

- “Why is oil moving?”
- “Why did this stock fall?”
- “What is this event affecting?”
- “Investigate this anomaly.”
- “Deep dive on this company.”
- “What could happen if X occurs?”

The project may reuse an existing agent/research system rather than implementing an agent framework from scratch.

This is a project strategy, not a competition requirement.

---

## 11. Data Philosophy

We should maximize free/open data and reserve SerpApi calls for the places where search data gives us information we cannot cheaply obtain elsewhere.

### Structured sources

Examples:

- market data,
- macroeconomic APIs,
- SEC filings,
- energy datasets,
- AIS vessel data,
- aviation data,
- weather data,
- disaster feeds,
- prediction markets,
- trade data.

### Web intelligence

SerpApi provides:

- current web context,
- news discovery,
- attention signals,
- contextual verification,
- hard-to-structure information.

This separation keeps both cost and engineering complexity under control.

---

## 12. What the Demo Must Prove

The ideal demo should visibly demonstrate all five judging dimensions through one coherent workflow.

### Example

```text
1. Brent crude moves sharply

2. Terminal shows the move

3. World map shows relevant shipping activity

4. News / event layer identifies the catalyst

5. Cross-market graph shows affected industries/assets

6. User asks:
   "Why is oil moving?"

7. Research agent investigates

8. SerpApi queries are visible

9. Structured APIs corroborate the claims

10. Final cited report appears
```

The judges should be able to understand the product without needing a long explanation.

---

## 13. Constraints We Should Design Around

### Team

3 people, student team.

### Build window

Approximately 2–3 weeks of concentrated development remain for our current plan.

### Engineering philosophy

Do not build infrastructure that already exists.

Prefer:

- existing open-source agent/research frameworks,
- existing API clients,
- existing chart/map libraries,
- free public datasets,
- deterministic analytics,
- a small number of carefully chosen agents.

Avoid unnecessary:

- microservices,
- distributed streaming infrastructure,
- large multi-agent swarms,
- giant knowledge graphs,
- expensive commercial datasets.

---

## 14. Project Success Criteria

A successful submission should feel like a **real market-intelligence product**, not a collection of API demos.

### It should demonstrate:

- meaningful SerpApi integration,
- strong visual/product design,
- live or near-live data,
- physical-world context,
- cross-market relationships,
- evidence and source provenance,
- useful AI research,
- clear user workflows,
- reliable demo behavior.

### It should NOT become:

- a generic chatbot,
- a news aggregator,
- a stock dashboard with an LLM button,
- a fake “real-time” terminal,
- a giant collection of disconnected screens.

---

## 15. Rules / Verification Notes

This file is our **project interpretation of the official competition brief**, combined with the research already collected for the project.

Before final submission, re-check the live official website for any changes to:

- eligibility,
- submission format,
- deadlines,
- track rules,
- judging criteria,
- SerpApi usage requirements,
- API credit / free-tier terms.

The official website could not be fetched directly during this verification pass, so current rule details above are grounded primarily in the supplied hackathon research notes plus a current 2026 event announcement. The event announcement independently confirms the September 1–October 5, 2026 schedule, online format, up-to-five-person teams, and SerpApi/live-search focus. citeturn989758search0
