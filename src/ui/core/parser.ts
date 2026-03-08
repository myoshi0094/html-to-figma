/**
 * parser.ts
 * HTML string → ParsedNode[] using getComputedStyle for accurate CSS extraction.
 *
 * Strategy:
 *  1. Inject <style> blocks from the HTML into the document <head>
 *  2. Insert the HTML body content into a hidden off-screen container
 *  3. Walk the live DOM tree and call getComputedStyle on every element
 *  4. Map computed styles to ParsedNode via mapper.ts helpers
 *  5. Tear down the injected elements
 */

import type { ParsedNode, NodeKind, Fill, Stroke, Layout, TextStyle } from '../../types'
import {
  cssColorToRgba,
  px,
  mapLayoutMode,
  mapJustifyContent,
  mapAlignItems,
  parseFontWeight,
  mapTextAlign,
  buildNodeName,
} from './mapper'

let _idCounter = 0
const uid = () => `n${++_idCounter}`

// Tags that are structurally invisible or irrelevant
const SKIP_TAGS = new Set([
  'script', 'style', 'head', 'meta', 'link', 'title',
  'noscript', 'template', 'slot',
])

// Tags that are inherently text containers (leaf text nodes).
// A tag is treated as TEXT only when it has no element children (text nodes only).
// 'button' is included here because <button>Label</button> should render as text,
// not as an empty FRAME (which would silently drop the label).
const TEXT_TAGS = new Set([
  'p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'a', 'label', 'button', 'li', 'dt', 'dd', 'caption', 'figcaption',
  'strong', 'em', 'b', 'i', 'small', 'mark', 'code',
  'pre', 'blockquote', 'time',
])

function resolveKind(el: Element): NodeKind {
  const tag = el.tagName.toLowerCase()
  if (tag === 'img') return 'IMAGE'
  if (tag === 'svg') return 'VECTOR'
  // Treat as TEXT if it's a known text tag AND has no element children
  if (TEXT_TAGS.has(tag) && el.children.length === 0) return 'TEXT'
  return 'FRAME'
}

// ─── Image asset fetching (runs in UI iframe — fetch is available) ────────────

// Figma createImage only supports raster formats: PNG, JPG, GIF, WEBP
const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

async function fetchImageBytes(src: string): Promise<number[] | null> {
  // Guard: skip empty src or src that resolved to the current document URL
  // (happens when <img> has no src attribute — el.src returns location.href).
  if (!src || src === window.location.href) return null
  // Allow http/https and data: URIs only; skip blob: or other schemes if needed.
  if (!src.startsWith('http') && !src.startsWith('data:')) return null
  // Skip SVG data URIs — Figma createImage doesn't accept SVG bytes.
  if (src.startsWith('data:image/svg')) return null

  try {
    const res = await fetch(src)
    if (!res.ok) return null
    const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim()
    if (!SUPPORTED_IMAGE_TYPES.includes(ct)) return null
    const buf = await res.arrayBuffer()
    return Array.from(new Uint8Array(buf))
  } catch {
    return null
  }
}

// ─── Per-element parsing ──────────────────────────────────────────────────────

