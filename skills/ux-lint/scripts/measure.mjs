#!/usr/bin/env node
/**
 * ux-lint measure — loads a page in headless Chromium and measures things
 * that UX principles make predictions about: target sizes (Fitts), number of
 * choices (Hick), form labelling and grouping (working memory, proximity),
 * call-to-action emphasis (Von Restorff), load-time overlays (flow, selective
 * attention), long text blocks (chunking) and responsiveness (Doherty).
 *
 * Usage:
 *   node measure.mjs <url-or-file> [--viewport=mobile|desktop|both]
 *                    [--out=report.json] [--screenshots=dir] [--wait=1500]
 *                    [--click="css selector"]...
 *
 * The script never clicks anything unless you pass --click explicitly,
 * so it is safe to run against pages with forms or destructive actions.
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Playwright resolution: project → skill folder → global install
// ---------------------------------------------------------------------------
function loadPlaywright() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const names = ['playwright', 'playwright-core', '@playwright/test'];
  const bases = [process.cwd(), here];
  for (const base of bases) {
    const req = createRequire(path.join(base, 'noop.js'));
    for (const name of names) {
      try { return req(name); } catch { /* try next */ }
    }
  }
  try {
    const globalRoot = execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const req = createRequire(path.join(globalRoot, 'noop.js'));
    for (const name of names) {
      try { return req(path.join(globalRoot, name)); } catch { /* try next */ }
    }
  } catch { /* npm not available */ }
  return null;
}

