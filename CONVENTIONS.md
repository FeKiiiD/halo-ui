# Conventions

Every decision taken while porting `core`, with its reason. These will be
applied to the remaining ~80 components, so **this is the document to argue
with** — a change here is a `sed` away while the surface is still small.

Each entry is numbered so you can reply "change 4 and 11" without quoting.

---

## A. File and module layout

**A1 — One component per file, kebab-case filenames, PascalCase exports.**
`send-button.tsx` exports `SendButton`. The source system used PascalCase
filenames; kebab-case is the ecosystem norm and avoids case-sensitivity bugs
between Windows and CI on Linux.

**A2 — Every component exports its props interface.**
`export interface ButtonProps` beside `export function Button`. Consumers
extend and wrap; an unexported props type makes that impossible without
`Parameters<typeof Button>[0]`.

**A3 — Group barrels re-export types explicitly.**
`export { Button, type ButtonProps } from "./button"` rather than
`export * from "./button"`. Star exports make it impossible to see what a group
publishes, and they leak internals the moment someone adds a helper.

**A4 — Sub-path exports per group.**
`@halo/ui` and `@halo/ui/core` both work. Groups are added to `tsup.config.ts`
as they land, so a consumer can import `@halo/ui/forms` without pulling the
chart code into its module graph.

---

## B. Styling

**B1 — Tailwind classes for everything static; inline `style` only for computed
values.**
A transform driven by a progress ratio, a per-particle trajectory, an animation
string chosen by phase — these cannot be classes. Everything else is a class.
The test: if the value is knowable at author time, it is a class.

**B2 — Components read semantic aliases, never raw palette values.**
`bg-surface-card`, not `bg-paper`. `text-text-primary`, not `text-ink`. The two
exceptions are deliberate and documented in place: the halo (`bg-ink` is the
literal spec) and the confetti colours (which name specific hues).

**B3 — `cn()` on every element that accepts a `className`.**
Never string interpolation. `cn()` is `clsx` + a `tailwind-merge` taught about
Halo's custom scales, which is what makes a consumer's override actually win.
See D3.

**B4 — `className` is merged last, always.**
`cn(base, variants, className)`. A consumer passing `className="px-4"` must beat
the component's own padding.

**B5 — Class order within `cn()`: layout → typography → colour → state → size.**
Not enforced by a tool, just consistent enough to scan. Conditional classes come
after the block they modify.

**B6 — Arbitrary values are a smell, but permitted for one-off geometry.**
`h-[1.5px]`, `text-[17px]` for the counter size, `bg-white/10` for the on-dark
tint. Anything used twice becomes a token instead.

---

## C. Component API

**C1 — Controlled-first, uncontrolled-friendly.**
Accept `value` / `onChange`; fall back to internal state when `value` is
omitted. `useControllableState` implements it. Whether a component is controlled
is decided on first render and never re-read, matching React's own rule for form
elements.

**C2 — No component fetches anything, and none reads a global store.**
Async work is injected as a promise-returning callback (`onSave`, `onSend`,
`onScan`). That callback is what drives the loading and verdict animations.

**C3 — A rejected promise is a verdict, not a crash.**
`onAction` throwing means the operation failed, which is exactly the error
choreography. Returning `false` means the same for callers who do not throw.
Neither is logged or re-thrown.

**C4 — `forwardRef` on anything that wraps a real DOM element.**
Currently `Button` and `ActionButtonShell`. Needed for focus management,
popover anchoring, and form libraries.

**C5 — Rest props spread onto the underlying element.**
`...rest` after the explicit props, so `data-*`, `aria-*` and event handlers
pass through without the component enumerating them.

**C6 — Size scales are named, never numeric.**
`size="sm" | "md" | "counter"`, not `size={48}`. `counter` carries meaning a
number does not: it is the standing, at-the-counter target, and it appears
across unrelated components.

**C7 — No `state` prop for forcing visuals.**
The source system had `state="hover" | "processing" | …` for specimen sheets.
Dropped: it invites use in real screens, where it desynchronises the visual from
the actual state. Storybook drives real interaction instead.

**C8 — Labels default to English and are always overridable.**
The system is the deliverable; copy belongs to the product. The source had
French strings hard-coded (« Envoyer », « Récompense créditée »).

---

## D. Shared logic

**D1 — Behaviour shared by three or more components becomes a hook.**
`useAsyncVerdict` (the phase machine), `useHold` (press-and-hold),
`useControllableState`. The source copy-pasted the phase machine into nine
buttons, each with slightly different timings and its own unmount bug.

