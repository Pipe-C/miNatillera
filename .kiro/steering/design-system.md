---
inclusion: fileMatch
fileMatchPattern: "**/Landing*,**/Home*,**/Layout*,**/index.css"
---

# miNatillera — Design System (current)

## Visual direction
Minimal, professional, Vercel-inspired. Typography as protagonist. No decorative background animations, no floating elements, no loops. Motion is limited to purposeful micro-interactions (page entrance, button hover/press).

## Palette (no gradients)

| Token | Value | Usage |
|-------|-------|-------|
| --color-base | #0D0B14 | Page background |
| --color-elevated | #15121E | Cards, inputs |
| --color-surface | #1C1826 | Active tabs, tracks |
| --color-border | #2A2435 | Borders |
| --color-text-primary | #F5F3F7 | Headings, body |
| --color-text-secondary | #9992A3 | Labels, subtitles |
| --color-text-muted | #665E73 | Placeholders |
| --color-accent | #7C5CFC | Buttons, active states, ring |
| --color-accent-hover | #9478FF | Button hover |
| --color-warm | #FBBF77 | Celebration only |

## Light Mode Palette

Applied via `:root.light` class on `<html>`. Accent stays the same across both modes.

| Token | Value (light) | Usage |
|-------|---------------|-------|
| --color-base | #F8F6FB | Page background |
| --color-elevated | #FFFFFF | Cards, inputs |
| --color-surface | #EFEDF3 | Active tabs, tracks |
| --color-border | #DDD9E4 | Borders |
| --color-text-primary | #1C1826 | Headings, body |
| --color-text-secondary | #5E5770 | Labels, subtitles |
| --color-text-muted | #9992A3 | Placeholders |
| --color-accent | #7C5CFC | Same (brand) |
| --color-accent-hover | #6B4AE8 | Slightly darker for contrast on light bg |
| --color-warm | #E8A54A | Slightly deeper for contrast |

### Theme toggle
- Icon: `SunMoon` from lucide-react in header
- Stored in `localStorage('theme')` as 'dark' or 'light'
- No-flash: inline script in `<head>` applies `.light` class before first paint
- ThemeProvider context in React wraps entire app
- Aurora background opacity reduced in light mode (landing: 0.10, home: 0.06)
- Body transition: 0.3s on background-color and color for smooth switch

## Layout

### Dashboard layout (GroupDashboard)
- Container max-width: `max-w-4xl` (~896px) on dashboard routes, `max-w-xl` (~576px) on forms
- Determined dynamically in Layout.jsx based on route pattern
- Desktop (≥768px): stat cards, tabs, and content lists get full width
- Mobile: unchanged vertical stack

