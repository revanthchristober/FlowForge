'use client'
// useSSE — subscribes to /runs/{id}/events and invalidates TanStack Query on events
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSSEUrl } from './api'
import type { SSEEvent } from './types'

const TERMINAL_EVENTS = new Set(['run_complete', 'run_error'])
const INVALIDATE_ON = new Set([
  'run_started', 'run_complete', 'run_resumed', 'run_error',
  'on_chain_end', 'on_chain_start',
])

export function useSSE(runId: string | null) {
  const queryClient = useQueryClient()
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!runId) return

    let closed = false

    function connect() {
      if (closed) return
      const es = new EventSource(getSSEUrl(runId!))
      esRef.current = es

      es.onmessage = (e) => {
        try {
          const evt: SSEEvent = JSON.parse(e.data)
          if (evt.type === 'ping') return

          if (INVALIDATE_ON.has(evt.type)) {
            // Refresh run summary + full state
            queryClient.invalidateQueries({ queryKey: ['run', runId] })
            queryClient.invalidateQueries({ queryKey: ['run-state', runId] })
            queryClient.invalidateQueries({ queryKey: ['run-cost', runId] })
            queryClient.invalidateQueries({ queryKey: ['run-eval', runId] })
          }

          if (TERMINAL_EVENTS.has(evt.type)) {
            es.close()
          }
        } catch {
          // ignore parse errors
        }
      }

      es.onerror = () => {
        es.close()
        // Reconnect after 3s unless intentionally closed
        if (!closed) {
          setTimeout(connect, 3000)
        }
      }
    }

    connect()

    return () => {
      closed = true
      esRef.current?.close()
    }
  }, [runId, queryClient])
}
