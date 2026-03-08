// ─── Parsed intermediate representation ───────────────────────────────────────

export type NodeKind = 'FRAME' | 'TEXT' | 'IMAGE' | 'VECTOR'

export interface RgbaColor {
  r: number // 0-1
  g: number // 0-1
  b: number // 0-1
  a: number // 0-1
}

export interface SolidFill {
  type: 'SOLID'
  color: RgbaColor
}

export interface ImageFill {
  type: 'IMAGE'
  bytes: number[] // Uint8Array serialized as plain array for postMessage
}

export type Fill = SolidFill | ImageFill

export interface Stroke {
  type: 'SOLID'
  color: RgbaColor
  weight: number
}

export type LayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL'
export type PrimaryAxisAlign = 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
export type CounterAxisAlign = 'MIN' | 'CENTER' | 'MAX'

export interface Layout {
  layoutMode: LayoutMode
  primaryAxisAlignItems: PrimaryAxisAlign
  counterAxisAlignItems: CounterAxisAlign
  itemSpacing: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
}

export interface TextStyle {
  fontSize: number
  fontWeight: number
  color: RgbaColor
  lineHeight: number | 'AUTO'
  letterSpacing: number
  textAlign: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
}

export interface ParsedNode {
  id: string
  kind: NodeKind
  name: string
  width: number
  height: number
  layout: Layout
  fills: Fill[]
  strokes: Stroke[]
  cornerRadius: number
  opacity: number
  // TEXT
  text?: string
  textStyle?: TextStyle
  // VECTOR (SVG)
  svgContent?: string
  children: ParsedNode[]
}

// ─── Plugin ↔ UI message contract ─────────────────────────────────────────────

export type ToPlugin =
  | { type: 'CREATE_NODES'; nodes: ParsedNode[] }
  | { type: 'CANCEL' }

export type ToUI =
  | { type: 'DONE'; count: number }
  | { type: 'ERROR'; message: string }
