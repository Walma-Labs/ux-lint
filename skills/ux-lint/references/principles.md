# UX principles reference

Thirty principles that make testable predictions about how people use interfaces, written for review work: what each one claims, how solid the evidence is, what to look for in code or on screen, and what a good fix looks like.

Load only the sections relevant to what you are reviewing. Every description here is original wording based on the underlying research; see the source line in each entry.

Sources were cross-checked (September 2026) against the origin sections of lawsofux.com and, where our guidance differs from common framings, against the primary papers. See `sources.md` for the full index and the list of deliberate divergences.

## Evidence labels

Use these labels when you cite a principle in a report, so readers can weigh the finding.

- **strong**: replicated experimental findings with quantitative predictions. Safe to state as fact.
- **moderate**: well-supported in research, but the effect size or the transfer to interfaces varies. State as likely.
- **mixed**: replication record is contested. Mention the caveat whenever you cite it.
- **heuristic**: a design principle or observation, not an empirical law. Present it as practitioner guidance, never as science.

## Contents

1. Interaction cost: Fitts's Law, Doherty Threshold, Postel's Law, Tesler's Law
2. Decisions and choice: Hick's Law, Choice Overload, Occam's Razor, Pareto Principle
3. Memory and attention: Working Memory, Miller's Law, Chunking, Cognitive Load, Selective Attention, Serial Position Effect, Von Restorff Effect
4. Perception and grouping (Gestalt): Proximity, Similarity, Common Region, Uniform Connectedness, Prägnanz
5. Expectations: Jakob's Law, Mental Model, Paradox of the Active User
6. Motivation and experience: Goal-Gradient Effect, Zeigarnik Effect, Peak-End Rule, Flow, Aesthetic-Usability Effect, Parkinson's Law, Cognitive Bias

Key thresholds are collected at the end of the file.

---

## 1. Interaction cost

### Fitts's Law `strong`

**Claim:** How long it takes to hit a target grows with the distance to it and shrinks as the target gets bigger, following a logarithmic relationship.

**Source:** Paul Fitts, 1954. The model has held up across mice, touch, styluses and eye-gaze. MacKenzie (1992) gave it its common HCI formulation. Steven Hoober's field observations (2013 onward) of how people actually hold phones inform where touch targets are easy to reach.

**Look for:**
- Icon-only buttons with small hit areas (close ×, kebab menus, social icons, carousel dots).
- Tightly packed targets where a slip hits the neighbour, especially destructive actions sitting next to safe ones.
- Primary actions placed far from where the user's attention or thumb already is.
- Layout shift that moves a target just as the user taps it.

**Measured by:** `target-size-*`, `perf-cls` and `horizontal-overflow` in `measure.mjs`.

**Fixes:**
- Enlarge the hit area rather than the visual. Padding, `min-height`/`min-width`, or a `::before` pseudo-element with `inset: -10px` all work.
- Add spacing between adjacent targets.
- Move the primary action next to the content it acts on. On mobile, place frequent actions within thumb reach, and don't put destructive actions there.

**Don't:** Inflate every element to 44px regardless of context. Dense desktop data tables legitimately use smaller targets. WCAG 2.2 AA requires 24×24 or adequate spacing; 44×44 is the touch recommendation.

### Doherty Threshold `moderate`

**Claim:** People stay engaged and productive when the system answers faster than roughly 400ms. Above that, attention drifts and users start waiting instead of working.

**Source:** Walter Doherty and Ahrvind Thadani, IBM Systems Journal, 1982. They argued for 400ms instead of the then-standard 2 seconds. The broader response-time limits (0.1s feels instant, 1s keeps flow, 10s loses attention) trace back to Robert Miller (1968) and Card, Robertson and Mackinlay (1991). The 400ms figure itself comes from an industry paper, not controlled replication, so treat it as a practical ceiling rather than a precise constant.

**Look for:**
- Clicks with no visible reaction within about 100ms (no pressed state, spinner or optimistic update).
- Long main-thread tasks during load.
- Awaited network calls before any UI change.
- Full-page reloads for small state changes.

**Measured by:** `perf-*` and `interaction-latency` via `--click`.