const pw = loadPlaywright();
if (!pw || !pw.chromium) {
  console.error([
    'ux-lint: Playwright not found.',
    'Install it in the project (or globally) and fetch Chromium, then re-run:',
    '  npm i -D playwright && npx playwright install chromium',
  ].join('\n'));
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const opts = { viewport: 'both', out: null, screenshots: null, wait: 1500, clicks: [] };
let target = null;
for (const a of args) {
  if (a.startsWith('--viewport=')) opts.viewport = a.split('=')[1];
  else if (a.startsWith('--out=')) opts.out = a.slice(6);
  else if (a.startsWith('--screenshots=')) opts.screenshots = a.slice(14);
  else if (a.startsWith('--wait=')) opts.wait = Number(a.slice(7)) || 1500;
  else if (a.startsWith('--click=')) opts.clicks.push(a.slice(8));
  else if (a === '-h' || a === '--help') { target = null; break; }
  else if (!a.startsWith('--')) target = a;
}
if (!target) {
  console.error('Usage: node measure.mjs <url-or-file> [--viewport=mobile|desktop|both] [--out=report.json] [--screenshots=dir] [--wait=ms] [--click="selector"]');
  process.exit(1);
}
if (!/^https?:\/\//.test(target) && !target.startsWith('file://')) {
  const p = path.resolve(target);
  if (fs.existsSync(p)) target = pathToFileURL(p).href;
  else target = 'http://' + target;
}

const VIEWPORTS = {
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  desktop: { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
};
const selected = opts.viewport === 'both' ? ['mobile', 'desktop'] : [opts.viewport];
for (const v of selected) {
  if (!VIEWPORTS[v]) { console.error(`Unknown viewport "${v}"`); process.exit(1); }
}

// ---------------------------------------------------------------------------
// In-page collector (runs in the browser; must be self-contained)
// ---------------------------------------------------------------------------
function collect({ isMobile, configuredWidth }) {
  const INTERACTIVE = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="radio"], [role="switch"], [role="option"], [onclick], [tabindex]:not([tabindex="-1"])';
  const vw = window.innerWidth, vh = window.innerHeight;

  // Visible = rendered, not transparent via any ancestor, and not clipped away
  // by an overflow/clip-path ancestor (collapsed dropdowns, off-canvas menus, sr-only).
  const visibleShare = (el, r) => {
    let x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      const clipX = cs.overflowX !== 'visible', clipY = cs.overflowY !== 'visible';
      const clipAll = cs.clipPath !== 'none' || (cs.clip && cs.clip !== 'auto');
      if (clipX || clipY || clipAll) {
        const ar = a.getBoundingClientRect();
        if (clipX || clipAll) { x1 = Math.max(x1, ar.left); x2 = Math.min(x2, ar.right); }
        if (clipY || clipAll) { y1 = Math.max(y1, ar.top); y2 = Math.min(y2, ar.bottom); }
        if (x2 - x1 < 1 || y2 - y1 < 1) return 0;
      }
      if (cs.position === 'fixed') break;
    }
    // Entirely outside the document (off-canvas)?
    const docW = document.documentElement.scrollWidth;
    if (x2 + window.scrollX <= 0 || y2 + window.scrollY <= 0 || x1 + window.scrollX >= docW) return 0;
    return ((x2 - x1) * (y2 - y1)) / (r.width * r.height);
  };
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.width * r.height <= 4) return false;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) return false;
    if (cs.clipPath !== 'none' && /inset\(50%|circle\(0|polygon\(0/.test(cs.clipPath)) return false;
    if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clip === 'rect(1px, 1px, 1px, 1px)') return false;
    if (el.closest('[aria-hidden="true"], [inert]')) return false;
    return visibleShare(el, r) >= 0.3;
  };

  const cssPath = (el) => {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let cur = el;
    for (let depth = 0; cur && cur.nodeType === 1 && depth < 4; depth++) {
      if (cur.id) { parts.unshift(`#${CSS.escape(cur.id)}`); break; }
      let part = cur.tagName.toLowerCase();
      const cls = [...cur.classList].filter((c) => !/[:[\]/()!]|^(css|sc|jsx|svelte)-/.test(c)).slice(0, 2);
      if (cls.length) part += '.' + cls.map((c) => CSS.escape(c)).join('.');
      const parent = cur.parentElement;
      if (parent) {
        const same = [...parent.children].filter((c) => c.tagName === cur.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      cur = parent;
    }
    return parts.join(' > ');
  };

  const text = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const labelOf = (el) => text(
    el.getAttribute('aria-label') || el.labels?.[0]?.innerText || el.innerText || el.value || el.getAttribute('title') ||
    el.getAttribute('alt') || el.querySelector?.('img[alt]')?.getAttribute('alt') ||
    el.getAttribute('placeholder') || el.getAttribute('name') || ''
  ).slice(0, 60);

  // Colour handling via a 1×1 canvas so any CSS colour syntax (oklch, color-mix…) works.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const colorCache = new Map();
  const toRGBA = (css) => {
    if (colorCache.has(css)) return colorCache.get(css);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const out = { r, g, b, a: a / 255 };
    colorCache.set(css, out);
    return out;
  };
  const hex = (c) => '#' + [c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, '0')).join('');
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const effectiveBg = (el) => {
    for (let cur = el; cur && cur.nodeType === 1; cur = cur.parentElement) {
      const c = toRGBA(getComputedStyle(cur).backgroundColor);
      if (c.a > 0.5) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const round = (n) => Math.round(n * 10) / 10;
  const rectDist = (px, py, r) => {
    const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
    const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
    return Math.hypot(dx, dy);
  };
  const edgeGap = (a, b) => {
    const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
    const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
    return Math.hypot(dx, dy);
  };

  // ------------------------------------------------------------ targets
  const all = [...document.querySelectorAll(INTERACTIVE)].filter(isVisible);
  // Keep the outermost interactive element (a button inside a link is one target).
  const outer = all.filter((el) => !el.parentElement?.closest(INTERACTIVE) || !all.includes(el.parentElement.closest(INTERACTIVE)));

  const isInlineLink = (el) => {
    if (el.tagName !== 'A') return false;
    const d = getComputedStyle(el).display;
    if (d !== 'inline') return false;
    const block = el.parentElement?.closest('p, li, td, dd, blockquote, figcaption, label');
    if (!block) return false;
    return text(block.innerText).length - text(el.innerText).length > 15;
  };

  const targets = outer.slice(0, 800).map((el) => {
    let r = rectOf(el);
    let via = null;
    // Checkbox/radio: an associated label enlarges the effective target.
    if (el.tagName === 'INPUT' && /^(checkbox|radio)$/.test(el.type) && el.labels?.length) {
      const lr = rectOf(el.labels[0]);
      const x = Math.min(r.x, lr.x), y = Math.min(r.y, lr.y);
      const w = Math.max(r.x + r.w, lr.x + lr.w) - x, h = Math.max(r.y + r.h, lr.y + lr.h) - y;
      if (w * h > r.w * r.h && edgeGap(r, lr) < 12) { r = { x, y, w, h }; via = 'label'; }
    }
    return { el, r, inline: isInlineLink(el), via };
  });

  const targetFindings = [];
  for (const t of targets) {
    if (t.inline) continue; // WCAG 2.5.8 inline exception
    const min = Math.min(t.r.w, t.r.h);
    if (min >= 44) continue;
    const cx = t.r.x + t.r.w / 2, cy = t.r.y + t.r.h / 2;
    let nearest = Infinity, spacingOk = true;
    for (const o of targets) {
      if (o === t) continue;
      nearest = Math.min(nearest, edgeGap(t.r, o.r));
      if (min < 24) {
        if (rectDist(cx, cy, o.r) < 12) spacingOk = false;
        const omin = Math.min(o.r.w, o.r.h);
        if (omin < 24 && !o.inline) {
          const ocx = o.r.x + o.r.w / 2, ocy = o.r.y + o.r.h / 2;
          if (Math.hypot(cx - ocx, cy - ocy) < 24) spacingOk = false;
        }
      }
    }
    const status = min < 24 ? (spacingOk ? 'undersized-but-spaced' : 'fail-aa') : 'below-44';
    targetFindings.push({
      status, selector: cssPath(t.el), label: labelOf(t.el), via: t.via,
      size: `${round(t.r.w)}×${round(t.r.h)}`, nearestGapPx: nearest === Infinity ? null : round(nearest),
      aboveFold: t.r.y < vh,
    });
  }

  // ------------------------------------------------------------ choices
  const navs = [...document.querySelectorAll('nav, [role="navigation"]')]
    .filter(isVisible)
    .filter((n) => !n.parentElement?.closest('nav, [role="navigation"]'))
    .map((n) => {
      const items = [...n.querySelectorAll(INTERACTIVE)].filter(isVisible);
      return { selector: cssPath(n), label: text(n.getAttribute('aria-label') || ''), visibleItems: items.length, sample: items.slice(0, 12).map(labelOf) };
    });

  const selects = [...document.querySelectorAll('select')].filter(isVisible).map((s) => ({
    selector: cssPath(s), label: labelOf(s), options: s.options.length,
  }));

  const radioGroups = {};
  document.querySelectorAll('input[type="radio"]').forEach((r) => {
    if (!r.name) return;
    radioGroups[r.name] = (radioGroups[r.name] || 0) + 1;
  });

  const aboveFoldInteractive = targets.filter((t) => t.r.y < vh && t.r.y + t.r.h > 0).length;

  // ------------------------------------------------------------ forms
  const FIELD = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea';
  const fields = [...document.querySelectorAll(FIELD)].filter(isVisible);
  const groups = new Map();
  for (const f of fields) {
    const key = f.form || f.closest('[role="form"], fieldset') || document.body;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  const intentOf = (f) => {
    const s = [f.name, f.id, f.getAttribute('autocomplete'), f.getAttribute('placeholder'), f.labels?.[0]?.innerText, f.getAttribute('aria-label')].join(' ').toLowerCase();
    if (/e-?mail|e-?post/.test(s)) return 'email';
    if (/phone|tel|mobil|telefon/.test(s)) return 'tel';
    if (/postal|zip|postnummer|postcode/.test(s)) return 'postal-code';
    if (/card.?number|cc-?num|kortnummer/.test(s)) return 'cc-number';
    if (/street|address|adress/.test(s)) return 'address';
    if (/(first|last|full|given|family|sur)[ _-]?name|förnamn|efternamn|^name$|\bnamn\b/.test(s)) return 'name';
    return null;
  };

  const forms = [];
  for (const [key, list] of groups) {
    const issues = [];
    list.forEach((f, i) => {
      const labelled = (f.labels && f.labels.length > 0) || f.getAttribute('aria-label') || f.getAttribute('aria-labelledby') || f.getAttribute('title');
      const ref = { selector: cssPath(f), name: f.name || f.id || labelOf(f) };
      if (!labelled) {
        issues.push({ rule: f.getAttribute('placeholder') ? 'form-placeholder-only' : 'form-missing-label', ...ref });
      }
      // Proximity: is the label closer to the previous field than to its own?
      const labelEl = f.labels?.[0] || (f.getAttribute('aria-labelledby') && document.getElementById(f.getAttribute('aria-labelledby').split(' ')[0]));
      if (labelEl && isVisible(labelEl) && !labelEl.contains(f)) {
        const lr = rectOf(labelEl), fr = rectOf(f);
        if (lr.y + lr.h <= fr.y + 2) {
          const own = fr.y - (lr.y + lr.h);
          const prev = list.slice(0, i).reverse().find((p) => { const pr = rectOf(p); return pr.y + pr.h <= lr.y + 1; });
          if (prev) {
            const pr = rectOf(prev);
            const gapPrev = lr.y - (pr.y + pr.h);
            if (own > 0 && gapPrev <= own) {
              issues.push({ rule: 'form-label-proximity', ...ref, labelToOwnFieldPx: round(own), labelToPreviousFieldPx: round(gapPrev) });
            }
          }
        }
      }
      if (isMobile && /^(INPUT|SELECT|TEXTAREA)$/.test(f.tagName)) {
        const fs = parseFloat(getComputedStyle(f).fontSize);
        if (fs < 16 && !/^(checkbox|radio|range|color|file)$/.test(f.type)) issues.push({ rule: 'form-input-zoom', ...ref, fontSizePx: fs });
      }
      const intent = intentOf(f);
      if (intent === 'email' && f.type !== 'email') issues.push({ rule: 'form-input-type', ...ref, expected: 'type="email"', actual: `type="${f.type}"` });
      if (intent === 'tel' && f.type !== 'tel') issues.push({ rule: 'form-input-type', ...ref, expected: 'type="tel"', actual: `type="${f.type}"` });
      if (intent && !f.getAttribute('autocomplete')) issues.push({ rule: 'form-autocomplete', ...ref, suggested: intent });
    });
    forms.push({
      selector: key === document.body ? '(fields outside any <form>)' : cssPath(key),
      visibleFields: list.length,
      required: list.filter((f) => f.required || f.getAttribute('aria-required') === 'true').length,
      issues,
    });
  }

  // ------------------------------------------------------------ CTA emphasis
  const ctaCandidates = targets
    .map((t) => t.el)
    .filter((el) => el.matches('button, [role="button"], input[type="submit"], input[type="button"], a'))
    .filter((el) => { for (let c = el; c && c.nodeType === 1; c = c.parentElement) { if (getComputedStyle(c).position === 'fixed') return false; } return true; });
  const ctas = ctaCandidates.map((el) => {
    const cs = getComputedStyle(el);
    const bg = toRGBA(cs.backgroundColor);
    const surround = effectiveBg(el.parentElement || el);
    const filled = bg.a > 0.5;
    const ratio = filled ? contrast(bg, surround) : 1;
    const r = rectOf(el);
    const emphasis = filled && ratio >= 2.5 ? 'high' : (filled || parseFloat(cs.borderTopWidth) > 0 ? 'medium' : 'low');
    return {
      selector: cssPath(el), label: labelOf(el), emphasis,
      signature: filled ? `${hex(bg)} / ${hex(toRGBA(cs.color))}` : null,
      contrastWithSurround: round(ratio), aboveFold: r.y < vh && r.y + r.h > 0, areaPx: Math.round(r.w * r.h),
    };
  });
  const highAbove = ctas.filter((c) => c.aboveFold && c.emphasis === 'high');
  const sigCounts = {};
  highAbove.forEach((c) => { sigCounts[c.signature] = (sigCounts[c.signature] || 0) + 1; });

  // ------------------------------------------------------------ overlays at load
  const overlays = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (!isVisible(el)) continue;
    const bg = toRGBA(cs.backgroundColor);
    if (bg.a < 0.1 && cs.backdropFilter === 'none') continue; // transparent wrapper; its children get checked
    const r = el.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    const coverage = (w * h) / (vw * vh);
    if (cs.position === 'fixed' && coverage >= 0.2) {
      overlays.push({ kind: 'fixed', selector: cssPath(el), coverage: round(coverage * 100), text: text(el.innerText).slice(0, 80) });
    } else if (cs.position === 'sticky' && h / vh >= 0.2) {
      overlays.push({ kind: 'sticky', selector: cssPath(el), heightShareOfViewport: round((h / vh) * 100), text: text(el.innerText).slice(0, 40) });
    }
  }
  // Drop overlays nested in another reported overlay.
  const overlayEls = overlays.map((o) => document.querySelector(o.selector));
  const topOverlays = overlays.filter((o, i) => !overlayEls.some((p, j) => j !== i && p && overlayEls[i] && p !== overlayEls[i] && p.contains(overlayEls[i])));

  // ------------------------------------------------------------ text
  const paragraphs = [...document.querySelectorAll('p')].filter(isVisible).map((p) => ({ selector: cssPath(p), words: text(p.innerText).split(' ').filter(Boolean).length }));
  const longParagraphs = paragraphs.filter((p) => p.words > 80).sort((a, b) => b.words - a.words);
  const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(isVisible);

  const scrollWidth = document.documentElement.scrollWidth;
  const overflows = vw > configuredWidth + 1 || scrollWidth > vw + 1;
  let offenders = [];
  if (overflows) {
    const limit = configuredWidth + 1;
    offenders = [...document.querySelectorAll('body *')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.right > limit && r.width > 0 && r.height > 0; })
      .filter((el) => { const pr = el.parentElement?.getBoundingClientRect(); return !pr || pr.right <= limit || el.parentElement === document.body; })
      .filter((el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.position !== 'fixed'; })
      .map((el) => ({ selector: cssPath(el), right: Math.round(el.getBoundingClientRect().right), width: Math.round(el.getBoundingClientRect().width) }))
      .sort((a, b) => b.right - a.right)
      .slice(0, 3);
  }
  const overflow = { configuredWidth, layoutWidth: vw, scrollWidth, overflows, offenders };

  return {
    viewport: { width: vw, height: vh, isMobile },
    overflow,
    title: document.title,
    targets: { total: targets.length, aboveFold: aboveFoldInteractive, findings: targetFindings },
    choices: { navs, selects, radioGroups },
    forms,
    ctas: { aboveFoldHighEmphasis: highAbove, signatureCounts: sigCounts, totalButtons: ctas.length },
    overlays: topOverlays,
    text: { paragraphs: paragraphs.length, longParagraphs: longParagraphs.slice(0, 10), headings: headings.length, h1: headings.filter((h) => h.tagName === 'H1').length },
  };
}

// Long-running, large animations (ignores small spinners/indicators).
function collectMotion() {
  if (!document.getAnimations) return null;
  const vw = window.innerWidth, vh = window.innerHeight;
  const out = [];
  for (const a of document.getAnimations()) {
    if (a.playState !== 'running') continue;
    const t = a.effect?.getComputedTiming?.();
    if (!t || !(t.iterations === Infinity || t.activeDuration === Infinity || t.activeDuration > 5000)) continue;
    const el = a.effect.target;
    if (!el?.getBoundingClientRect) continue;
    const r = el.getBoundingClientRect();
    if (r.width * r.height < 10000 || r.bottom < 0 || r.top > vh) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const id = el.id ? `#${el.id}` : el.tagName.toLowerCase() + [...el.classList].slice(0, 2).map((c) => `.${c}`).join('');
    out.push({ selector: id, animation: a.animationName || a.id || 'animation', coverage: Math.round((r.width * r.height) / (vw * vh) * 100) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Findings: turn raw measurements into principle-tagged findings
// ---------------------------------------------------------------------------
function toFindings(vpName, data, perf, clicks, motion) {
  const f = [];
  const add = (rule, severity, principle, evidence, where = null) => f.push({ viewport: vpName, rule, severity, principle, evidence, where });
  const mobile = data.viewport.isMobile;

  for (const t of data.targets.findings) {
    const where = `${t.selector}${t.label ? ` ("${t.label}")` : ''}`;
    if (t.status === 'fail-aa') add('target-size-aa', mobile ? 'blocker' : 'major', "Fitts's Law", `${t.size}px, nearest target ${t.nearestGapPx}px away — below WCAG 2.2 AA minimum (24×24 or spacing exception)`, where);
    else if (t.status === 'undersized-but-spaced' && mobile) add('target-size-small', 'minor', "Fitts's Law", `${t.size}px — passes AA only via spacing; 44×44 recommended for touch`, where);
    else if (t.status === 'below-44' && mobile) add('target-size-recommended', 'minor', "Fitts's Law", `${t.size}px — below the 44×44 touch recommendation (Apple HIG / WCAG 2.5.5 AAA)`, where);
  }

  if (data.overflow.overflows) {
    const ov = data.overflow;
    add('horizontal-overflow', mobile ? 'major' : 'minor', "Jakob's Law / Fitts's Law", `Content is wider than the ${ov.configuredWidth}px viewport (layout ${ov.layoutWidth}px, scroll width ${ov.scrollWidth}px). ${mobile ? 'On phones the page zooms out or scrolls sideways, which makes every target physically smaller' : 'A horizontal scrollbar appears and content can be cut off'}${mobile && ov.layoutWidth > ov.configuredWidth ? ` (~${Math.round((ov.configuredWidth / ov.layoutWidth) * 100)}% of intended size)` : ''}. ${ov.offenders.length ? ` Widest offenders: ${ov.offenders.map((o) => `${o.selector} (right edge ${o.right}px)`).join('; ')}.` : ''} Verify on a real device — off-canvas elements can trigger this in emulation.`);
  }

  for (const n of data.choices.navs) {
    if (n.visibleItems > 9) add('nav-many-items', 'minor', "Hick's Law", `${n.visibleItems} visible items in one navigation. Count alone is not a problem if items are well-labelled and grouped — check the grouping before cutting.`, n.selector);
  }
  for (const s of data.choices.selects) {
    if (s.options > 15) add('select-long', 'minor', "Hick's Law / Choice Overload", `<select> with ${s.options} options — consider a searchable combobox, sensible default or grouping (<optgroup>)`, `${s.selector} ("${s.label}")`);
  }

  for (const form of data.forms) {
    if (form.visibleFields > 8) add('form-many-fields', 'minor', 'Cognitive Load / Chunking (heuristic)', `${form.visibleFields} visible fields (${form.required} required) in one step — check which can be removed, deferred, defaulted or grouped into sections`, form.selector);
    for (const i of form.issues) {
      const where = `${i.selector} (${i.name})`;
      if (i.rule === 'form-placeholder-only') add(i.rule, 'major', 'Working Memory', 'Placeholder used as the only label — it disappears on input, so users must remember what the field was for', where);
      if (i.rule === 'form-missing-label') add(i.rule, 'major', 'Working Memory / Mental Model', 'Field has no programmatic or visible label', where);
      if (i.rule === 'form-label-proximity') add(i.rule, 'major', 'Law of Proximity', `Label is ${i.labelToOwnFieldPx}px from its own field but ${i.labelToPreviousFieldPx}px from the previous field — it visually groups with the wrong input`, where);
      if (i.rule === 'form-input-zoom') add(i.rule, 'minor', 'Flow / Doherty Threshold', `Input font-size ${i.fontSizePx}px — iOS Safari zooms the page on focus below 16px`, where);
      if (i.rule === 'form-input-type') add(i.rule, 'minor', "Tesler's Law / Postel's Law", `Expected ${i.expected}, found ${i.actual} — the right type gives the right mobile keyboard and validation`, where);
      if (i.rule === 'form-autocomplete') add(i.rule, 'minor', "Tesler's Law", `Missing autocomplete (suggest autocomplete="${i.suggested === 'name' ? 'name' : i.suggested === 'address' ? 'street-address' : i.suggested}") — let the browser absorb the typing`, where);
    }
  }

  const sigs = Object.entries(data.ctas.signatureCounts);
  if (sigs.length > 1) add('cta-competing', 'major', 'Von Restorff Effect / Hick\'s Law', `${sigs.length} different high-emphasis button styles above the fold (${sigs.map(([s, c]) => `${s} ×${c}`).join(', ')}) — no single primary action stands out`);
  for (const [sig, count] of sigs) {
    if (count >= 3) add('cta-overused', 'major', 'Von Restorff Effect', `Primary style ${sig} used on ${count} buttons above the fold — when everything is emphasised, nothing is`, data.ctas.aboveFoldHighEmphasis.filter((c) => c.signature === sig).map((c) => `"${c.label}"`).join(', '));
  }
  if (sigs.length === 0 && data.ctas.totalButtons >= 2) add('cta-none-above-fold', 'minor', 'Von Restorff Effect / Selective Attention', 'No high-emphasis action visible above the fold — confirm the primary task is obvious without scrolling');

  for (const o of data.overlays) {
    if (o.kind === 'fixed') add('overlay-on-load', mobile && o.coverage >= 60 ? 'blocker' : 'major', 'Flow / Selective Attention', `Fixed layer covers ${o.coverage}% of the viewport on load${o.text ? `: "${o.text}"` : ''}`, o.selector);
    else add('sticky-heavy', 'minor', 'Selective Attention', `Sticky element takes ${o.heightShareOfViewport}% of viewport height`, o.selector);
  }

  for (const p of data.text.longParagraphs) add('text-wall', 'minor', 'Chunking', `Paragraph with ${p.words} words — break up with subheadings, lists or shorter paragraphs`, p.selector);

  if (perf.fcp && perf.fcp > 1800) add('perf-fcp', 'major', 'Doherty Threshold', `First contentful paint ${Math.round(perf.fcp)}ms — users see nothing for longer than the ~1s limit for staying in flow`);
  if (perf.lcp && perf.lcp > 2500) add('perf-lcp', perf.lcp > 4000 ? 'blocker' : 'major', 'Doherty Threshold', `Largest contentful paint ${Math.round(perf.lcp)}ms (good ≤ 2500ms)`);
  const longTotal = (perf.longTasks || []).reduce((a, b) => a + b, 0);
  const longMax = Math.max(0, ...(perf.longTasks || []));
  if (longMax > 400 || longTotal > 600) add('perf-long-tasks', 'major', 'Doherty Threshold', `Main thread blocked: longest task ${longMax}ms, ${perf.longTasks.length} long tasks totalling ${longTotal}ms — taps during load will feel ignored`);
  if (perf.cls > 0.1) add('perf-cls', perf.cls > 0.25 ? 'major' : 'minor', "Fitts's Law / Selective Attention", `Cumulative layout shift ${perf.cls.toFixed(3)} (good ≤ 0.1) — moving targets cause mis-taps and lost reading position`);

  if (motion && motion.underReducedMotion && motion.underReducedMotion.length) {
    for (const m of motion.underReducedMotion) {
      add('motion-ignores-preference', m.coverage >= 25 ? 'major' : 'minor', 'Von Restorff Effect / Selective Attention', `Long-running animation "${m.animation}" (${m.coverage}% of viewport) keeps playing when the user has asked for reduced motion — can trigger vestibular symptoms; also check it can be paused (WCAG 2.2.2)`, m.selector);
    }
  }

  for (const c of clicks) {
    if (c.blockedBy) { add('target-obscured', 'blocker', 'Flow / Selective Attention', `Could not click: ${c.error}`, c.selector); continue; }
    if (c.error) { add('interaction-error', 'minor', 'Doherty Threshold', `Could not measure click: ${c.error}`, c.selector); continue; }
    if (c.durationMs == null) continue;
    if (c.durationMs > 1000) add('interaction-latency', 'blocker', 'Doherty Threshold', `Click → next paint took ${c.durationMs}ms`, c.selector);
    else if (c.durationMs > 400) add('interaction-latency', 'major', 'Doherty Threshold', `Click → next paint took ${c.durationMs}ms (> 400ms)`, c.selector);
    else if (c.durationMs > 200) add('interaction-latency', 'minor', 'Doherty Threshold', `Click → next paint took ${c.durationMs}ms (INP "needs improvement" > 200ms)`, c.selector);
  }
  return f;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const browser = await pw.chromium.launch();
const report = { url: target, measuredAt: new Date().toISOString(), note: 'Timings from a local/headless run are indicative only; confirm with field data (CrUX/RUM) before prioritising performance work.', viewports: {}, findings: [] };

for (const vpName of selected) {
  const context = await browser.newContext(VIEWPORTS[vpName]);
  await context.addInitScript(() => {
    window.__uxlint = { lcp: 0, longTasks: [], cls: 0, events: [] };
    const obs = (type, cb, extra = {}) => { try { new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe({ type, buffered: true, ...extra }); } catch { /* unsupported */ } };
    obs('largest-contentful-paint', (e) => { window.__uxlint.lcp = e.renderTime || e.loadTime || e.startTime; });
    obs('longtask', (e) => { window.__uxlint.longTasks.push(Math.round(e.duration)); });
    obs('layout-shift', (e) => { if (!e.hadRecentInput) window.__uxlint.cls += e.value; });
    obs('event', (e) => { window.__uxlint.events.push({ name: e.name, duration: e.duration, start: e.startTime }); }, { durationThreshold: 16 });
  });
  const page = await context.newPage();
  const failedAssets = [];
  page.on('requestfailed', (r) => { if (/^(stylesheet|script|font)$/.test(r.resourceType())) failedAssets.push({ type: r.resourceType(), url: r.url().slice(0, 120), reason: r.failure()?.errorText }); });
  page.on('response', (r) => { const t = r.request().resourceType(); if (/^(stylesheet|script)$/.test(t) && r.status() >= 400) failedAssets.push({ type: t, url: r.url().slice(0, 120), reason: `HTTP ${r.status()}` }); });
  let loadError = null;
  try {
    await page.goto(target, { waitUntil: 'load', timeout: 45000 });
  } catch (e) { loadError = e.message.split('\n')[0]; }
  if (loadError && !(await page.content()).includes('<body')) {
    console.error(`ux-lint: could not load ${target} (${loadError})`);
    await browser.close();
    process.exit(3);
  }
  await page.waitForTimeout(opts.wait);

  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    const u = window.__uxlint || {};
    return { ttfb: nav?.responseStart ?? null, domContentLoaded: nav?.domContentLoadedEventEnd ?? null, load: nav?.loadEventEnd ?? null, fcp: fcp?.startTime ?? null, lcp: u.lcp || null, cls: u.cls || 0, longTasks: u.longTasks || [] };
  });

  const data = await page.evaluate(collect, { isMobile: VIEWPORTS[vpName].isMobile, configuredWidth: VIEWPORTS[vpName].viewport.width });

  if (opts.screenshots) {
    fs.mkdirSync(opts.screenshots, { recursive: true });
    const file = path.join(opts.screenshots, `${vpName}.png`);
    await page.screenshot({ path: file, fullPage: false });
    data.screenshot = file;
  }

  // Optional, explicit interaction timing (Event Timing API).
  const clicks = [];
  for (const sel of opts.clicks) {
    try {
      const before = await page.evaluate(() => performance.now());
      await page.click(sel, { timeout: 5000 });
      await page.waitForTimeout(1200);
      const ev = await page.evaluate((t0) => (window.__uxlint.events || []).filter((e) => e.start >= t0 && /^(pointerdown|pointerup|mousedown|mouseup|click|keydown)$/.test(e.name)), before);
      const duration = ev.length ? Math.round(Math.max(...ev.map((e) => e.duration))) : null;
      clicks.push({ selector: sel, durationMs: duration, note: duration == null ? 'No event entries ≥16ms recorded — interaction was fast (or produced no paint).' : undefined });
    } catch (e) {
      const blocker = /(<[^>]+>)[^\n]*intercepts pointer events/.exec(e.message);
      clicks.push({ selector: sel, blockedBy: blocker ? blocker[1].slice(0, 80) : null, error: blocker ? `element is covered by ${blocker[1].slice(0, 80)} — users cannot click it either` : e.message.split('\n')[0] });
    }
  }

  // Motion: count long-running animations normally, then reload with reduced motion requested.
  let motion = null;
  try {
    const normal = await page.evaluate(collectMotion);
    let underReducedMotion = [];
    if (normal && normal.length) {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.reload({ waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(Math.min(opts.wait, 1500));
      underReducedMotion = (await page.evaluate(collectMotion)) || [];
    }
    motion = { normal: normal || [], underReducedMotion };
  } catch (e) { motion = { error: e.message.split('\n')[0] }; }

  report.viewports[vpName] = { ...data, perf, clicks, failedAssets, motion };
  report.findings.push(...toFindings(vpName, data, perf, clicks, motion));
  await context.close();
}
await browser.close();

if (opts.out) fs.writeFileSync(opts.out, JSON.stringify(report, null, 2));

// ---------------------------------------------------------------------------
// Compact human-readable summary (keeps agent context small)
// ---------------------------------------------------------------------------
const order = { blocker: 0, major: 1, minor: 2 };
const lines = [];
lines.push(`ux-lint measure — ${target}`);
for (const [vp, d] of Object.entries(report.viewports)) {
  const p = d.perf;
  lines.push(`\n[${vp} ${d.viewport.width}×${d.viewport.height}] "${d.title}"`);
  lines.push(`  interactive targets: ${d.targets.total} (${d.targets.aboveFold} above fold) · forms: ${d.forms.length} · navs: ${d.choices.navs.map((n) => n.visibleItems).join('/') || 0} items · headings: ${d.text.headings} (h1: ${d.text.h1})`);
  lines.push(`  timing: FCP ${p.fcp ? Math.round(p.fcp) + 'ms' : 'n/a'} · LCP ${p.lcp ? Math.round(p.lcp) + 'ms' : 'n/a'} · CLS ${p.cls.toFixed(3)} · long tasks ${p.longTasks.length}${p.longTasks.length ? ` (max ${Math.max(...p.longTasks)}ms)` : ''}`);
  const css = d.failedAssets.filter((a) => a.type === 'stylesheet').length, js = d.failedAssets.filter((a) => a.type === 'script').length;
  if (css || js) lines.push(`  ⚠ WARNING: ${css} stylesheet(s) and ${js} script(s) failed to load (e.g. ${d.failedAssets[0].url} — ${d.failedAssets[0].reason}). The page may be rendering unstyled or half-hydrated, so size/layout findings are NOT reliable. Fix asset loading (network, auth, dev server) and re-run before reporting.`);
  for (const c of d.clicks) lines.push(`  click ${c.selector}: ${c.error ? 'error — ' + c.error : c.durationMs == null ? 'fast (<16ms event duration)' : c.durationMs + 'ms'}`);
  if (d.screenshot) lines.push(`  screenshot: ${d.screenshot}`);
}
const byRule = {};
for (const f of report.findings) (byRule[`${f.severity}|${f.rule}|${f.viewport}`] ||= []).push(f);
const keys = Object.keys(byRule).sort((a, b) => order[a.split('|')[0]] - order[b.split('|')[0]]);
const counts = report.findings.reduce((acc, f) => ((acc[f.severity] = (acc[f.severity] || 0) + 1), acc), {});
lines.push(`\nFindings: ${counts.blocker || 0} blocker · ${counts.major || 0} major · ${counts.minor || 0} minor`);
for (const k of keys) {
  const [sev, rule, vp] = k.split('|');
  const list = byRule[k];
  lines.push(`\n${sev.toUpperCase()} ${rule} [${vp}] — ${list[0].principle} (${list.length})`);
  for (const f of list.slice(0, 5)) lines.push(`  • ${f.evidence}${f.where ? `\n    at ${f.where}` : ''}`);
  if (list.length > 5) lines.push(`  … ${list.length - 5} more${opts.out ? ` (see ${opts.out})` : ' (use --out=file.json for all)'}`);
}
lines.push(`\n${report.note}`);
console.log(lines.join('\n'));
