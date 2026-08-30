# 🎬 Animations Service

Declarative, attribute-driven animation engine for LandingPageBuilder pages.
You annotate DOM elements with an `animation` attribute; the service scans the document,
runs the right module, and reports completion via a bubbling custom event that powers
sequenced (chained) reveals.

Every animation lives in its own self-contained **behaviour module** under `behaviours/`,
following the same contract pioneered by `typewriter.ts`.

---

## 📁 Folder layout

```
Services/Animations/
├── Animations.css          # Base visibility rules + cursor/mask keyframes
├── Animations.ts           # Orchestrator: scanning, config, chaining, lifecycle
└── behaviours/
    ├── typewriter.ts       # TypewriterBehaviour   (type / rewrite / loop engine)
    ├── stagger-fade.ts     # StaggerFadeBehaviour  (per-sentence or per-line reveal)
    ├── fade-in.ts          # FadeInBehaviour       (WAAPI translate+opacity entrance)
    ├── scramble.ts         # ScrambleBehaviour     (Matrix/Cyberpunk text decode)
    └── count-up.ts         # CountUpBehaviour      (numeric stub, see roadmap)
```

## 🧩 Module matrix

| `animation="…"` | Module | Class | Status |
|---|---|---|---|
| `typewriter` | `behaviours/typewriter.ts` | `TypewriterBehaviour` | ✅ Full (type / delete / rewrite / loop) |
| `stagger-fade` | `behaviours/stagger-fade.ts` | `StaggerFadeBehaviour` | ✅ Full (WAAPI, sentence/line modes) |
| `fade-in` | `behaviours/fade-in.ts` | `FadeInBehaviour` | ✅ Full (WAAPI) |
| `text-scramble` | `behaviours/scramble.ts` | `ScrambleBehaviour` | ✅ Full |
| `count-up` | `behaviours/count-up.ts` | `CountUpBehaviour` | 🚧 Stub (writes `data-target-number`) |

## 🏗 Architecture

```
HTML [animation] ──▶ AnimationsService.init()
                      │  querySelectorAll('[animation]')
                      │  ├─ animation-chain="true" → hide now, wait for predecessor's 'animation:done'
                      │  └─ otherwise              → _triggerAnimation(node)
                      ▼
                switch (animationType)                    // _triggerAnimation
                      ├── TypewriterBehaviour.animate(node, opts, () => done(node))
                      ├── StaggerFadeBehaviour.animate(node, opts, el => done(el)) ← per segment!
                      ├── FadeInBehaviour.animate(node, opts, () => done(node))
                      ├── ScrambleBehaviour.animate(node, opts, () => done(node))
                      └── CountUpBehaviour.animate(node)                            // no event yet
                      ▼
   _dispatchDoneEvent(originEl)
        new CustomEvent('animation:done', { bubbles: true, detail: { origin } })
        dispatched on the element's PARENT.
                      ▼
   Next chained sibling — listening { once: true } on that same parent — starts.
```

### The behaviour-module contract

Every file in `behaviours/` follows the same shape:

1. **Exported `<Name>Options` interface** — the tuning surface (mirrored as
   `Partial<...>` fields inside `AnimationServiceConfig`).
2. **Exported class** exposing a single static entry point:
   `animate(node, options, onDone?)`.
3. **All internals `_`-prefixed private statics** (`_typeOut`, `_buildSegments`,
   `_punctuationRhythm`, …) so public API and helpers are visually distinct.
4. **Attribute resolution lives inside the behaviour** (`data-tw-loop`,
   `data-stagger-mode`, …); the service only feeds tuning options from config.
5. **Completion is reported only through `onDone`**, which the service converts into the
   `animation:done` event. Stagger-fade is the one deliberate exception: its callback is
   `onSegmentDone(el)` because the legacy engine fired the event per segment.

### Lifecycle & memory safety