### Button hierarchy
- `.btn--primary`: solid accent background (#7C5CFC), white text, hover shadow
- `.btn--secondary`: solid surface background, primary text, border, hover shows accent border
- Action row buttons (Import, Export, Share): styled as secondary (not transparent)
- Destructive/low-emphasis: outline style (not currently used)

## Custom Checkbox
- Class: `.checkbox-custom` on native `<input type="checkbox">`
- Unchecked: 18×18px, surface background, border in border color, rounded 4px
- Checked: accent background, white checkmark via CSS ::after pseudo-element (rotated border trick)
- Transition: 0.15s on background-color and border-color
- Accessible: native input with `appearance: none`, responds to keyboard and screen readers

## Micro-animations
- Tab content: `tabFadeIn` — fade + 6px translateY, 0.2s ease-out
- List items (contributions, loans): `fadeSlideIn` — fade + 8px translateY, 0.25s spring easing, staggered via `animationDelay`
- Member cards hover: translateY(-2px) + accent border + subtle shadow
- Stat cards hover: accent border hint + shadow
- Month chips: 0.2s ease-out transition on all properties (color, bg, border)
- `prefers-reduced-motion: reduce` disables all animations

## Typography
- Geist Sans: all text (loaded from CDN, woff2, font-display: swap)
- Geist Mono: monetary values, codes (.mono class)
- Instrument Serif (italic): editorial accents — hero titles, section highlights, eyebrow label. Loaded from Google Fonts gstatic.
- Hero titles: clamp(2.4rem, 6vw, 4rem), mixed weight composition (bold + light + italic serif for accent words)
- Section headings: text-2xl to text-3xl, font-bold, tracking-tight
- Dashboard title: 1.4rem font-semibold

## Editorial Typography Patterns
Inspired by editorial/agency design — mixed weights in the same headline to create visual hierarchy within a single line:
- **Bold** for the action word ("Ahorro", "Comienza")
- **Italic serif** (Instrument Serif) in accent color for the key concept ("en grupo", "natillera")
- **Light weight** in secondary color for the qualifier ("sin complicaciones")
- Responsive: all editorial titles use `clamp()` for smooth scaling across breakpoints

## Micro-labels
Small uppercase text with accent-colored slash prefix. Used before each content section:
- Class: `.micro-label`
- Font: 0.65rem, weight 500, letter-spacing 0.12em, uppercase
- Prefix: `/ ` in accent color (via CSS ::before)
- Applied to: section headers in dashboard tabs (/ APORTES, / MIEMBROS, / PRÉSTAMOS) and Landing value blocks

## Scroll Reveal
Native IntersectionObserver (no library) — elements enter with fade + translateY(24px) → 0:
- Class: `.reveal` (base state: opacity 0, translateY 24px)
- Trigger: `.revealed` added on intersection (threshold 0.15)
- Duration: 0.7s cubic-bezier(0.16, 1, 0.3, 1)
- Stagger delays: `.reveal-delay-1` (0.1s), `.reveal-delay-2` (0.2s), `.reveal-delay-3` (0.3s)
- `prefers-reduced-motion: reduce` — instant reveal, no animation

## Editorial Stats (GroupDashboard)
Large number blocks replacing the previous small stat cards:
- Class: `.stat-editorial`
- Value: clamp(1.8rem, 4vw, 2.6rem), font-weight 700, tracking -0.03em, mono
- Label: 0.65rem, uppercase, letter-spacing 0.1em, muted color
- Entrance: `.stat-stagger` keyframe with 0.08s delay between each (scale + translateY)
- `prefers-reduced-motion` respected

## Illustration — "Person depositing coin" (DEFINITIVE)
Two-tone diagonal shading system. Only two colors: #7C5CFC (base) and #9478FF (light). Same ~35deg diagonal angle on all three body parts.

### Geometry (viewBox 0 0 200 200)
- **Head**: circle r=20 at (80,46). Bottom at y=66. Gap to torso: 5px.
- **Torso**: trapezoid. Shoulders 75px wide (x=38→113 at y=71). Base 48px wide (x=52→100 at y=161). Height 90px. Rounded top corners.
- **Arm**: tapered path. Shoulder width ~24px. Tip width ~13px. Extends from x=108 to x=180. Points slightly upward. Behind torso.
- **Coin**: at (180, 64). Falls +53px vertically.
- **Piggy**: translate(155,100) scale(2.4). Slot at (181, 117).

### Shading (NOT panels, NOT 3-tone — just 2 tones per form)
- Each form has a base fill (#7C5CFC) covering the full shape
- A second overlapping path in #9478FF at 60-85% opacity covers the upper-left diagonal region
- This creates a consistent "lit from upper-left" look across head, torso, and arm
- NO dark edge panels, NO third tone, NO gradients

### Animation
- 4s cycle. Coin visible 0-40%, falls 40-55% (+53px translateY), hidden 56-94%, reappears.
- Piggy pop scale(1.07) at 53-63%. transform-box: fill-box.
- prefers-reduced-motion: static, no animation.

## Stack
- Tailwind CSS v4 (via @tailwindcss/vite plugin)
- Custom theme defined in @theme block in index.css
- No animation library — CSS keyframes for entrance stagger, transitions for interactions

## Motion (minimal, justified)
- Page entrance: fade-up stagger (title → subtitle → CTA), 600ms each, 80ms stagger delay
- Button hover: bg-color transition 150ms + shadow
- Button press: scale(0.97) active state
- prefers-reduced-motion: all animations disabled

## Aurora Background (ambient)
Subtle mesh-gradient effect — 3 large blurred blobs drifting slowly.

### Architecture
- Component: `AuroraBackground.jsx` rendered ONCE in App.jsx, outside Routes
- Never remounts on navigation — animations continue uninterrupted
- Variant (landing/home) controlled by useLocation() → class swap with 500ms opacity transition

### Blobs
| # | Color | Size | Blur | Position | Duration |
|---|-------|------|------|----------|----------|
| 1 | #7C5CFC (primary) | 500px | 100px | upper-left | 22s |
| 2 | #5C3FD4 (muted purple) | 450px | 120px | lower-right | 28s |
| 3 | #FBBF77 (warm) | 350px | 130px | center-right | 25s |

### Motion
- Drift via @keyframes with 4-5 waypoints (multi-axis translate) — organic, not linear
- Easing: ease-in-out (symmetric, no sudden stops)
- Each blob at different duration → never synchronize
- Only `transform` animated; `filter:blur()` is static (applied once, not per-frame)
- will-change: transform on each blob

### Opacity by route
- Landing: container opacity 0.22 (noticeable atmosphere)
- Home: container opacity 0.12 (very subtle, behind form)
- Transition: 500ms ease-out between variants

### Performance
- 3 DOM elements total, each promoted to GPU layer via will-change
- No JS involved (pure CSS animations)
- No canvas, no rAF, no mousemove listeners
- filter:blur is composited once at paint time, not re-computed per frame
- prefers-reduced-motion: static blobs, no animation

## Discarded concepts (do NOT reintroduce)
- Canvas starfield / particles
- Flying elements (piggy, rocket, coins, meteors)
- City/beach/Paris scenes
- Any complex SVG line-art backgrounds
- Mouse-proximity interactions on background elements


## Illustration — CLOSED DEFINITIVELY
Final version. DO NOT MODIFY unless critical bug.
- Head: circle r=22 at cx=85 (exact center of torso top edge: (62+108)/2=85), cy=44. Fill #7C5CFC (dark). S-curve highlight #9478FF at 70% opacity, clipped with clipPath id="illust-clip-head".
- Torso: slender trapezoid, shoulders 70px (x=48→118 at y=72), base ~36px (y=170). Fill #7C5CFC. Diagonal highlight #9478FF at 25% opacity, clipped with clipPath id="illust-clip-torso".
- Arm: smooth tapered path #9478FF at y=80 (shoulder height, not floating above). Highlight #C4B5FD at 45% clipped with clipPath id="illust-clip-arm".
- NO stray shadow elements outside the named groups (the #2D1B69 panel was removed).
- All clipPath ids prefixed with "illust-" to avoid DOM collisions.
- Head-torso gap: 6px (head bottom y=66, torso top y=72).
- Coin at (184,76), falls +49px vertically. Piggy at translate(158,108) scale(2.4). Animation 4s cycle synced.
- This illustration is CLOSED. Next focus: GroupDashboard and Contribute.

## Permission Model (Gestores vs Invitados)

### Roles
- **Gestor owner (creador)**: identified by `manager_token_<groupId>` in localStorage. Can: add members, register contributions, create loans, register repayments, invite co-gestors. Shows Crown icon.
- **Co-gestor**: invited via link, has own `manager_token_<groupId>`. Same write permissions as owner. Shows ShieldCheck icon in member list (not Crown).
- **Invitado**: enters via invite code only. Can: view progress, view contributions, view member list, view loans. Cannot write anything.

### Token storage (localStorage)
- Primary key: `manager_token_<groupId>` (new unified pattern)
- Legacy fallback: `creator_token_<groupId>` (checked if primary missing)
- `getManagerToken(groupId)` checks both keys for backward compat

### UI visibility rules
- `AddMemberForm`: visible only if `getManagerToken(groupId)` is truthy
- "Registrar aporte" button: visible only for managers
- Loan creation/repayment forms: visible only for managers
- "Invitar co-gestor" button: visible only for managers
- `RecoverAccessForm`: visible outside tabs, only when user is NOT a manager

### Backend enforcement
- All write endpoints use `X-Manager-Token` header (replaces old `X-Creator-Token`)
- `ManagerAuthService.isValidManagerToken()` hashes the provided token and compares against ALL Manager records for that group
- Manager invite endpoints: `POST /managers/invite` (requires existing manager token), `POST /managers/accept` (uses invite token as auth)
- Invite tokens are one-time-use, expire in 24h

## Crown Icon (Owner Badge)
- Icon: `Crown` from lucide-react, size 12
- Position: absolute, top -8px, right -4px of `.member-card__avatar`
- Color: `#FBBF77` (warm accent)
- Only shown for members with `isOwner: true`

## Co-Gestor Icon
- Icon: `ShieldCheck` from lucide-react
- Used in "Invitar co-gestor" button and JoinManager view
- Color: `#7C5CFC` (accent)

## Month Filter Chips (contributions tab)
- Container: `.month-chips` — flex row, wrapping, gap 6px, margin-bottom 12px
- Chip: `.month-chip` — pill shape (border-radius 9999px), 0.72rem font, compact padding (4px 10px)
- Active state: `.month-chip--active` — accent background at 12% opacity, accent border at 40%, accent text color, font-weight 500
- Inactive: elevated bg, border color, secondary text
- "Todos" chip always first, shows all contributions when selected
- Only months with at least one contribution appear as chips

## Token Download Banner (prominent warning)
- Container: `border-2 border-[#FBBF77] bg-[rgba(251,191,119,0.08)]` rounded-lg, padding 16px
- Header: `AlertTriangle` icon (lucide-react, size 18, color #FBBF77) + bold text "Descargá tu archivo de acceso"
- Body: explanatory text (xs, text-secondary)
- CTA: full-width accent button with `Download` icon
- Gate: checkbox "Ya descargué y guardé mi acceso" must be checked before "Ir al grupo" button becomes enabled
- Applied to: GroupCreatedCard (Home.jsx) and JoinManager.jsx

## Loan Status Badges
| Status | Background | Text color | Border |
|--------|-----------|------------|--------|
| Pendiente | rgba(251,191,119,0.15) | #FBBF77 | rgba(251,191,119,0.3) |
| Pagado | rgba(124,92,252,0.1) | var(--color-accent) | rgba(124,92,252,0.25) |

## ProgressRing — No-Goal Mode
When `goalAmount` is null:
- Ring arc stays at 0 (no fill)
- Center content shows accumulated total with label "Acumulado total"
- No percentage displayed
- "Faltante" stat card hidden from dashboard

## Optional Goal Toggle (CreateForm)
- Checkbox: "Definir monto meta" — checked by default
- When unchecked: MoneyInput disappears, replaced by helper text "El grupo acumulará sin un tope definido."
- Submits `goalAmount: null` to backend