**Fixes:**
- Acknowledge immediately with `:active` styles, disabled plus spinner, or skeletons.
- Use optimistic updates for low-risk actions.
- Split long tasks (`scheduler.yield()`, `setTimeout` chunking, web workers).
- Prefetch the likely next step.
- If something truly takes long, show determinate progress. Myers (1985) found that users prefer percent-done indicators to no indicator.

**The labor illusion (important nuance):** Buell and Norton (2011) found that people can prefer a *slower* result when the interface shows the work being done (a running list of steps such as "searching 400 airlines…"), even when the results are identical. This applies to one-off, high-value results: search results, quotes, analyses, security checks.

**Don't:**
- Slow down frequent, repeated interactions (clicks, navigation, typing). The labor illusion does not apply there.
- Fake the work. Showing what the system really does is operational transparency; inventing steps is deception.

### Postel's Law `heuristic`

**Claim:** Accept input generously and produce output strictly. For interfaces, that means tolerating the many ways people type things and normalising them yourself.

**Source:** Jon Postel's robustness principle for TCP (RFC 761, 1980). Note that RFC 9413 (2023) argues that liberal acceptance causes long-term problems in *protocols*. The UX reading, meaning forgiving human input while validating it safely, remains sound.

**Look for:**
- Phone, card and postcode fields that reject spaces, dashes or leading `+`.
- Date fields that accept exactly one format.
- Case-sensitive email matching.
- Errors that tell users to reformat instead of the system doing it.

**Measured by:** `form-input-type` finds the wrong input types. Parsing logic needs a code read.

- Layouts that break on real content: long names or translations, missing images, empty values, very large numbers, right-to-left text.

**Fixes:**
- Strip spaces and dashes before validating.
- Accept multiple date formats, or use a picker together with typed input.
- Trim whitespace and lowercase emails.
- Use `inputmode` and `type` so the right keyboard appears.
- Design with difficult data. Test components with extreme and missing content, not just the happy-path mock.

**Don't:** Silently accept input you cannot interpret correctly. Being forgiving must not mean guessing wrong.

### Tesler's Law `heuristic`

**Claim:** Every task carries some complexity that cannot be removed. The design question is who absorbs it, the system or the user.

**Source:** Larry Tesler, Xerox PARC, mid-1980s. His interview in Dan Saffer's *Designing for Interaction* (2006) popularised it. Bruce Tognazzini adds a counterpoint: when an application is simplified, users often start attempting more complex tasks, so total complexity tends to come back.

**Look for:**
- Users asked for information the system already has or could infer (country from locale, city from postcode, card type from number).
- Missing `autocomplete` attributes.
- No sensible defaults.
- Configuration exposed up front that 90% of users never change.

**Measured by:** `form-autocomplete` and `form-input-type`.

**Fixes:**
- Add `autocomplete` tokens and infer what you can.
- Pre-fill from account data, and choose defaults that serve the user.
- Move advanced settings behind progressive disclosure.

**Don't:** Hide complexity in a way that removes control users actually need. Irreducible complexity has to live somewhere visible.

---

## 2. Decisions and choice

### Hick's Law `strong` (for its original conditions)

**Claim:** Decision time rises with the number of equally likely options, roughly logarithmically.

**Source:** William Hick (1952) and Ray Hyman (1953), using choice-reaction tasks.

**Evidence note:** The law is robust for simple stimulus-response choices. It transfers only partly to menus, where users scan and search rather than choose among equally likely options. Research on navigation (for example Larson and Czerwinski, 1998) found that broad, well-organised menus often beat deep ones. Cutting items is not automatically better.

**Look for:**
- Several equally weighted options where one path is clearly the main task.
- Long unsorted lists.
- Pickers without search.
- Decisions forced before the user has the information to make them.

**Measured by:** `nav-many-items`, `select-long` and `cta-competing`.

**Fixes:**
- Make one option primary and others secondary.
- Group and label options, and sort meaningfully (alphabetical, by frequency).
- Add search or type-ahead for long lists.
- Defer choices until they matter.

**Don't:** Hide important navigation behind "More" just to lower a count. Findability beats a small number.

### Choice Overload `mixed`

**Claim:** Offering many options can lower satisfaction and the likelihood of choosing at all.