- Long-running loops check `node.isConnected` between every tick/step, bailing out the
  moment an animated node leaves the DOM.
- A document-wide `MutationObserver` (`childList, subtree`) watches for removed nodes;
  when a tracked animated element is detached, its `shouldStop` flag is raised and the
  entry is deleted from `activeAnimations`.
- `destroy()` disconnects the observer and force-stops every tracked animation.
- `getCharacters` / segment splitting uses `Intl.Segmenter` (grapheme/sentence), so emoji
  and multi-codepoint characters survive intact; locale falls back to `document.documentElement.lang`
  or `'id'`.

## 🚀 Quick start

The builder already instantiates the service (`LandingPage.ts` → `new AnimationsService()`).
To drive it manually:

```ts
import { AnimationsService } from "@lib/LandingPageBuilder/Services/Animations/Animations";

const animations = new AnimationsService({
  delay: 500,                                    // global inter-sentence pause (ms)
  typewriter:  { interval: 40, loop: false },
  staggerFade: { delay: 120, duration: '0.6s' },
  fade:        { duration: '0.5s' },
  scramble:    { chars: '!<>-_\\/[]{}—=+*^?#________', speed: 40 },
});

// Call ONCE after your page / Virtual-DOM has been rendered:
animations.init();

// …and when tearing the page down:
animations.destroy();
```

## ⚙️ Config reference (`AnimationServiceConfig`)

| Key | Type | Default | Used by |
|---|---|---|---|
| `delay` | `number` | `500` | Global fallback for inter-sentence typing pauses |
| `typewriter.loop` | `boolean \| number` | `false` | typewriter |
| `typewriter.interval` | `number \| number[]` | `30` | typewriter (array ⇒ random per-character rhythm) |
| `typewriter.delay` | `number` | `config.delay` | typewriter *(note ¹)* |
| `typewriter.rewrite` | `boolean` | `false` | typewriter rewrite mode |
| `staggerFade.delay` | `number` | `5000` ⚠️ | stagger-fade — ms added *per segment index* |
| `staggerFade.duration` | `string` | `'0.6s'` | stagger-fade segment duration (`'s'` or `'ms'`) |
| `fade.duration` | `string` | `'0.5s'` | fade-in (exposed as CSS var `--fade-duration`) |
| `scramble.chars` | `string` | `'!<>-_\\/[]{}—=+*^?#________'` | scramble pool |
| `scramble.speed` | `number` | `40` | scramble step duration (ms) |

> **¹ Parity note:** although `typewriter.delay` exists in config, the runtime sentence
> pause always comes from the element's `data-delay` attribute, falling back to the global
> `delay` (`_getDelayTime`). This deliberately preserves the legacy handler's behaviour and
> is enforced by a documented contract on `TypewriterOptions.delay`.

> ⚠️ **`staggerFade.delay` default is a legacy value (5000 ms *per segment*).** Set it
> yourself — e.g. `80–150` — unless you want a multi-second theatrical cascade.

---

## 🌐 HTML API (attributes)

| Attribute | Values | Effect |
|---|---|---|
| `animation` | type name | **Required.** Selects the behaviour module. |
| `animation-chain="true"` | flag | Start hidden; run only after the previous sibling finishes. |
| `data-delay` | integer ms | Override global typing-pause delay for this element. |
| `data-tw-loop` | `"true"` \| number | Per-element typewriter loop override. |
| `data-tw-rewrite` | `"true"` | Per-element typewriter rewrite-mode override. |
| `data-stagger-mode` | `"sentence"` (default) \| `"line"` | How stagger-fade segments content. |
| `data-fade-delay` | CSS time (`'0.2s'`) | Fade-in delay via `--fade-delay`. |

## 🎨 CSS hooks shipped in `Animations.css`

