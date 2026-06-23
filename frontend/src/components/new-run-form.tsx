'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startRun } from '@/lib/api'

export function NewRunForm({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [prd, setPrd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!prd.trim()) return
    setLoading(true)
    setError('')
    try {
      const { run_id } = await startRun(prd.trim())
      onClose()
      router.push(`/runs/${run_id}`)
    } catch (err) {
      setError(String(err))
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-navy/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate rounded-2xl p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-cream font-semibold text-lg">New ForgeFlow Run</h2>
          <button onClick={onClose} className="text-muted hover:text-cream text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-muted text-xs uppercase tracking-wider block mb-2">
              Product Requirements Document (PRD)
            </label>
            <textarea
              value={prd}
              onChange={e => setPrd(e.target.value)}
              placeholder={"# My API\n\n## Overview\nA REST API that does..."}

              className="w-full bg-navy/60 border border-muted/30 rounded-xl p-4 text-cream text-sm font-mono placeholder-muted resize-none focus:outline-none focus:border-coral/60 h-48"
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !prd.trim()}
              className="flex-1 bg-coral text-navy font-bold py-3 px-6 rounded-xl hover:bg-coral/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Starting run…' : '🚀 Start Run'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-muted/30 text-muted rounded-xl hover:text-cream hover:border-muted/60 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