**Source:** Alvin Toffler coined "overchoice" in *Future Shock* (1970). Iyengar and Lepper's jam study (2000) is the classic experiment. A meta-analysis by Scheibehenne, Greifeneder and Todd (2010) found an average effect near zero. Chernev, Böckenholt and Goodman (2015) showed the effect appears under specific conditions: unclear preferences, hard-to-compare options, complex choice sets, and pressure to pick the best.

**Look for:**
- Pricing pages with many near-identical plans.
- Product grids without filters.
- Onboarding that asks users to pick from a long list of interests before they understand the product.

**Measured by:** `select-long` gives partial coverage. Mostly this needs judgement.

**Fixes:**
- Add comparison aids (aligned attributes, "most popular" backed by real data).
- Add filters.
- Offer a recommended default.
- Reduce near-duplicates.

**Don't:** Cite this as settled science. Say "under these conditions, large sets can backfire".

### Occam's Razor `heuristic`

**Claim:** When alternatives work equally well, choose the one with the fewest assumptions. For interfaces, that means the fewest elements and concepts needed to do the job.

**Source:** A principle of parsimony attributed to William of Ockham (14th century).

**Look for:**
- Decorative elements that compete with content.
- Duplicate paths to the same action on one screen.
- Settings or labels that restate what is already obvious.

**Fixes:** Remove, then check nothing broke. Merge duplicates. Prefer one clear pattern over two clever ones.

**Don't:** Remove labels from icons in the name of minimalism. That trades visual simplicity for cognitive cost.

### Pareto Principle `heuristic`

**Claim:** In many systems, a minority of causes produces the majority of effects. For interfaces: a few features, paths and bugs account for most use and pain.

**Source:** Vilfredo Pareto (land distribution, 1896). Joseph Juran generalised it to quality management. The 80/20 ratio is a rule of thumb, not a constant.

**Look for:** Equal visual weight for rarely and frequently used features. Review effort spread evenly instead of focused on the core path.

**Fixes:** Prioritise findings on the main task path. Use analytics (if available) to identify the top flows and review those first.

---

## 3. Memory and attention

### Working Memory `strong`

**Claim:** People hold only a small amount of information in mind at once, and it fades within seconds without rehearsal.

**Source:**
- Miller, Galanter and Pribram coined the term (1960).
- Atkinson and Shiffrin (1968) described the short-term store.
- Peterson and Peterson (1959) showed that unrehearsed items fade within seconds.
- Baddeley and Hitch's multicomponent model (1974) is the standard framework.
- Cowan (2001) estimated the capacity at about 4 meaningful chunks for most tasks.

**Look for:**
- Placeholder-as-label (the label vanishes on typing).
- Codes or values the user must carry from one screen to another.
- Instructions shown on step 1 and needed on step 3.
- Comparison tasks where the items being compared aren't visible side by side.
- Error summaries far from the fields.
- Nothing shows what the user has already seen or done. Missing signs include no visited-link styling, no breadcrumbs, no "viewed" markers and no step history.

**Measured by:** `form-placeholder-only` and `form-missing-label`.

**Fixes:**
- Use persistent visible labels.
- Favour recognition over recall: style `:visited` links distinctly, add breadcrumbs, mark items already viewed.
- Keep context visible (summary sidebars, sticky order totals).
- Put inline errors next to the field.
- Offer copy buttons for codes.
- Build comparison tables.

**Don't:** Rely on the user to remember anything the interface could show.

### Miller's Law `mixed` (as usually applied)

**Claim:** Short-term memory span is limited, famously "seven, plus or minus two" items.

**Source:** George Miller, 1956. Miller himself framed the number loosely. Later work (Cowan, 2001; Cowan, 2010, "The Magical Mystery Four") puts it closer to 4 chunks, varying with the person's prior knowledge and the situation.

**Evidence note:** This is the most misapplied principle in UX. It concerns *remembering* items, not *seeing* them. A navigation bar with 9 visible items does not violate it, because the items stay on screen.

**Look for:** Situations that genuinely require recall. That means codes, steps or options the user must keep in mind without seeing them.

**Fixes:** See Working Memory and Chunking.

