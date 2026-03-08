import { useState } from 'react'

interface Props {
  onParse: (html: string) => void
  isLoading: boolean
}

const PLACEHOLDER = `<!-- Paste your HTML here (inline styles or <style> block) -->
<div style="display:flex;flex-direction:column;gap:16px;padding:24px;background:#f5f5f5;border-radius:8px;">
  <h1 style="font-size:24px;font-weight:700;color:#111;">Hello Figma</h1>
  <p style="font-size:14px;color:#555;">This is a paragraph.</p>
  <button style="background:#0070f3;color:#fff;padding:8px 16px;border-radius:6px;">Click me</button>
</div>`

export function InputPanel({ onParse, isLoading }: Props) {
  const [html, setHtml] = useState('')

  const handleParse = () => {
    const trimmed = html.trim()
    if (trimmed) onParse(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter to trigger parse
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleParse()
    }
  }

  return (
    <div className="input-panel">
      <div className="panel-header">
        <span className="panel-title">HTML Input</span>
        <span className="shortcut-hint">⌘↵ to import</span>
      </div>

      <textarea
        className="html-input"
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={PLACEHOLDER}
        spellCheck={false}
        autoComplete="off"
      />

      <div className="panel-footer">
        <button
          className="btn btn-secondary"
          onClick={() => setHtml('')}
          disabled={isLoading || html.trim() === ''}
        >
          Clear
        </button>
        <button
          className="btn btn-primary"
          onClick={handleParse}
          disabled={isLoading || html.trim() === ''}
        >
          {isLoading ? 'Importing…' : 'Import to Figma'}
        </button>
      </div>
    </div>
  )
}
