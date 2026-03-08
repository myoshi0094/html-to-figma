/// <reference types="@figma/plugin-typings" />

import type { ParsedNode, ToPlugin, ToUI, RgbaColor, Fill, Stroke, Layout } from '../types'

// ─── Entry point ──────────────────────────────────────────────────────────────

figma.showUI(__html__, { width: 640, height: 560, title: 'HTML to Figma' })

figma.ui.onmessage = async (msg: ToPlugin) => {
  if (msg.type === 'CANCEL') {
    figma.closePlugin()
    return
  }

  if (msg.type === 'CREATE_NODES') {
    try {
      const created: SceneNode[] = []

      for (const node of msg.nodes) {
        const figmaNode = await buildNode(node)
        if (figmaNode) {
          figma.currentPage.appendChild(figmaNode)
          created.push(figmaNode)
        }
      }

      // Center all created nodes in viewport
      if (created.length > 0) {
        figma.viewport.scrollAndZoomIntoView(created)
      }

      const reply: ToUI = { type: 'DONE', count: created.length }
      figma.ui.postMessage(reply)
    } catch (err) {
      const reply: ToUI = {
        type: 'ERROR',
        message: err instanceof Error ? err.message : String(err),
      }
      figma.ui.postMessage(reply)
    }
  }
}

// ─── Node builder (recursive) ─────────────────────────────────────────────────

async function buildNode(node: ParsedNode): Promise<SceneNode | null> {
  switch (node.kind) {
    case 'VECTOR':
      return buildVector(node)
    case 'IMAGE':
      return buildImage(node)
    case 'TEXT':
      return buildText(node)
    case 'FRAME':
    default:
      return buildFrame(node)
  }
}

// ─── FRAME / Auto Layout ──────────────────────────────────────────────────────

async function buildFrame(node: ParsedNode): Promise<FrameNode> {
  const frame = figma.createFrame()
  frame.name = node.name
  frame.resize(Math.max(node.width, 1), Math.max(node.height, 1))
  frame.opacity = node.opacity
  frame.cornerRadius = node.cornerRadius

  applyFills(frame, node.fills)
  applyStrokes(frame, node.strokes)
  applyLayout(frame, node.layout)

  // Recursively build children
  for (const child of node.children) {
    const childNode = await buildNode(child)
    if (childNode) {
      frame.appendChild(childNode)
    }
  }

  // If Auto Layout is active, resize to hug content
  if (node.layout.layoutMode !== 'NONE') {
    frame.primaryAxisSizingMode = 'AUTO'
    frame.counterAxisSizingMode = 'AUTO'
  }

  return frame
}

// ─── TEXT ─────────────────────────────────────────────────────────────────────

async function buildText(node: ParsedNode): Promise<TextNode | FrameNode> {
  if (!node.text) {
    return buildFrame({ ...node, kind: 'FRAME', children: [] })
  }

  const text = figma.createText()
  text.name = node.name

  // Load font before setting characters
  const fontWeight = node.textStyle?.fontWeight ?? 400
  const fontStyle = fontWeight >= 700 ? 'Bold' : fontWeight <= 300 ? 'Light' : 'Regular'
  try {
    await figma.loadFontAsync({ family: 'Inter', style: fontStyle })
    text.fontName = { family: 'Inter', style: fontStyle }
  } catch {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
    text.fontName = { family: 'Inter', style: 'Regular' }
  }

  text.characters = node.text

  if (node.textStyle) {
    const ts = node.textStyle
    text.fontSize = ts.fontSize
    text.opacity = node.opacity
    text.letterSpacing = { value: ts.letterSpacing, unit: 'PIXELS' }
    text.textAlignHorizontal = ts.textAlign

    if (ts.lineHeight === 'AUTO') {
      text.lineHeight = { unit: 'AUTO' }
    } else {
      text.lineHeight = { value: ts.lineHeight as number, unit: 'PIXELS' }
    }

    // Text color via fills
    const { r, g, b, a } = ts.color
    text.fills = [{ type: 'SOLID', color: { r, g, b }, opacity: a }]
  }

  return text
}

// ─── IMAGE ────────────────────────────────────────────────────────────────────

async function buildImage(node: ParsedNode): Promise<RectangleNode | FrameNode> {
  // Find IMAGE fill
  const imageFill = node.fills.find((f) => f.type === 'IMAGE')
  if (!imageFill || imageFill.type !== 'IMAGE') {
    // Fallback: grey rectangle
    const rect = figma.createRectangle()
    rect.name = node.name
    rect.resize(Math.max(node.width, 1), Math.max(node.height, 1))
    rect.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }]
    return rect
  }

  const bytes = new Uint8Array(imageFill.bytes)
  const img = figma.createImage(bytes)

  const rect = figma.createRectangle()
  rect.name = node.name
  rect.resize(Math.max(node.width, 1), Math.max(node.height, 1))
  rect.fills = [
    {
      type: 'IMAGE',
      imageHash: img.hash,
      scaleMode: 'FILL',
    },
  ]
  rect.opacity = node.opacity
  rect.cornerRadius = node.cornerRadius
  return rect
}

// ─── SVG / VECTOR ─────────────────────────────────────────────────────────────

function buildVector(node: ParsedNode): FrameNode | SceneNode {
  if (!node.svgContent) {
    const frame = figma.createFrame()
    frame.name = node.name
    frame.resize(Math.max(node.width, 1), Math.max(node.height, 1))
    return frame
  }

  try {
    const vectorNode = figma.createNodeFromSvg(node.svgContent)
    vectorNode.name = node.name
    return vectorNode
  } catch {
    // Invalid SVG fallback
    const frame = figma.createFrame()
    frame.name = node.name
    frame.resize(Math.max(node.width, 1), Math.max(node.height, 1))
    frame.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }]
    return frame
  }
}

// ─── Apply helpers ────────────────────────────────────────────────────────────

function applyFills(node: FrameNode | RectangleNode, fills: Fill[]) {
  node.fills = fills
    .filter((f): f is { type: 'SOLID'; color: RgbaColor } => f.type === 'SOLID')
    .map((f) => ({
      type: 'SOLID' as const,
      color: { r: f.color.r, g: f.color.g, b: f.color.b },
      opacity: f.color.a,
    }))
}

function applyStrokes(node: FrameNode | RectangleNode, strokes: Stroke[]) {
  if (strokes.length === 0) return
  node.strokes = strokes.map((s) => ({
    type: 'SOLID' as const,
    color: { r: s.color.r, g: s.color.g, b: s.color.b },
    opacity: s.color.a,
  }))
  node.strokeWeight = strokes[0].weight
  node.strokeAlign = 'INSIDE'
}

function applyLayout(frame: FrameNode, layout: Layout) {
  if (layout.layoutMode === 'NONE') return

  frame.layoutMode = layout.layoutMode
  frame.primaryAxisAlignItems = layout.primaryAxisAlignItems
  frame.counterAxisAlignItems = layout.counterAxisAlignItems
  frame.itemSpacing = layout.itemSpacing
  frame.paddingTop = layout.paddingTop
  frame.paddingRight = layout.paddingRight
  frame.paddingBottom = layout.paddingBottom
  frame.paddingLeft = layout.paddingLeft
}