async function parseElement(el: Element): Promise<ParsedNode | null> {
  const tag = el.tagName.toLowerCase()
  if (SKIP_TAGS.has(tag)) return null

  const cs = window.getComputedStyle(el)

  // Skip invisible elements
  if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) {
    return null
  }

  const rect = el.getBoundingClientRect()
  const kind = resolveKind(el)
  const name = buildNodeName(el)

  // ── Fills ──────────────────────────────────────────────────────────────────
  const fills: Fill[] = []

  if (kind === 'IMAGE' && el instanceof HTMLImageElement) {
    const bytes = await fetchImageBytes(el.src)
    if (bytes) {
      fills.push({ type: 'IMAGE', bytes })
    }
  } else {
    const bgRgba = cssColorToRgba(cs.backgroundColor)
    if (bgRgba) fills.push({ type: 'SOLID', color: bgRgba })
  }

  // ── Strokes ────────────────────────────────────────────────────────────────
  const strokes: Stroke[] = []
  const borderWidth = px(cs.borderWidth)
  if (borderWidth > 0 && cs.borderStyle !== 'none') {
    const borderRgba = cssColorToRgba(cs.borderColor)
    if (borderRgba) {
      strokes.push({ type: 'SOLID', color: borderRgba, weight: borderWidth })
    }
  }

  // ── Layout (Flex → Auto Layout) ────────────────────────────────────────────
  const layoutMode = mapLayoutMode(cs.display, cs.flexDirection)
  const layout: Layout = {
    layoutMode,
    primaryAxisAlignItems: layoutMode !== 'NONE' ? mapJustifyContent(cs.justifyContent) : 'MIN',
    counterAxisAlignItems: layoutMode !== 'NONE' ? mapAlignItems(cs.alignItems) : 'MIN',
    // gap shorthand → pick the axis-appropriate sub-property.
    // cs.rowGap / cs.columnGap are the resolved values; fall back to cs.gap
    // only when both are "normal" (browser default = no gap).
    itemSpacing:
      layoutMode !== 'NONE'
        ? layoutMode === 'VERTICAL'
          ? px(cs.rowGap !== 'normal' ? cs.rowGap : cs.gap)
          : px(cs.columnGap !== 'normal' ? cs.columnGap : cs.gap)
        : 0,
    paddingTop: px(cs.paddingTop),
    paddingRight: px(cs.paddingRight),
    paddingBottom: px(cs.paddingBottom),
    paddingLeft: px(cs.paddingLeft),
  }

  // ── Text ───────────────────────────────────────────────────────────────────
  let text: string | undefined
  let textStyle: TextStyle | undefined

  if (kind === 'TEXT') {
    const raw = el.textContent?.trim()
    if (raw) {
      text = raw
      const colorRgba = cssColorToRgba(cs.color) ?? { r: 0, g: 0, b: 0, a: 1 }
      const lhRaw = cs.lineHeight
      textStyle = {
        fontSize: px(cs.fontSize) || 16,
        fontWeight: parseFontWeight(cs.fontWeight),
        color: colorRgba,
        lineHeight: lhRaw === 'normal' ? 'AUTO' : px(lhRaw),
        letterSpacing: px(cs.letterSpacing),
        textAlign: mapTextAlign(cs.textAlign),
      }
    }
  }

  // ── SVG ────────────────────────────────────────────────────────────────────
  let svgContent: string | undefined
  if (kind === 'VECTOR') {
    svgContent = el.outerHTML
  }

  // ── Children (recurse) ─────────────────────────────────────────────────────
  const children: ParsedNode[] = []
  if (kind !== 'IMAGE' && kind !== 'VECTOR' && kind !== 'TEXT') {
    for (const child of Array.from(el.children)) {
      const parsed = await parseElement(child)
      if (parsed) children.push(parsed)
    }
  }

  // Heuristic: if all children are non-flex and there's no explicit flex on
  // the parent, attempt to infer vertical stacking as Auto Layout VERTICAL
  // when children are block-level and stacked top to bottom.
  const inferredLayout = inferAutoLayout(layout, children, cs)

  return {
    id: uid(),
    kind,
    name,
    width: Math.max(Math.round(rect.width), 1),
    height: Math.max(Math.round(rect.height), 1),
    layout: inferredLayout,
    fills,
    strokes,
    cornerRadius: px(cs.borderRadius),
    opacity: parseFloat(cs.opacity) || 1,
    text,
    textStyle,
    svgContent,
    children,
  }
}

/**
 * Heuristic: if the element is not already flex but all direct children are
 * block-level (display: block / flex), promote the parent to Auto Layout
 * VERTICAL so the import avoids "stacking overlap" in Figma.
 */
function inferAutoLayout(layout: Layout, children: ParsedNode[], cs: CSSStyleDeclaration): Layout {
  if (layout.layoutMode !== 'NONE') return layout
  if (children.length < 2) return layout
  if (cs.display === 'grid') {
    // Simple grid → treat as HORIZONTAL for now
    return { ...layout, layoutMode: 'HORIZONTAL', primaryAxisAlignItems: 'MIN' }
  }
  // All children block → promote to VERTICAL Auto Layout
  return {
    ...layout,
    layoutMode: 'VERTICAL',
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse an HTML string and return a tree of ParsedNodes.
 *
 * Injects any embedded <style> blocks into the document so that
 * getComputedStyle reflects the pasted stylesheet rules.
 */
export async function parseHTML(html: string): Promise<ParsedNode[]> {
  _idCounter = 0

  // 1. Extract and inject <style> blocks so getComputedStyle sees them
  const styleContainer = document.createElement('div')
  styleContainer.innerHTML = html
  const injectedStyles: HTMLStyleElement[] = []

  styleContainer.querySelectorAll('style').forEach((s) => {
    const style = document.createElement('style')
    style.textContent = s.textContent
    document.head.appendChild(style)
    injectedStyles.push(style)
  })

  // 2. Create an off-screen live container for layout computation
  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:1440px;pointer-events:none;'

  // Insert only <body> content (strip <html>/<head>/<body> wrappers if present)
  const doc = new DOMParser().parseFromString(html, 'text/html')
  host.innerHTML = doc.body.innerHTML
  document.body.appendChild(host)

  try {
    const results: ParsedNode[] = []
    for (const child of Array.from(host.children)) {
      const parsed = await parseElement(child)
      if (parsed) results.push(parsed)
    }
    return results
  } finally {
    document.body.removeChild(host)
    injectedStyles.forEach((s) => document.head.removeChild(s))
  }
}
