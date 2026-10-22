---
name: Thermal Brutalism Kiosk
colors:
  surface: '#faf9f5'
  surface-dim: '#dadad6'
  surface-bright: '#faf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f4f0'
  surface-container: '#eeeeea'
  surface-container-high: '#e8e8e4'
  surface-container-highest: '#e2e3df'
  on-surface: '#1a1c1a'
  on-surface-variant: '#444748'
  inverse-surface: '#2f312e'
  inverse-on-surface: '#f1f1ed'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#7d5800'
  on-secondary: '#ffffff'
  secondary-container: '#ffb702'
  on-secondary-container: '#6b4b00'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002107'
  on-tertiary-container: '#00993a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#ffdea9'
  secondary-fixed-dim: '#ffba27'
  on-secondary-fixed: '#271900'
  on-secondary-fixed-variant: '#5e4100'
  tertiary-fixed: '#6bff83'
  tertiary-fixed-dim: '#00e55b'
  on-tertiary-fixed: '#002107'
  on-tertiary-fixed-variant: '#00531b'
  background: '#faf9f5'
  on-background: '#1a1c1a'
  surface-variant: '#e2e3df'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 60px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: 0em
  body-md:
    fontFamily: Space Grotesk
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  label-lg:
    fontFamily: Space Mono
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.04em
  label-md:
    fontFamily: Space Mono
    fontSize: 13px
    fontWeight: '700'
    lineHeight: 18px
    letterSpacing: 0.06em
  label-sm:
    fontFamily: Space Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0.08em
  code-terminal:
    fontFamily: Space Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
spacing:
  gutter: 1rem
  gutter-tablet: 1.25rem
  margin: 1.5rem
  margin-kiosk: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system channels an uncompromising union of utilitarian industrial brutality and tactile thermal receipt printing. Crafted specifically for portrait-oriented interactive kiosks and vertical tablet touchscreens, the UI feels physical, direct, and mechanically responsive.

### Aesthetic Principles
- **Analog Thermal Hardware Metaphor:** The screen behaves like a mechanical, high-speed thermal dot apparatus. Components evoke continuous receipt paper rolls, tear-offs, perforation guides, and dense docket printing.
- **Retro-Brutalist Reduction:** Elimination of faux-skeuomorphic gloss, ambient blur, and decorative rounding. Form follows raw mechanical function with stark divider rules, dot-matrix structures, halftone dithering treatments, and industrial status readouts.
- **Industrial Urgency & Legibility:** Designed for public self-service spaces where ambient light varies wildly. The screen demands immediate comprehension from an arm’s length with oversized interaction areas (never below 48px), bold tactile feedback, and crisp visual priority.

## Colors

The palette operates under a high-contrast mono-plus-accent model built over an off-white thermal substrate.

### Primary Roles
- **Paper Canvas (`#F4F4F0`):** The default screen background. Emulates fresh, untreated thermal roll paper under interior gallery illumination.
- **Thermal Carbon Black (`#121212`):** Primary ink for typography, structural borders, halftones, solid fill buttons, and tactile states. High density, non-reflective.
- **Paper Tint Alt (`#EBEAE5`):** Subdued thermal container fill, used to differentiate nested receipt dockets, inset camera viewports, and ledger cards.

### Functional Signal Accents
- **Warm Amber (`#FFB703`):** Industrial warning, countdown timers, shutter sequences, processing states, and caution notifications.
- **Neon Signal Green (`#00FF66`):** Hardware readiness, successful print output, active payment validation, and live camera feed verification.
- **System Error Red (`#E53935`):** Hardware malfunction, paper feed exhaustion, or invalid input.

## Typography

Typography establishes an intentional dialogue between the aggressive editorial display forms of **Space Grotesk** and the raw, dot-matrix teleprinter precision of **Space Mono**.

- **Display & Headlines:** Space Grotesk in bold weights provides punchy, immediate instructions visible from distance. Text is set with tight tracking (`-0.02em` to `-0.03em`) and uppercase treatment for primary instructional moments (`"SMILE FOR 3 SECONDS"`, `"INSERT BILL OR TAP"`).
- **Body & Subtitles:** Space Grotesk medium delivers clean legibility for prompts and user feedback.
- **Labels, Telemetry, and Metadata:** Space Mono operates as the voice of the thermal machine itself. It is used strictly for timestamps, session IDs, kiosk hardware statuses, price totals, frame counters, and docket line items.

## Layout & Spacing

The layout is constructed for fixed-ratio portrait displays (predominantly 9:16 and 3:4 vertical tablet screens mounted to kiosk chassis). 