**Don't:** Flag menus, lists or dashboards for having more than 7 items. Don't use this law to justify arbitrary limits.

### Chunking `strong`

**Claim:** Grouping individual pieces into meaningful units makes information easier to scan, understand and remember.

**Source:** Miller (1956). Chase and Simon (1973) studied chess experts, who recall board positions as chunks.

**Look for:**
- Walls of text.
- Long single-step forms.
- Unformatted numbers (card, IBAN, phone).
- Settings pages without sections.

**Measured by:** `text-wall` and `form-many-fields`.

**Fixes:**
- Use subheadings, short paragraphs and lists for parallel items.
- Split forms into titled sections or steps.
- Format numbers in groups as the user types (`4242 4242 …`).

**Don't:** Split a short form into many steps just to look chunked. Every extra step costs a page load and a decision.

### Cognitive Load `moderate`

**Claim:** Mental effort is limited. Effort spent decoding the interface (extraneous load) is effort not spent on the task itself (intrinsic load).

**Source:** John Sweller's cognitive load theory (1988), developed in instructional design. The distinction between intrinsic and extraneous load transfers well to interfaces. Exact measurement is harder.

**Look for:**
- Inconsistent terminology for the same thing.
- Unexplained jargon.
- Several competing calls to action.
- Dense screens without hierarchy.
- Novel interaction patterns where a standard one exists.

**Measured by:** `form-many-fields` and `cta-competing` indirectly. Mostly this needs judgement.

**Fixes:**
- Use one term per concept.
- Establish clear hierarchy (size, weight, spacing).
- Use progressive disclosure.
- Choose conventional components.

### Selective Attention `strong`

**Claim:** People attend to what serves their current goal and filter out the rest, including things placed directly in view.

**Source:**
- Cherry's cocktail-party studies (1953).
- Broadbent's filter model (1958).
- Treisman's attenuation model (1960).
- Kahneman's capacity model of attention (1973).
- Simons and Chabris's gorilla study on inattentional blindness (1999).
- Rensink, O'Regan and Clark (1997), on change blindness.
- Benway and Lane (1998), who first described banner blindness.

**Look for:**
- Important messages styled like ads or promos (users skip them).
- Critical warnings in a place the user isn't looking.
- Pop-ups and interstitials that interrupt the goal.
- Status changes with no visual cue.
- Change blindness: a success toast in a far corner while the user looks at the button they pressed. Two things updating at once, so one goes unnoticed. Content that silently changes position or value.

**Measured by:** `overlay-on-load`, `sticky-heavy`, `target-obscured` and `cta-none-above-fold`.

**Fixes:**
- Put messages where the user's attention already is (next to the field or button that caused them).
- Avoid simultaneous changes that compete. Give important changes a transition or highlight so the eye is drawn to them.
- Style warnings as system UI, not marketing.
- Defer non-essential overlays until after the first meaningful action.

### Serial Position Effect `strong` (for lists recalled from memory)

**Claim:** In a sequence, the first and last items are remembered best.

**Source:** Ebbinghaus (1885). Murdock (1962) established the primacy and recency curve.

**Evidence note:** The finding is robust for recall. Transferring it to "put important nav items first and last" is a reasonable heuristic, but it isn't directly tested.

**Look for:** Key actions or selling points buried in the middle of long lists or carousels.

**Fixes:** Place the most important items at the start. Use the end for a strong secondary item or summary. Keep carousels short, or replace them with visible lists.

### Von Restorff Effect `strong`

**Claim:** When similar items are shown together, the one that differs is the one noticed and remembered.

**Source:** Hedwig von Restorff, 1933 (the isolation effect).

**Look for:**
- Several buttons styled as primary.
- Everything bold or highlighted.
- The main action styled the same as secondary ones.
- Distinctiveness carried by colour alone.

**Measured by:** `cta-competing`, `cta-overused`, `cta-none-above-fold` and `motion-ignores-preference`.

**Fixes:**
- Use one high-emphasis action per view or decision point.
- Downgrade the rest to secondary or tertiary styles.
- Combine colour with size, weight, position or an icon, so the difference survives colour blindness (WCAG 1.4.1).
- If motion is used to draw attention, respect `prefers-reduced-motion` and let users pause anything that moves for more than 5 seconds (WCAG 2.2.2). Motion can trigger vestibular symptoms.

