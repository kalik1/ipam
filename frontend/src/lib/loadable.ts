import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from './api'

export type Loadable<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string }

export function useLoadable<T>(fetcher: () => Promise<T>, failure: string): { state: Loadable<T>; refetch: () => void } {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading' })

  const refetch = useCallback(() => {
    fetcher()
      .then((data) => setState({ status: 'ready', data }))
      .catch((error: unknown) => setState((current) => (current.status === 'ready' ? current : { status: 'error', message: getErrorMessage(error, failure) })))
  }, [fetcher, failure])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { state, refetch }
}
