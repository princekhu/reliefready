# 24-hour hackathon plan

Team of 4. Adjust names. The code in this repo already covers hours 0–16; use the time to understand it, customize it, and polish the demo.

| Role | Owns |
|---|---|
| **A · Engine lead** | `js/engine.js`, `tests/` — routing, scoring, allocation, trips |
| **B · Frontend lead** | `index.html`, `css/`, `js/app.js` — map, panels, mobile |
| **C · Data + ML** | `js/scenarios.js`, `ml/` — scenarios, demand model, assumptions |
| **D · Product + pitch** | README, demo script, slides, deployment, Git hygiene |

## Timeline

| Hours | Goal | A · Engine | B · Frontend | C · Data/ML | D · Product |
|---|---|---|---|---|---|
| **0–1** | Kickoff | Read the PS together, agree scope | — | — | Create GitHub repo, add everyone, push skeleton |
| **1–3** | Data model | Agree JSON shape for villages, edges, stock, fleet | Page layout skeleton | Write scenario 1 (Flood) | Write assumptions table |
| **3–7** | Core engine | Dijkstra, reachability, priority score | Static SVG map with roads + villages | Synthetic data generator | Deploy empty site to GitHub Pages (prove the link works early) |
| **7–10** | Allocation | Floor + priority allocation, trip scheduler | Village cards, KPIs | Train model, export to `js/model.js` | Draft demo script |
| **10–12** | **Checkpoint**: end-to-end plan shows on screen | Unit tests | Wire engine to UI | Scenarios 2 and 3 | Test on a phone |
| **12–15** | The twist | Diff function | Click road to block, add area form, baseline diff panel | Hook model into add-area + request flags | Record backup demo video |
| **15–17** | Extras | Gap analysis, decision brief | Timeline (Gantt), brief tab | "How it works" content | Slides (5 max) |
| **17–19** | Sleep in shifts | Two people rest while two test | | | |
| **19–21** | Polish | Edge cases (0 trucks, 0 stock) | Mobile layout, dark mode, accessibility | Check numbers make sense | Final deploy, check public link |
| **21–23** | Rehearse | Run the 3-minute demo 3+ times; time it | | | |
| **23–24** | Buffer | Freeze code 1 hour before. Only fix bugs. | | | Submit link + repo |

## Git workflow

```bash
git checkout -b feature/<name>     # one branch per feature
git add -A && git commit -m "Add trip scheduler"
git push -u origin feature/<name>  # open a Pull Request, one teammate reviews, merge to main
```

Rules: `main` must always deploy. Commit small and often (judges look at history). Never commit secrets.

## Judging angles to rehearse answers for
- "Why this village first?" → open *Why this score*.
- "What if a road closes?" → click it live.
- "Is it fair to small villages?" → survival floor slider + worst-served KPI.
- "Where's the AI?" → demand model, honest about synthetic data, human stays in charge.
- "Is it optimal?" → greedy is explainable and fast; ILP solver is next.