**D2 — Chrome shared by a family becomes a component, and it is exported.**
`ActionButtonShell`, `VerdictCheck`, `VerdictCross`, `Confetti`. Exported so a
project can build its own animated action on the same pill and the same phase
palette.

**D3 — Every custom Tailwind scale is registered in `cn()`.**
Adding `--spacing-foo` to `theme.css` without adding `foo` to the matching class
group in `lib/cn.ts` means `p-foo` and `p-4` will both survive a merge, and
which one wins is down to stylesheet order. `pnpm check:cn` asserts this.

**D4 — Timers are tracked and cleared on unmount.**
Every `setTimeout` goes into a ref'd array; the cleanup clears it and flips an
`alive` flag that guards the callbacks. Without it, a choreography running when
a route changes sets state on a dead component.

---

## E. Motion

**E1 — Keyframes are declared once in `keyframes.css`, prefixed `halo-`.**
Never injected at runtime. The source created a `<style>` element from inside
each component (47 occurrences), which breaks under SSR and re-runs on mount.

**E2 — The busy phase has a floor.**
`minBusy` per component (420–1100ms), chosen so the specific animation
completes at least one legible cycle. A server answering in 20ms would
otherwise make the button flash.

**E3 — Hover and press change colour only.**
Never position, never scale, never a shadow. This is a system rule, not a
preference.

**E4 — `prefers-reduced-motion` collapses animations to their end state.**
Not removed outright — the choreographed buttons are an identity feature, and
their verdict still has to be readable.

---

## F. Accessibility

**F1 — Focus is `halo-focus`, one utility, everywhere.**
2px ring, 2px offset, `:focus-visible` only. A mouse click never leaves an
outline; a keyboard user is never without one.

**F2 — `aria-busy` during the busy phase, `aria-live="polite"` on the button.**
The label changes as the phase advances, so it has to be announced.

**F3 — Icons are `aria-hidden` unless given an explicit label.**
Most sit beside text that already names the action. `Icon` takes `aria-label`
and switches to `role="img"` when one is given.

**F4 — `iconOnly` requires an accessible name, taken from `children`.**
Also mirrored into `title` for a hover tooltip.

**F5 — No Unicode symbols standing in for icons.**
No ✓ ★ →. They read inconsistently across platforms and are announced as
punctuation. Use a glyph.

---

## G. Documentation in code

**G1 — Comment the decision, never the mechanics.**
`// shrink-0: inside the flex row it would otherwise give up its width` — not
`// set flex-shrink to 0`.

**G2 — System rules live in the JSDoc of the component that enforces them.**
The accent rule is on `IconChip` and `StatBlock`; the pill rule is on `Button`.
Someone reading the component sees the constraint without opening the guide.

**G3 — Non-obvious constants get their reason inline.**
`// 780ms: long enough for the reel to complete a visible turn`.

---

## H. Verification

Run `pnpm check`. It chains four gates:

| Gate | What it proves |
|---|---|
| `typecheck` | The TypeScript surface is sound. |
| `check:cn` | Every custom scale resolves in a merge, so consumer overrides win. |
| `demo` | The demo builds — which means Tailwind resolved every class used. |
| `check:phases` | All seven phase machines hit their floor, their verdict colour and their resolved label, in a real browser. |

`check:phases` samples the live button rather than screenshotting it: React
swaps the inner DOM on each phase, so a screenshot through a stale handle shows
the idle state and proves nothing. Two real bugs were caught this way — see
below.

---

## Bugs this caught during lot 1

Recorded because they justify keeping the gates.

1. **The split button's chevron rendered at 0px wide.** `px-control-px` from the
   shared face was not recognised as padding by `tailwind-merge`, so `px-0` did
   not replace it; the 28px padding squeezed the SVG out of existence. Fixed by
   registering the custom scales (D3) and adding `shrink-0`.

2. **The outlined split button's border was clipped.** Each segment drew its own
   1.5px border, and the container's `overflow-hidden` cut them at the pill's
   curve, leaving a stub past the right edge. The outline now belongs to the
   container; segments keep only the divider.

3. **Switzer never loaded.** `fonts.css` was imported from inside
   `styles/index.css`, so by the time it was reached Tailwind had already
   emitted rules — and CSS silently drops any `@import` that follows a rule. The
   font import now has to be the consumer's first line, and `index.css` says so.