| Selector | Purpose |
|---|---|
| `[animation="typewriter"]` | `overflow:hidden` clipping baseline for typed text. |
| `[animation="fade-in"]` | `display:none` until the WAAPI keyframe reveals it. |
| `.tw-writing` + `@keyframes tw-blink` | Blinking `\|` caret appended while typing. |
| `.stagger-reveal-item` | Legacy gradient-mask reveal styles kept for reference; motion is now driven by WAAPI instead. |

---

# 📚 Collections (usage guide per animation)

## 💬 Typewriter

Types text character-by-character with a blinking caret (`.tw-writing`), honours
punctuation rhythm (`.` `!` `?` → full sentence pause; `,` `;` `:` → ⅙ pause plus a
space-swallow trick to avoid double gaps), then optionally deletes backwards and repeats.

**Options:** `loop`, `interval` (ms or ms-array for organic rhythm), `rewrite`, `delay`.
**Attributes:** `data-tw-loop`, `data-tw-rewrite`, `data-delay`.

Three internal scenarios:

- **Single element** — plain sequential typing.
- **Rewrite mode** (`rewrite: true` or `data-tw-rewrite="true"`) — uses the element's
  existing *child blocks* (`<span>`, `<blockquote>`, …) as sentences; each is typed,
  paused, deleted, then replaced by the next. Perfect for long-form paragraphs that rewrite
  themselves (used by `pages/wizard.ts`).
- **Multi-element loop** — several sibling children typed one after another while looping.

### Example A — infinite single-line typing

```html
<h3 animation="typewriter" data-tw-loop="true">Hello world!</h3>
```

```ts
new AnimationsService({ typewriter: { interval: [30, 70] } }).init();
```

### Example B — self-rewriting multi-block paragraph (mirrors wizard.ts)

```jsonc
{
  "tagName": "p",
  "className": "description",
  "attrs": { "animation": "typewriter", "data-tw-rewrite": "true", "data-delay": "800" },
  "content": "<span>First idea appears here…</span><span>and maybe another thought:</span><blockquote>\"A quoted question stands out.\"</blockquote>"
}
```

Each child becomes one rewrite cycle: typed fully → short “reading” pause
(`data-delay`) → fast backward delete (10× speed) → next block. After the last block the
paragraph stays intact unless `loop`/`data-tw-loop` re-runs it.

**Gotchas**
- Give the container a reserved height (e.g. `min-height`) so layout doesn't jump between
  blocks of different lengths.
- Numeric `loop` values currently behave as *infinite* loop (a preserved legacy quirk).

## 🪜 Stagger Fade

Reveals content segment-by-segment through Web Animations API slides
(`translateY(15px)` → `0`, `cubic-bezier(0.25,1,0.5,1)`, fill-forwards). Segments are
pre-hidden instantly so nothing flashes before its turn.

**Options:** `delay` (per-segment stagger in ms — ⚠️ default 5000, set your own),
`duration` (CSS time string).
**Attribute:** `data-stagger-mode`.

Segmentation semantics:

| Mode | Behaviour |
|---|---|
| `sentence` *(default)* | Node text split via `Intl.Segmenter`; original children are REPLACED with `inline-block <span>` segments. |
| `line` | Reuses existing element children when present; otherwise splits plain text on `\n` into fresh `<p>` nodes. |

> ⚠️ Both modes **mutate your DOM** (content is rebuilt into segment elements). Avoid using
> it on containers whose inner markup you need afterwards.

### Example A — sentence cascade

```html
<p animation="stagger-fade">Satu. Dua. Tiga.</p>
```

```ts
new AnimationsService({ staggerFade: { delay: 150, duration: '0.6s' } }).init();
// Sentence #n starts after n × 150 ms; each lasts ~600 ms.
```

### Example B — line mode over existing children

```html
<ul animation="stagger-fade" data-stagger-mode="line">
  <li>Item pertama</li>
  <li>Item kedua</li>
</ul>
```

### Chain caveat