### Layout Model
- **Grid Architecture:** A rigorous 6-column fluid grid on vertical tablet devices with rigid outer margin boundaries (`margin-kiosk: 2rem`) protecting against hardware bezel occlusion.
- **Vertical Stack Structure:** The display is organized into three persistent zones:
  1. **Top Hardware Telemetry Bar (Height 56px):** Pinned hardware status, paper roll percentage, session timer, print head heat level.
  2. **Active Interaction Stage:** Flexible central viewport dedicated to real-time halftone camera feeds, photo strip previews, or filter selections.
  3. **Lower Physical Action Anchor (Min-Height 96px):** High-touch interaction tray housing massive trigger CTAs and session abort/reset buttons.
- **Spacing Rhythm:** Spacing between atomic elements follows strict multiples of `0.25rem` (4px). All functional gaps enforce a minimum of `1rem` between competing touch points to prevent unintended activations.

## Elevation & Depth

This system discards soft diffuse ambient drop shadows, blurs, and glassmorphism. Depth is mechanical, physical, and rendered through deliberate brutalist structural boundaries.

### Depth Techniques
- **Hard Cast Shadows:** Elements with elevation (active cards, primary physical action triggers) utilize 100% solid, unblurred carbon cast offsets: `box-shadow: 4px 4px 0px #121212`. Pressed or tapped states instantly collapse to `0px 0px 0px` with an immediate `transform: translate(4px, 4px)`.
- **Dithered Halftone Backdrops:** Dimming or modal focus is achieved using a 50% dot-matrix carbon stipple pattern rather than an alpha opacity overlay, reinforcing print aesthetics.
- **Thermal Inset Wells:** Depressed areas (camera viewports, inactive card slots) use `border: 2px solid #121212` with a subtle interior raster crosshatch or `#EBEAE5` background fill.
- **Perforated Jagged Lines:** Vertical layering breaks are rendered through crisp zigzag jagged cut vectors or alternating dashed dividers (`border-bottom: 2px dashed #121212`).

## Shapes

The shape vocabulary is strictly **Sharp (`0`)**. Every element conforms to rigid right angles, reflecting the industrial guillotine cuts of a commercial thermal receipt printer.

- **Zero Curvature:** Buttons, photo frames, dialog modals, indicator badges, and viewport surfaces carry `border-radius: 0px`.
- **Structural Perforations:** Edges representing torn or continuous receipt slips incorporate 45-degree sawtooth zig-zag edge masks (`mask-image` or SVG border repeats) along top or bottom borders.
- **Corner Notches:** In place of rounded corners, high-priority interactive cards may feature diagonal 8px chamfered corners (angled cutouts) reminiscent of computer punch cards and paper feed tabs.

## Components

### Hardware Kiosk Status Bar
- Fixed top telemetry shelf.
- Features monospace diagnostics: connection status (`SIGNAL: 100%`), print head readiness (`THERMAL HEAD: OK`), paper remaining (`ROLL: 84%`), and active clock.
- Left-aligned live blink indicator with `#00FF66` green square; alerts toggle to `#FFB703` Amber.

### Touch Action Buttons
- **Primary Action (e.g., "PRINT RECEIPT STRIP", "CAPTURE"):** Minimum height 64px. Solid `#121212` background, `#F4F4F0` uppercase Space Grotesk text, 2px solid border, 4px hard black drop shadow. On tap: instant hard collapse to 0px offset with black inversion or `#FFB703` flash.
- **Secondary Action:** Minimum height 56px. Paper background (`#F4F4F0`), 2px solid `#121212` border, monospace label, hard 3px offset.
- **Destructive / Reset Action:** 2px dashed `#121212` border, monospace label with bracket framing: `[ ABORT SESSION ]`.

### Thermal Receipt Preview Cards
- Formatted with a continuous off-white ribbon style (`#F4F4F0` against `#EBEAE5` canvas).
- Top edge exhibits a jagged guillotine tear path; bottom edge terminates in a dashed perforation line.
- Content inside mirrors docket logic: header logo dithered into black dots, monospace transaction breakdown, 1-bit or ordered-dithered high-contrast black-and-white photos, and terminal-style barcode/QR code for digital delivery.

### Halftone Viewport (Live Camera Display)
- 2px solid `#121212` frame with crosshair target markers at the four corners.
- Live preview renders through an optional real-time 1-bit Bayer matrix dithering shader to match expected physical thermal print outputs.
- Countdown overlay rendered as massive centered Space Grotesk glyphs inside an amber `#FFB703` solid rectangular block.

### Dotted Dividers & Receipts Ledger Lists
- Line separations use dot-matrix rules: `border-top: 2px dotted #121212`.
- Option rows set in Space Mono with leader dots spanning from key to value (`COPIES ............ 02`, `FILTER ............ DITHER-8`).

### Selection Chips & Toggles
- Fixed height 48px to satisfy tactile hit criteria.
- Inactive state: 1px solid `#121212` outline, `#F4F4F0` fill, monospace text.
- Active state: `#121212` solid black fill, `#00FF66` or `#F4F4F0` high-contrast text, prefixed with an industrial dot indicator `[●]`.