**Don't:** Use isolation to push users toward the option that benefits the business at their expense (for example highlighting the most expensive plan as "recommended" without basis).

---

## 4. Perception and grouping (Gestalt)

The Gestalt grouping principles come from Max Wertheimer and the Berlin school. His 1910 observation of apparent motion in flashing lights led to the 1912 paper; the grouping laws followed in 1923. Palmer (1992) added common region, and Palmer and Rock (1994) added uniform connectedness. The grouping effects are robust, and they interact: connectedness and common region usually override proximity and similarity.

### Law of Proximity `strong`

**Claim:** Things that are close together are seen as belonging together.

**Look for:**
- Form labels that sit closer to the previous input than to their own.
- Equal spacing everywhere, so nothing groups.
- Buttons placed nearer to unrelated content than to what they act on.

**Measured by:** `form-label-proximity`.

**Fixes:**
- Spacing inside a group should be clearly smaller than spacing between groups (as a rule of thumb, around 2×).
- Keep each label tight to its field.

### Law of Similarity `strong`

**Claim:** Elements that look alike are read as having the same role. Similarity can come from colour, shape, size, orientation or movement.

**Look for:**
- Links styled differently across pages.
- Non-clickable text styled like links (coloured or underlined).
- Clickable cards that look identical to static ones.
- Destructive and safe actions styled the same.

**Fixes:** Apply one consistent style per role. Reserve the link and button styles for interactive elements. Give destructive actions a distinct treatment.

### Law of Common Region `strong`

**Claim:** Elements inside a shared boundary (a card, a panel, a background) are seen as a group.

**Look for:**
- Related controls split across containers.
- Unrelated items sharing a card.
- Heavy nested borders ("box soup") that dilute the grouping.

**Fixes:** One container per logical unit. Use background tint or whitespace instead of stacked borders.

### Law of Uniform Connectedness `strong`

**Claim:** Elements joined by lines or a continuous visual link are seen as more related than elements that are merely close.

**Look for:** Steppers and timelines without connectors. Label and value pairs in tables with weak row association (zebra stripes or row lines help).

**Fixes:** Connect sequential steps. Use row striping or hover highlighting in dense tables.

### Law of Prägnanz `strong` (as a perceptual tendency)

**Claim:** People interpret ambiguous or complex visuals in the simplest way they can.

**Look for:** Icons with too much detail to read at small size. Complex illustrations used as the only carrier of meaning. Ambiguous shapes that read as something else.

**Fixes:** Simplify icon geometry. Pair icons with text. Test icons at their actual rendered size.

---

## 5. Expectations

### Jakob's Law `heuristic` (strongly supported by usability practice)

**Claim:** Users spend most of their time on other products and expect yours to work the same way.

**Source:** Jakob Nielsen, 2000.

**Look for:**
- Non-standard placement of logo (should link home), search, cart or account.
- Custom scrollbars or scroll-jacking.
- Horizontal scrolling on mobile.
- Links that don't look like links.
- Reinvented form controls.

**Measured by:** `horizontal-overflow`.

**Fixes:**
- Follow platform and web conventions unless there's a measured reason not to. Innovate on the value, not the controls.
- For redesigns, give users a transition: preview the new version, switch back for a limited time, send feedback. This lowers the cost of breaking their existing mental model. YouTube's 2017 redesign is a well-known example.

### Mental Model `heuristic` (established construct)

**Claim:** Users act on their own internal picture of how a system works. Friction appears where that picture and the actual system diverge.

**Source:**
- Kenneth Craik, *The Nature of Explanation* (1943).
- Don Norman applied it to design in *The Design of Everyday Things* (1988).
- Jones et al. (2011) give an interdisciplinary synthesis.

**Look for:**
- Internal jargon or data-model terms in the UI ("entity", "workspace object").
- Actions whose results surprise users (for example "archive" that actually deletes).
- Save models that differ from what users expect (auto-save vs explicit save, without indication).

**Fixes:**
- Use the user's vocabulary.
- Show system state (saved / saving / unsaved).
- Preview consequences before destructive actions.

### Paradox of the Active User `moderate`

