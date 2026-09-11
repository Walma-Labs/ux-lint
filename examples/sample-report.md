# ux-lint: examples/bad-landing.html

**Main task:** start a trial (assumed from the hero CTA and the sign-up form)
**Method:** measured at mobile 390×844 and desktop 1440×900 with `measure.mjs --click="#send"`, plus a code read of the HTML/CSS
**Result:** 4 blockers · 4 major · 3 minor

## Findings

### 🔴 Blocker: Cookie banner covers the sign-up form and blocks the Send button
- **Principle:** Flow / Selective Attention (moderate / strong evidence)
- **Where:** `#cookie` (CSS line 12)
- **Evidence:** the fixed layer covers 74% of the desktop viewport and ~40% on mobile. On desktop the Send button could not be clicked at all: `<div id="cookie">` intercepts the pointer.
- **Impact:** a visitor who ignores the banner, which most people try to do, cannot complete the main task.
- **Fix:**
  ```diff
  - #cookie{position:fixed;inset:auto 0 0 0;height:70vh;background:rgba(0,0,0,.85);color:#fff;padding:20px}
  + #cookie{position:fixed;inset:auto 16px 16px auto;max-width:420px;padding:16px;border-radius:12px;background:#111;color:#fff}
  ```

### 🔴 Blocker: Consent banner offers "Accept all" but no equally easy way to reject
- **Principle:** Cognitive Bias: asymmetric effort / default effect (strong evidence)
- **Where:** `#cookie` markup (`<button>Accept all</button> <button>Settings</button>`)
- **Evidence:** code read. Rejecting takes an extra step through Settings; accepting takes one click.
- **Impact:** this nudges users into consent against their preference. EU data-protection authorities expect rejecting to be as easy as accepting.
- **Fix:**
  ```diff
  - We use cookies. <button>Accept all</button> <button>Settings</button>
  + We use cookies. <button>Reject all</button> <button>Accept all</button> <a href="/cookies">Settings</a>
  ```
  Give both buttons the same visual weight.

### 🔴 Blocker: Header icons and the Send button are too small and crowded to hit reliably
- **Principle:** Fitts's Law (strong evidence)
- **Where:** `header a.icon` ×3 (search, cart, profile); `#send`
- **Evidence:**
  - Icons measure 18×18px with 4px between them.
  - Send measures 47×21px and sits 1px from the country select.
  - Both fail the WCAG 2.2 AA 24px minimum and have no spacing exception.
- **Impact:** mis-taps on mobile. The submit button for the main task is the hardest control on the page to hit.
- **Fix:**
  ```diff
  - .icon{display:inline-block;width:18px;height:18px;background:#ccc}
  + .icon{display:inline-grid;place-items:center;width:44px;height:44px}
  + .icon::before{content:"";width:18px;height:18px;background:#ccc} /* visual stays 18px */
  + #send{min-height:48px;padding:0 24px;margin-top:16px}
  ```

### 🔴 Blocker: The page is 736px wide on a 390px phone
- **Principle:** Jakob's Law / Fitts's Law (heuristic / strong evidence)
- **Where:** `nav`. The links have no whitespace between them (`</a><a>`), so the line can never wrap.
- **Evidence:** layout width is 736px against a 390px viewport. The offending elements are the nav links, with a right edge at 730px.
- **Impact:** the phone zooms the whole page to about 53%, which halves every target and makes all other Fitts findings roughly twice as bad. The script rated this major; I raised it to blocker because it multiplies every other problem on mobile, the main path.
- **Fix:**
  ```diff
  - nav a{margin:0 6px;font-size:14px}
  + nav{display:flex;flex-wrap:wrap;gap:4px 16px}
  + nav a{display:inline-flex;align-items:center;min-height:44px;font-size:16px}
  ```

