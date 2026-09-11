---
name: ux-lint
description: Evidence-based UX review for UI code and live pages. Measures real usability problems (tap target size, competing calls to action, form label grouping, overlays, response times) and maps each finding to the UX principle it violates (Fitts's law, Hick's law, Von Restorff, proximity, working memory, Doherty threshold, cognitive load, Jakob's law and ~20 more), with the fix as code. Use this whenever the user asks to review, audit, critique or improve a UI, component, form, landing page, checkout, onboarding or signup flow, asks "is this usable", "why is this confusing", "why don't users convert", mentions laws of UX, UX heuristics or usability, or wants a pre-merge UX check, even if they don't say "UX" explicitly.
---

# ux-lint

Review interfaces the way a senior UX engineer would: measure first, cite the principle behind each problem, be honest about how strong that principle's evidence is, and hand back fixes as code.

What sets this apart from opinion-based design review:

1. **Measure before judging.** A real browser tells you a button is 18×18px and 4px from its neighbour. Guessing from code doesn't.
2. **Principles are evidence, not decoration.** Each finding names the principle and its evidence strength. Heuristics are never presented as science.
3. **Fewer, truer findings.** Report what actually hurts the user's main task. Don't pad the report to touch all 30 principles.

## Modes

Pick the mode from the request. Default to **review**.

- **review:** full audit of a component, page or flow. Produces the report below.
- **check:** fast pre-merge gate. Produces pass/fail on the measurable rules plus a verdict. Use when the user says "check", "before I merge" or "quick".
- **fix:** apply fixes. Start from an existing report or run a review first, then change the code, smallest and safest fixes first, and re-measure.

## Workflow

### 1. Establish scope and the main task

Identify what is being reviewed: files, a URL, a running dev server or screenshots. Then name the **primary user task** on this screen (for example "sign up for a trial" or "find and buy a product"). Every finding is judged by how much it gets in the way of that task. If it isn't obvious from the code and copy, state your assumption in the report instead of asking.

### 2. Measure (whenever a page can be rendered)

Use the measurement script if you have a URL, a local HTML file, or a project with a dev server you can start:

```bash
node <skill-dir>/scripts/measure.mjs <url-or-file> --out=ux-lint.json --screenshots=ux-lint-shots
```

Useful flags:
- `--viewport=mobile|desktop|both` (default `both`).
- `--click="<selector>"`, repeatable, times a specific interaction such as a submit or add-to-cart. The script never clicks anything unless you ask, so it is safe on pages with destructive actions.
- `--wait=<ms>` gives slow client-side apps time to hydrate.

If Playwright is missing, the script prints the install command (`npm i -D playwright && npx playwright install chromium`). Run it if you are allowed to install dev dependencies; otherwise continue with a static review and say so.

Read the script's summary output. Then look at the screenshots if you can view images, because the Gestalt principles (grouping, similarity, hierarchy) are judged visually.

Rules for interpreting the numbers:
- **If the output shows the "failed to load" warning, stop.** The page rendered without its CSS or JS, so the layout findings are meaningless. Fix the cause (auth, dev server, network) or fall back to static review. Never report findings from a broken render.
- Treat the script's severities as a starting point, not a verdict. A 20px icon in a dense desktop admin table is a different problem from a 20px close button on a mobile checkout. Adjust the severity using the main task and context, and say why.
- Local timings are indicative. Report performance findings as "measured locally", and recommend confirming with field data before prioritising them.
- The script cannot see intent. Two "competing" primary buttons may be deliberate, as in a genuine A/B choice. Check the copy before calling it a violation.

If you need to start a dev server yourself, look for a `dev` or `start` script in `package.json`, run it in the background, wait for the port, and measure `http://localhost:<port>/<route>`. Stop it afterwards.

### 3. Read the code

Measurement covers what renders. Code reading covers behaviour and intent. Open the components behind the reviewed screen and check the principles relevant to what you see, using `references/principles.md`. Load only the sections you need; each entry lists what to look for and typical fixes. If the user asks where a principle comes from, cite the primary source from `references/sources.md`.

Things only a code read catches:
- Missing feedback states: no loading or disabled state on async buttons, and no optimistic update (Doherty).
- Rigid input parsing, such as rejecting spaces in phone numbers or a single date format (Postel).
- Information the system could infer but asks for anyway (Tesler).
- Destructive actions without confirmation or undo (Mental Model, Peak-End).
- Inconsistent terminology across components (Cognitive Load, Similarity).
- Interruptions triggered on mount, such as modals, tours or chat widgets (Flow, Paradox of the Active User).
- Feedback that appears far from where the user is looking, or several things changing at once (Selective Attention: change blindness).
- Components that only work with happy-path mock data. Look for no handling of long strings, missing images, empty values or huge numbers (Postel).
- No signs of what the user has already seen or done: missing visited-link styling, breadcrumbs or step history (Working Memory: recognition over recall).
- Redesigns that force the new version on everyone at once, with no preview or temporary way back (Jakob's Law).
- Dark patterns: pre-checked consent or add-ons, fake urgency, confirmshaming, cancellation harder than sign-up, progress bars that misrepresent how far along the user is (Cognitive Bias, Goal-Gradient). An honest head start, such as credit for steps already done, is fine; see "Deliberate divergences" in `references/sources.md`.

### 4. Triangulate and rank

Merge measured and code findings. Deduplicate: one root cause gets one finding, even if the script flagged it 12 times; list the affected elements inside it.

Then check your own confirmation bias. For every blocker and major, look for evidence *against* it before keeping it: Is it deliberate? Does the measurement really show it? Would it matter for the main task? Drop or downgrade anything that doesn't survive.

Rank by impact on the main task:

- **Blocker:** prevents or seriously endangers task completion, fails a WCAG 2.2 AA-linked threshold on a core path, or manipulates users against their interest.
- **Major:** measurable slowdown, error risk or confusion on the main path.
- **Minor:** polish, secondary paths, or advisory thresholds (for example 44px touch recommendations).

### 5. Report

Use this structure for **review** mode:

```markdown
# ux-lint: <what was reviewed>

**Main task:** <assumed or stated primary task>
**Method:** <measured at mobile 390×844 + desktop 1440×900 | static code review only> · <files/URL>
**Result:** <n> blockers · <n> major · <n> minor

## Findings

### 🔴 Blocker: <short, specific title>
- **Principle:** Fitts's Law (strong evidence)
- **Where:** `src/components/Header.tsx:42` · `header .icon-btn`
- **Evidence:** measured 18×18px, 4px from the next target (mobile)
- **Impact:** <one sentence on what happens to the user>
- **Fix:**
  ```diff
  - <button className="icon-btn">
  + <button className="icon-btn min-h-11 min-w-11 p-3">
  ```

### 🟠 Major: …
### 🟡 Minor: …

## What works
<2–4 bullets on things done well, with the principle, so the team keeps doing them>

## Not checked
<what couldn't be verified and why, e.g. "logged-in flows (no credentials)">
```

For **check** mode, keep it short:

```markdown
# ux-lint check: <scope>
| Check | Result | Note |
|---|---|---|
| Targets ≥ 24px or spaced (WCAG 2.5.8) | ✅/❌ | … |
| One primary action per view | ✅/❌ | … |
| Every field has a visible label | ✅/❌ | … |
| Labels group with their own field | ✅/❌ | … |
| No overlay blocks first interaction | ✅/❌ | … |
| Async actions give feedback < 100ms | ✅/❌ | … |
| Core interaction < 400ms | ✅/❌/– | … |
| No horizontal scroll on mobile | ✅/❌ | … |
| Large animations respect reduced motion | ✅/❌/– | … |
| No manipulative defaults or urgency | ✅/❌ | … |
**Verdict:** ship / ship with follow-ups / fix first
```

## Principles of a good review

- **Cite evidence strength honestly.** Use the labels in `references/principles.md` (strong / moderate / mixed / heuristic). Never flag a menu for having more than 7 items under "Miller's Law". That law concerns memory, not visible options. Don't present Choice Overload as settled science. For the Zeigarnik effect, a 2025 meta-analysis found no general memory advantage for unfinished tasks, only a tendency to resume them, so design for resumption.
- **Every finding needs a location and a fix.** "Improve hierarchy" is not a finding. "Three buttons share the primary style at `Hero.tsx:18–24`; make 'Start trial' primary and the others secondary" is.
- **Fixes must fit the codebase.** Use the project's styling system (Tailwind classes, CSS modules, design-system props) and existing components. Don't introduce new libraries for a UX fix.
- **Never trade accessibility for aesthetics.** A fix must not remove labels, reduce contrast, or rely on colour alone.
- **Never recommend manipulation.** The principles describe how people think. Use them to remove friction for users, not to exploit biases against them. If the interface already does, that is a blocker.
- **Respect deliberate design decisions.** If the team clearly chose a pattern (documented in a design system or comment), flag it only if it measurably hurts the main task, and acknowledge the trade-off.
- **Say what you didn't check.** Unrendered states, logged-in areas and flows you couldn't reach belong in "Not checked", not in silence.

## Fix mode

1. Start from the ranked findings. Fix blockers first, then majors.
2. Prefer the smallest change that resolves the finding: padding over redesign, a style variant over a new component.
3. After changing code, re-run `measure.mjs` on the same URL and viewports, and report before/after numbers for each fixed finding.
4. List anything you deliberately did not change and why (for example "competing CTAs are an intentional experiment; left as is").