**Claim:** Users skip manuals and tutorials and start doing things immediately, even when learning first would save time.

**Source:** John Carroll and Mary Beth Rosson, 1987.

**Look for:**
- Long product tours before the first useful action.
- Features that only work if you read the docs.
- Empty states with no guidance.

**Measured by:** `overlay-on-load` catches tours and modals shown on arrival.

**Fixes:**
- Contextual hints at the moment of need.
- Empty states that explain the next step and offer a sample.
- Sensible defaults so exploration is safe.
- Undo instead of warnings.

---

## 6. Motivation and experience

### Goal-Gradient Effect `moderate`

**Claim:** Motivation rises as people get closer to a goal.

**Source:**
- Clark Hull proposed the hypothesis in 1932. His 1934 study showed rats running faster as they neared food.
- Kivetz, Urminsky and Zheng (2006) found that a coffee card with two of twelve stamps already filled was completed faster than an equivalent blank card of ten.
- Nunes and Drèze (2006) named this the *endowed progress effect*.

**Look for:** Multi-step flows without progress indication. Progress that starts at zero when some effort is already done.

**Fixes:** Show honest progress (step 2 of 4). Credit work already completed (a profile that is 60% complete because you already signed up).

**Endowed vs. fake progress:** Some popular UX guides recommend "artificial progress". The research supports something narrower: an honest, visible head start, such as a bonus stamp or credit for steps already done. It does not support misrepresenting how far along someone is.

**Don't:** Fake progress, meaning bars that jump to 90% and stall, or artificial "steps". Treat that as a dark pattern and report it as a blocker.

### Zeigarnik Effect `mixed`

**Claim:** Interrupted or unfinished tasks stay on people's minds more than finished ones.

**Source:** Bluma Zeigarnik, 1927. Maria Ovsiankina (1928) described the related tendency to *resume* interrupted tasks.

**Evidence note:** A 2025 meta-analysis (Ghibellini and Meier, *Humanities and Social Sciences Communications*) found no general memory advantage for unfinished tasks. It did find a robust tendency to resume them: roughly two-thirds of interrupted tasks were taken up again. Base design decisions on resumption, not on users "remembering" unfinished things.

**Look for:**
- Flows with no way to save and resume.
- Unclear indication of what is left to do.
- Content with no signifier that more exists (a cut-off card hinting at horizontal scroll, "3 more").

**Fixes:** Autosave drafts, "continue where you left off" and visible checklists of remaining steps.

**Don't:** Manufacture "incomplete" states purely to pull users back (fake unfinished profiles, endless streak mechanics). Flag these.

### Peak-End Rule `moderate`

**Claim:** People judge an experience mostly by its most intense moment and its ending, not by the average of every moment.

**Source:**
- Kahneman, Fredrickson, Schreiber and Redelmeier (1993), the cold-water experiment.
- Redelmeier and Kahneman (1996) followed with colonoscopy patients.
- Do, Rupert and Wolford (2008) extended the rule to pleasurable experiences.
- Baumeister et al. (2001) found that negative events weigh more than positive ones. A bad peak therefore dominates the memory.

**Look for:**
- Flat or broken endings (a generic "Success" page, a dead-end after checkout).
- Unexplained waits at emotional moments (payment, booking, delivery). A visible ETA or progress turns an anxious peak into a tolerable one.
- Error states that are the most intense moment and handled badly.

**Fixes:**
- Design the completion moment: a confirmation with the next useful step, a receipt or a clear summary.
- Make error recovery graceful, keeping the user's input and explaining in plain language what went wrong and how to fix it.

### Flow `moderate` (construct), `heuristic` (as UI guidance)

**Claim:** People reach deep, enjoyable focus when challenge matches skill, goals are clear, feedback is immediate, and nothing interrupts. Too hard frustrates; too easy bores.

**Source:** Mihaly Csikszentmihalyi, 1975 and 1990.

**Look for:**
- Interruptions such as modals, newsletter pop-ups, cookie walls or chat bubbles opening on their own.
- Slow feedback.
- Forced context switches (leaving the page to find information).

**Measured by:** `overlay-on-load`, `form-input-zoom`, `perf-*` and `interaction-latency`.