### 🟠 Major: Four buttons compete for "primary"
- **Principle:** Von Restorff Effect (strong evidence) · Hick's Law (strong evidence)
- **Where:** hero buttons `.cta1`, `.cta2` ×2, `.cta3`
- **Evidence:** 3 different high-emphasis styles (red, blue ×2, green) above the fold. Nothing stands out, because everything does.
- **Impact:** "Start trial", the main task, gets the same visual weight as "Watch video".
- **Fix:** keep one primary button and downgrade the rest.
  ```diff
  - <button class="cta1">Start trial</button> <button class="cta2">Book demo</button> <button class="cta3">Contact sales</button> <button class="cta2">Watch video</button>
  + <button class="btn-primary">Start trial</button> <button class="btn-secondary">Book demo</button>
  + <a href="/sales">Contact sales</a> · <a href="#video">Watch video</a>
  ```

### 🟠 Major: Labels sit closer to the previous field than to their own
- **Principle:** Law of Proximity (strong evidence)
- **Where:** `label[for=email]`, `label[for=ph]`
- **Evidence:** each label is 20px from its own input but 2px from the input above it.
- **Impact:** "Email" reads as the label for the name field. Users hesitate or type into the wrong box.
- **Fix:** the margins are simply reversed.
  ```diff
  - form label{display:block;margin-top:2px;margin-bottom:20px;font-size:13px}
  + form label{display:block;margin-top:20px;margin-bottom:4px}
  ```

### 🟠 Major: Two fields have no persistent label
- **Principle:** Working Memory (strong evidence)
- **Where:** `input[name=fullname]` (placeholder only); `select[name=country]` (no label, options are "1"–"20")
- **Evidence:** measured; no programmatic label on either field.
- **Impact:** the name hint vanishes as soon as the user types. The select is meaningless without context.
- **Fix:**
  ```diff
  - <input name="fullname" placeholder="Full name">
  + <label for="fullname">Full name</label><input id="fullname" name="fullname" autocomplete="name">
  + <label for="country">Country</label>
    <select id="country" name="country">…real country names, with the user's locale pre-selected…</select>
  ```

### 🟠 Major: Send reacts after 608ms, and the page blocks input for 500ms while loading
- **Principle:** Doherty Threshold (moderate evidence)
- **Where:** `#send` inline `onclick`; the inline `<script>` at the end of `<body>`
- **Evidence:** measured locally. Click to next paint took 608ms, and one long task of ~500ms ran during load.
- **Impact:** users click Send again or assume it is broken.
- **Fix:** acknowledge the click immediately and move the work off the main thread.
  ```js
  send.addEventListener('click', async () => {
    send.disabled = true; send.textContent = 'Sending…';   // feedback < 100ms
    await submit();                                         // async, not a busy loop
    send.textContent = 'Done';
  });
  ```

### 🟡 Minor: Browser can't help fill the form
- **Principle:** Tesler's Law / Postel's Law (heuristic)
- **Where:** `#email`, `#ph`
- **Evidence:** both fields are `type="text"` and have no `autocomplete`.
- **Fix:** `type="email" autocomplete="email"` and `type="tel" autocomplete="tel"`. This gives the right mobile keyboard and one-tap autofill.

### 🟡 Minor: Inputs trigger zoom on iPhone
- **Principle:** Flow (heuristic as UI guidance)
- **Where:** `form input` (13px), `select` (13.3px)
- **Fix:** `font-size:16px` on form controls.

### 🟡 Minor: 90-word paragraph above the form
- **Principle:** Chunking (strong evidence)
- **Where:** `body > p`
- **Fix:** replace it with a one-line value proposition and 3 short benefit bullets.

## What works
- CTA labels are verb-first and specific ("Start trial", "Book demo"), which fits users' mental model of what happens next.
- The page loads quickly (FCP under 600ms locally) once the blocking script is removed.

## Deliberately not flagged
- The 12-item navigation is **not** a Miller's Law problem: that law concerns what people must remember, and these items stay visible. Once the wrapping is fixed, check whether the items group logically (Product / Company / Help) before cutting any.

## Not checked
- Success and error states after a real submission (the example has no backend).
- Real-network performance. Timings were measured locally, so confirm with field data.
- Keyboard and screen-reader flow. Run a dedicated accessibility audit (e.g. axe) alongside this.