The legacy engine dispatches `animation:done` **once per finished segment**, not once at
the end. Because chained listeners use `{ once: true }`, anything chained *after* a
stagger-fade element triggers as soon as its **first** segment lands — kept intentionally
for 1:1 parity, but plan your choreography accordingly.

## 🔀 Text Scramble

Matrix/Cyberpunk decode effect: the raw text is replaced by random glyphs from a pool,
which then lock character-by-character into the original content. Uses `Intl.Segmenter`
(grapheme granularity) so emoji and combined characters survive.

**Options:** `chars` (random pool), `speed` (ms per step; scurry phase = `speed / 2`).
**Attributes:** none — everything comes from config.
**Chain:** fires `animation:done` once after the final character locks. ✅

### Example

```html
<button animation="text-scramble">Mulai</button>
```

```ts
new AnimationsService({
  scramble: { chars: '!<>-_\\/[]{}—=+*^?#________', speed: 40 },
}).init();
// → "M#<a" … "Mu!lai" … "Mulai", done event fires, chain continues.
```

**Gotchas**
- The element's `textContent` starts empty, so width can collapse while decoding — give
  buttons/fixed labels an explicit `min-width` or reserve space in CSS.
- Look-ahead flicker touches up to 2 characters beyond the current one (`i+1…i+3`),
  which produces the signature ripple.

## ✨ Fade In

Web Animations API entrance: `display:none → block`, opacity `0→1`,
`translateY(10px) → 0`, 500 ms ease-out, fill-forwards. Also refreshes the CSS variables
`--fade-delay` / `--fade-duration` on every run for future stylesheet-driven motion.

**Options:** `duration`.
**Attribute:** `data-fade-delay` (per-element extra delay, CSS time string).
**Chain:** single `animation:done` once the `.finished` promise resolves. ✅

### Example A — instant fade on load

```html
<h4 animation="fade-in">Siap memulai pembangunan website impian anda?</h4>
```

### Example B — delayed via attribute

```html
<figure animation="fade-in" data-fade-delay="0.3s"><img src="hero.jpg"></figure>
```

```ts
new AnimationsService({ fade: { duration: '0.5s' } }).init();
```

> The base stylesheet keeps `[animation="fade-in"]` at `display:none`; the keyframe end
> state (`display:block` + `fill:'forwards'`) is what leaves it visible afterwards.

## 🔢 Count Up  🚧

Deliberate stub ported verbatim from the legacy handler:

- reads the element's numeric text, stores it as `data-target-number`;
- **does not animate yet**, and **does not fire `animation:done`** (parity + roadmap).
- Note it *is* wired into the dispatcher now, so `animation="count-up"` runs instead of
  warning about an unknown type.

### Example (current behaviour)

```html
<span animation="count-up">98</span>
<!-- After init() → <span data-target-number="98">98</span> -->
```

⚠️ **Do not place chained elements directly after a count-up node** — nothing will ever
dispatch `animation:done`, so those siblings stay hidden forever. Interleave another
module (e.g. fade-in) or drive counting manually:

```ts
const el = document.querySelector('[animation="count-up"]')!;
const target = Number(el.getAttribute('data-target-number'));
// your own requestAnimationFrame + easing loop from here…
```

Full implementation guidance (RAF easing formula) lives in the `@todo` block at the top
of `Animations.ts`.

---

## ⛓ Chaining (`animation-chain`)

Elements marked `animation-chain="true"` don't start on page load. At `init()` they are
pre-hidden (`opacity:0`, `pointer-events:none`) and start listening on their **parent** for
the `animation:done` event that comes from the **animated sibling directly before them**;
when it arrives they become interactive again (restoring their original inline `opacity`
and `pointer-events`) and run.

### Timeline of the wizard.ts scene

```html
<p animation="typewriter" data-tw-rewrite="true">…spans + blockquote…</p>
<h4 animation="fade-in"   animation-chain="true">Siap memulai…?</h4>
<button animation="text-scramble" animation-chain="true">Mulai</button>
```

