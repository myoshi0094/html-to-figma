import { useState, useCallback, useEffect } from 'react'
import { InputPanel } from './components/InputPanel'
import { PreviewPanel } from './components/PreviewPanel'
import { parseHTML } from './core/parser'
import type { ParsedNode, ToPlugin, ToUI } from '../types'

type Status = { kind: 'idle' } | { kind: 'parsing' } | { kind: 'sending' } | { kind: 'done'; count: number } | { kind: 'error'; message: string }

export function App() {
  const [nodes, setNodes] = useState<ParsedNode[]>([])
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const handleParse = useCallback(async (html: string) => {
    setStatus({ kind: 'parsing' })
    setNodes([])

    try {
      const parsed = await parseHTML(html)
      setNodes(parsed)

      if (parsed.length === 0) {
        setStatus({ kind: 'error', message: 'No renderable nodes found.' })
        return
      }

      // Send to Figma plugin
      setStatus({ kind: 'sending' })
      const msg: ToPlugin = { type: 'CREATE_NODES', nodes: parsed }
      parent.postMessage({ pluginMessage: msg }, '*')
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Parse failed.',
      })
    }
  }, [])

  // Listen for replies from plugin code.
  // Must be in useEffect so the listener is registered once and cleaned up on unmount.
  // Using addEventListener (not window.onmessage =) so we don't clobber other listeners.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as ToUI | undefined
      if (!msg) return

      if (msg.type === 'DONE') {
        setStatus({ kind: 'done', count: msg.count })
      } else if (msg.type === 'ERROR') {
        setStatus({ kind: 'error', message: msg.message })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const isLoading = status.kind === 'parsing' || status.kind === 'sending'

  return (
    <div className="app">
      <header className="app-header">
        <span className="logo">⬛ HTML → Figma</span>
        <StatusBadge status={status} />
      </header>

      <main className="app-body">
        <InputPanel onParse={handleParse} isLoading={isLoading} />
        <PreviewPanel nodes={nodes} />
      </main>
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  switch (status.kind) {
    case 'parsing':
      return <span className="status status-info">Parsing HTML…</span>
    case 'sending':
      return <span className="status status-info">Creating Figma nodes…</span>
    case 'done':
      return <span className="status status-success">✓ {status.count} nodes created</span>
    case 'error':
      return <span className="status status-error">✕ {status.message}</span>
    default:
      return null
  }
}