**Fixes:**
- Defer interruptions.
- Keep users in context with inline editing and side panels instead of new pages.
- Give immediate feedback.

### Aesthetic-Usability Effect `moderate`

**Claim:** People perceive attractive designs as easier to use, and they tolerate minor problems in them more readily.

**Source:**
- Kurosu and Kashimura (1995, Hitachi) had 252 participants rate 26 ATM layouts. Perceived ease of use correlated more strongly with aesthetic appeal than actual ease of use did.
- Tractinsky (1997) replicated the finding across cultures.
- Ashby, Isen and Turken (1999) offer a neuropsychological account of how positive affect aids cognition.

**Evidence note:** The effect concerns *perceived* usability. Attractive designs can mask real problems in usability tests, because participants blame themselves instead of the UI.

**Look for:** Polished visuals hiding weak affordances, such as low-contrast "elegant" text, borderless inputs or ghost buttons for primary actions.

**Fixes:** Keep the polish, restore the affordances. Treat positive feedback on beautiful screens with some scepticism and watch behaviour instead.

### Parkinson's Law `heuristic`

**Claim:** Work expands to fill the time available for it.

**Source:** C. Northcote Parkinson, 1955, a satirical essay about bureaucracy.

**Evidence note:** Using this in UX is a loose analogy. It is useful for motivating faster flows, but not a law about users.

**Look for:** Flows that take longer than the task needs (extra confirmation steps, re-entering known data).

**Fixes:** Autofill, one-click reorder, remembered preferences. Set expectations ("takes about 2 minutes") so users can budget their time.

### Cognitive Bias `strong` (for well-replicated biases)

**Claim:** Systematic shortcuts in judgement, such as anchoring, defaults, framing and loss aversion, predictably shape decisions.

**Source:** Tversky and Kahneman introduced the heuristics-and-biases programme in 1972, summarised in *Science* (1974). Some individual biases replicate well (the anchoring and default effects, for example); others have weaker records.

**How to use in a review:** Mostly defensively. Check whether the interface exploits biases against users. The main forms are:
- Pre-checked consent or add-ons (default effect).
- Fake scarcity or urgency (loss aversion).
- Confirmshaming ("No thanks, I hate saving money").
- Misleading anchors in pricing.
- Asymmetric effort, where subscribing is easy and cancelling is hard.

**The reviewer's own bias:** Confirmation bias applies to the review itself. After drafting findings, look for evidence *against* each blocker (is it deliberate? does the measurement really show it?) before reporting it.

**Severity:** Report these as blockers. They harm users and can breach consumer-protection and platform law in many jurisdictions (for example the EU Digital Services Act's ban on deceptive interface design on online platforms).

**Fixes:** Defaults that serve the user, symmetric choices, honest urgency or none, and cancellation as easy as sign-up.

---

## Thresholds

| What | Value | Basis |
|---|---|---|
| Minimum target size | 24×24 CSS px, or spacing so 24px circles don't overlap | WCAG 2.2 SC 2.5.8 (AA) |
| Recommended touch target | 44×44 CSS px (Apple 44pt, Material 48dp) | WCAG 2.2 SC 2.5.5 (AAA), platform guidelines |
| Feels instant | ≤ 100ms | Miller 1968; Card et al. 1991 |
| Doherty threshold | ≤ 400ms | Doherty & Thadani 1982 |
| Interaction to Next Paint | good ≤ 200ms, poor > 500ms | Core Web Vitals |
| Largest Contentful Paint | good ≤ 2.5s, poor > 4s | Core Web Vitals |
| Cumulative Layout Shift | good ≤ 0.1, poor > 0.25 | Core Web Vitals |
| Long task | > 50ms blocks input | Long Tasks API |
| Auto-moving content | pausable if it runs > 5s; honour `prefers-reduced-motion` | WCAG 2.2 SC 2.2.2 (AA), 2.3.3 |
| Mobile input font size | ≥ 16px (avoids iOS focus zoom) | Safari behaviour |
| Group spacing | between-group gap clearly larger than within-group gap (~2×) | Gestalt proximity, practitioner rule |
| Comfortable line length | ~45–75 characters | Typographic convention (heuristic) |
