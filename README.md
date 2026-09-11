# ux-lint

**A UX linter for AI coding agents.** It measures your UI in a real browser, maps every problem to the UX principle behind it (Fitts, Hick, Von Restorff, Gestalt, Doherty, and 25 more), and hands back the fix as code.

Works with Claude Code, Cursor, Codex, GitHub Copilot, Gemini CLI, Windsurf and any agent that supports the open Agent Skills format.

```bash
npx skills add Walma-Labs/ux-lint
```

Then ask your agent:

> "Review the signup page for UX problems"
> "ux check before I merge"
> "Why is nobody clicking Start trial?"

---

## Why another UX skill?

Most design skills make the model *guess* from code. ux-lint **measures** first:

```
BLOCKER target-size-aa [mobile] — Fitts's Law
  • 18×18px, nearest target 4px away — below WCAG 2.2 AA minimum
    at header > a.icon ("search")

BLOCKER target-obscured [desktop] — Flow / Selective Attention
  • Could not click: element is covered by <div id="cookie"> — users cannot click it either

MAJOR form-label-proximity — Law of Proximity
  • Label is 20px from its own field but 2px from the previous field
    at #email

MAJOR cta-competing — Von Restorff Effect
  • 3 different high-emphasis button styles above the fold — no single primary action stands out

MAJOR interaction-latency — Doherty Threshold
  • Click → next paint took 608ms (> 400ms) at #send
```

*(Real output from [`examples/bad-landing.html`](examples/bad-landing.html). The well-built [`examples/good-landing.html`](examples/good-landing.html) produces one minor note.)*

The agent then turns the measurements into a ranked report with code fixes. It also adds findings only a code read can catch, like a cookie banner with "Accept all" but no equally easy reject. See the full [sample report](examples/sample-report.md).

It is also **honest about the science**. Every principle is labelled as *strong*, *moderate*, *mixed* or *heuristic* evidence. You will never see a nav bar flagged for "violating Miller's Law", because that law is about memory, not visible menu items.

## What it checks

| Measured in the browser | Principle |
|---|---|
| Tap/click target size and spacing (WCAG 2.2 2.5.8) | Fitts's Law |
| Competing or overused primary buttons | Von Restorff, Hick's Law |
| Placeholder-only labels, missing labels | Working Memory |
| Labels closer to the wrong field | Law of Proximity |
| Overlays and pop-ups covering the page on load | Flow, Selective Attention |
| Elements users literally can't click | Selective Attention |
| Horizontal overflow on mobile | Jakob's Law, Fitts's Law |
| Long selects, crowded navigation | Hick's Law, Choice Overload |
| Missing `autocomplete`, wrong input types | Tesler's Law, Postel's Law |
| iOS zoom-on-focus inputs | Flow |
| Walls of text, very long forms | Chunking, Cognitive Load |
| FCP/LCP, long tasks, layout shift, click latency | Doherty Threshold |
| Large animations that ignore `prefers-reduced-motion` | Von Restorff, Selective Attention |

Plus a code read for what browsers can't see: missing loading states, rigid input parsing, destructive actions without undo, interruptions on mount, and dark patterns (pre-checked consent, fake urgency, confirmshaming). Dark patterns are always reported as blockers.

## Research-checked, not vibes

Every principle is traced to its primary research in [`references/sources.md`](skills/ux-lint/references/sources.md): Fitts 1954, Hick 1952, Kahneman 1993, Palmer 1992 and ~50 more. Where popular UX advice overstates the science, ux-lint takes a documented position instead of repeating the myth:

- **Zeigarnik effect:** a 2025 meta-analysis found no memory advantage for unfinished tasks, only a tendency to *resume* them. ux-lint designs for resumption.
- **"Artificial progress":** research supports an honest head start (endowed progress), not fake progress bars. ux-lint flags the latter as a dark pattern.
- **"Add a delay to build trust":** only true when showing *real work* on one-off results (the labor illusion). Never on frequent interactions.
- **Miller's 7±2:** about memory, not menu length. Never used to cap visible items.

## Modes

- **review:** full ranked report with location, evidence, impact and a code diff per finding
- **check:** pass/fail table plus a ship verdict, for pre-merge
- **fix:** applies the fixes, re-measures, and reports before/after numbers

## Requirements

The measurement script uses [Playwright](https://playwright.dev). If it's not installed, the agent will tell you:

```bash
npm i -D playwright && npx playwright install chromium
```

Without Playwright, ux-lint still works as a static code review and says so in the report.

You can also run the script directly:

```bash
node skills/ux-lint/scripts/measure.mjs https://localhost:3000/signup \
  --viewport=both --out=ux-lint.json --screenshots=shots --click="button[type=submit]"
```

It never clicks anything unless you pass `--click`.

## Sources

All principle descriptions are original and written from the primary research, which is cited in [`references/principles.md`](skills/ux-lint/references/principles.md): Fitts (1954), Hick (1952), Hyman (1953), Miller (1956), Cowan (2001), Baddeley & Hitch (1974), Sweller (1988), von Restorff (1933), Wertheimer (1923), Palmer (1992), Kahneman et al. (1993), Doherty & Thadani (1982), Carroll & Rosson (1987), and others.

For a beautifully designed introduction to these ideas, read Jon Yablonski's [Laws of UX](https://lawsofux.com/) and his book of the same name.

## Built by

ux-lint is built and maintained by [Walma](https://walma.ai), an AI engineering studio in Stockholm.

## License

MIT © [Walma Labs](https://walma.ai)
