/**
 * mapper.ts
 * CSS value → Figma-compatible value converters.
 * Pure functions — no DOM access, no side effects.
 */

import type { RgbaColor, PrimaryAxisAlign, CounterAxisAlign, LayoutMode } from '../../types'

// ─── Color ────────────────────────────────────────────────────────────────────

/**
 * Convert any CSS color string to RGBA (0-1 range).
 * Uses a 1×1 canvas as a universal CSS color parser.
 */
export function cssColorToRgba(color: string): RgbaColor | null {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)

  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
  if (a === 0) return null

  return { r: r / 255, g: g / 255, b: b / 255, a: a / 255 }
}

// ─── Units ────────────────────────────────────────────────────────────────────

/** Parse a CSS pixel value like "12.5px" → 12.5. Returns 0 on failure. */
export function px(value: string): number {
  const n = parseFloat(value)
  return isNaN(n) ? 0 : Math.round(n * 100) / 100
}

// ─── Flex → Auto Layout ───────────────────────────────────────────────────────

/**
 * Map CSS `display` + `flex-direction` → Figma layoutMode.
 * Non-flex elements → 'NONE'.
 */
export function mapLayoutMode(display: string, flexDirection: string): LayoutMode {
  if (display !== 'flex' && display !== 'inline-flex') return 'NONE'
  return flexDirection === 'column' || flexDirection === 'column-reverse'
    ? 'VERTICAL'
    : 'HORIZONTAL'
}

/**
 * Map CSS `justify-content` → Figma primaryAxisAlignItems.
 *
 * justify-content controls alignment along the main axis:
 *   flex-start / start  → MIN
 *   center              → CENTER
 *   flex-end / end      → MAX
 *   space-between       → SPACE_BETWEEN
 */
export function mapJustifyContent(value: string): PrimaryAxisAlign {
  switch (value) {
    case 'center':
      return 'CENTER'
    case 'flex-end':
    case 'end':
    case 'right':
      return 'MAX'
    case 'space-between':
      return 'SPACE_BETWEEN'
    default:
      return 'MIN'
  }
}

/**
 * Map CSS `align-items` → Figma counterAxisAlignItems.
 *
 * align-items controls alignment along the cross axis:
 *   flex-start / start  → MIN
 *   center              → CENTER
 *   flex-end / end      → MAX
 */
export function mapAlignItems(value: string): CounterAxisAlign {
  switch (value) {
    case 'center':
      return 'CENTER'
    case 'flex-end':
    case 'end':
      return 'MAX'
    default:
      return 'MIN'
  }
}

// ─── Typography ───────────────────────────────────────────────────────────────

/** Resolve keyword font-weight to a number (e.g. "bold" → 700). */
export function parseFontWeight(value: string): number {
  const keyword: Record<string, number> = {
    thin: 100,
    hairline: 100,
    'extra-light': 200,
    'ultra-light': 200,
    light: 300,
    normal: 400,
    regular: 400,
    medium: 500,
    'semi-bold': 600,
    'demi-bold': 600,
    bold: 700,
    'extra-bold': 800,
    'ultra-bold': 800,
    black: 900,
    heavy: 900,
    bolder: 700,
    lighter: 300,
  }
  return keyword[value.toLowerCase()] ?? (parseInt(value, 10) || 400)
}

/** Map CSS `text-align` to Figma text alignment. */
export function mapTextAlign(
  value: string,
): 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED' {
  switch (value) {
    case 'center':
      return 'CENTER'
    case 'right':
    case 'end':
      return 'RIGHT'
    case 'justify':
      return 'JUSTIFIED'
    default:
      return 'LEFT'
  }
}

// ─── Node naming ─────────────────────────────────────────────────────────────

/**
 * Generate a human-readable Figma node name from an element.
 * Examples: "div.container", "button#submit", "h1"
 */
export function buildNodeName(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const id = el.id ? `#${el.id}` : ''
  const classes = Array.from(el.classList)
    .filter((c) => c.length > 0)
    .slice(0, 3)
    .join('.')

  if (classes) return `${tag}.${classes}`
  if (id) return `${tag}${id}`
  return tag
}
