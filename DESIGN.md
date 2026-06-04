# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-06-01
- Primary product surfaces: single-page mobile-first logic circuit lab (`index.html`, `src/app.js`, `src/styles.css`)
- Evidence reviewed: `.omx/plans/prd-logic-circuit-mobile-web-20260601T093524Z.md`, `.omx/plans/test-spec-logic-circuit-mobile-web-20260601T093524Z.md`, `src/app.js`, `src/styles.css`, `src/domain.js`

## Brand
- Personality: calm, precise, educational, tactile, lab-notebook-like.
- Trust signals: readable circuit labels, deterministic state changes, restrained motion, no gimmicks.
- Avoid: flashy gradients, hero marketing headers, decorative clutter, hidden horizontal scrolling.

## Product goals
- Goals: let students pick one fixed circuit, tap inputs directly inside the diagram, and understand output changes quickly.
- Non-goals: circuit building, quizzes, scores, accounts, persistence, long theory pages.
- Success signals: all seven circuits, including internal latch structures, are easy to select, inputs feel obviously tappable, output state is legible at phone width.

## Personas and jobs
- Primary personas: high-school students learning basic digital logic.
- User jobs: quickly experiment with inputs and connect truth-table ideas to visible signal flow.
- Key contexts of use: smartphone portrait, short classroom or self-study sessions.

## Information architecture
- Primary navigation: compact in-page circuit selector grid.
- Core routes/screens: one static screen with selector, circuit diagram, input hint, output, and microcopy.
- Content hierarchy: circuit selection first, diagram second, current result third, explanation last.

## Design principles
- Principle 1: Interaction belongs inside the circuit diagram when possible.
- Principle 2: Calm contrast beats decoration; motion should clarify signal state.
- Tradeoffs: less visual spectacle in exchange for better focus and reduced perceived flicker.

## Visual language
- Color: neutral light background, white cards, one accent color per circuit used sparingly for selected/active states.
- Typography: system sans, compact labels, strong but not oversized text.
- Spacing/layout rhythm: tight mobile rhythm with 8–16px gaps and no top hero block.
- Shape/radius/elevation: soft cards and controls, moderate radius, low shadow.
- Motion: signal-flow animation only when active; reduced-motion keeps static highlights.
- Imagery/iconography: SVG circuit geometry only; latch diagrams should expose simplified internal gate structure.

## Components
- Existing components to reuse: circuit selector, SVG circuit canvas, output panel, microcopy card.
- New/changed components: clickable SVG input nodes, compact input hint panel.
- Variants and states: inactive, active, auto, selected, focus-visible, reduced-motion.
- Token/component ownership: CSS variables in `src/styles.css`; circuit data in `src/domain.js`.

## Accessibility
- Target standard: practical WCAG-minded mobile accessibility.
- Keyboard/focus behavior: SVG input nodes expose button semantics and Enter/Space activation.
- Contrast/readability: text labels and output values must not rely on color only.
- Screen-reader semantics: controls include circuit/input/value labels.
- Reduced motion and sensory considerations: active wires remain understandable without animation.

## Responsive behavior
- Supported breakpoints/devices: phone portrait from 320px upward, plus larger centered viewport.
- Layout adaptations: selector wraps; no horizontal page scroll.
- Touch/hover differences: touch targets must remain large; hover/focus only add subtle affordance.

## Interaction states
- Loading: not applicable for static app.
- Empty: not applicable; first circuit loads immediately.
- Error: not applicable for V1 static app.
- Success: output panel and active wires update immediately.
- Disabled: not currently used.
- Offline/slow network, if applicable: static files work once served.

## Content voice
- Tone: short, student-friendly Korean microcopy.
- Terminology: use gate names and bit labels consistently.
- Microcopy rules: explain the current circuit in one short idea plus one interaction hint.

## Implementation constraints
- Framework/styling system: dependency-light static HTML/CSS/JS; no backend.
- Design-token constraints: prefer existing CSS variables over new libraries.
- Performance constraints: avoid unnecessary re-render flicker; only animate active signal state.
- Compatibility constraints: modern mobile browsers with SVG support.
- Test/screenshot expectations: `npm run lint`, `npm test`, `npm run build`; visual checks at 360px width.

## Open questions
- [ ] Whether a classroom mode needs even larger text / owner: product / impact: layout density.
