import type { ParsedNode } from '../../types'

interface Props {
  nodes: ParsedNode[]
}

export function PreviewPanel({ nodes }: Props) {
  if (nodes.length === 0) {
    return (
      <div className="preview-panel preview-empty">
        <p className="empty-hint">Parsed node tree will appear here.</p>
      </div>
    )
  }

  return (
    <div className="preview-panel">
      <div className="panel-header">
        <span className="panel-title">Parsed Tree</span>
        <span className="shortcut-hint">{countNodes(nodes)} nodes</span>
      </div>
      <div className="tree-scroll">
        {nodes.map((node) => (
          <NodeRow key={node.id} node={node} depth={0} />
        ))}
      </div>
    </div>
  )
}

function NodeRow({ node, depth }: { node: ParsedNode; depth: number }) {
  const icon = kindIcon(node.kind)
  const layoutBadge =
    node.layout.layoutMode !== 'NONE' ? (
      <span className="badge badge-layout">
        {node.layout.layoutMode === 'HORIZONTAL' ? '↔' : '↕'} Auto Layout
      </span>
    ) : null

  return (
    <div className="tree-node" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
      <span className="node-icon">{icon}</span>
      <span className="node-name">{node.name}</span>
      {layoutBadge}
      <span className="node-size">
        {node.width}×{node.height}
      </span>
      {node.children.map((child) => (
        <NodeRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

function kindIcon(kind: ParsedNode['kind']): string {
  switch (kind) {
    case 'FRAME':
      return '▣'
    case 'TEXT':
      return 'T'
    case 'IMAGE':
      return '🖼'
    case 'VECTOR':
      return '◈'
  }
}

function countNodes(nodes: ParsedNode[]): number {
  return nodes.reduce((acc, n) => acc + 1 + countNodes(n.children), 0)
}