```text
load  ──▶ typewriter runs alone (chained siblings hidden)
          │
          └─ typewriter finished → done(node) on <parent>
                    │ h4's listener matches (origin === typewriter)
                    ▼
               fade-in runs → done(node) on <parent>
                          │ button's listener matches (origin === h4)
                          ▼
                     scramble decodes "Mulai"
```

The Virtual-DOM equivalent (exactly how `pages/wizard.ts` declares it):

```jsonc
{ tagName: "p",      className: "description",
  attrs: { animation: "typewriter", data-tw-rewrite: "true" }, content: "<span>…</span>" },
{ tagName: "h4",     className: "asking questions",
  attrs: { animation: "fade-in", animation-chain: "true" },     content: "Siap memulai…" },
{ tagName: "button", className: "button small",
  attrs: { animation: "text-scramble", animation-chain: "true", onclick: "console.log('clicked')" },
  content: "Mulai" }
```

**Fine print**

- The completion event is dispatched on the *parent* with `detail.origin` = the element
  (or stagger-fade segment) that just finished, so only siblings under the same parent
  can chain directly.
- Each chained element only reacts when the event's `detail.origin` is its **immediately
  preceding animated sibling** (or the segment inside it — stagger-fade reports children).
  This origin filter is what lets several `animation-chain="true"` siblings in one parent
  run strictly one-after-another instead of all firing on the very first event that passes.
- The listener is discarded as soon as it actually matches (chains open exactly once). It is
  deliberately NOT `{ once: true }`, because a wrong-first event must not steal a
  still-waiting link.
- On release, the element's original inline `opacity` and `pointer-events` are restored
  (snapshotted at hide time), so typewriter/scramble nodes become visible again.
- Want custom listeners? `element.addEventListener('animation:done', e => e.detail.origin)`
  gives you the exact node that completed.
- Never terminate a chain with the count-up stub (no completion signal).

## ➕ Adding a new behaviour

1. Create `behaviours/your-anim.ts`:

   ```ts
   export interface YourAnimOptions { speed: number }

   export class YourAnimBehaviour {
     private static _ease(t: number): number { return t * (2 - t); } // helpers `_`-prefixed

     public static async animate(node: HTMLElement, options: YourAnimOptions,
                                 onDone: () => void): Promise<void> {
       // …check node.isConnected inside every loop…
       if (!node.isConnected) return;
       node.textContent = 'done!';
       onDone();                     // ← mandatory for chain compatibility
     }
   }
   ```

2. Register in `_triggerAnimation()`'s switch, feeding config values:
   `case 'your-anim': YourAnimBehaviour.animate(node, { speed: this.config.yourAnim?.speed! }, () => this._dispatchDoneEvent(node)); break;`
3. Extend `AnimationServiceConfig` + constructor defaults.
4. Optional CSS hooks in `Animations.css`; update this file's module matrix.

## 📎 Preserved legacy quirks (documented for posterity)

| Quirk | Why it stays |
|---|---|
| Numeric `data-tw-loop` behaves like infinite loop | Legacy handler did `count++` but never compared it. |
| Fade-in is hard-coded 500 ms despite `--fade-duration` | CSS var set for future use; keyframe kept at legacy constant. |
| Stagger-fade `animation:done` per segment | Earliest-possible chain triggering was the original intent. |
| `staggerFade.delay` defaults to 5000 ms | Legacy config default; override it in your own code. |
| Count-up sets `data-target-number` only | Ported verbatim from the roadmap stub. |

## ✅ Health check

```bash
npx tsc --noEmit   # must exit 0
```

Docs generated from the refactored module — behaviours ported 1:1 from the original
monolithic `AnimationsService` handlers (`_handleTypewriter`, `_handleStaggerFade`,
`_handleScramble`, `_handleFadeIn`, `_handleCountUp`).
