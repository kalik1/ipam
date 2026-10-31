import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { getErrorMessage } from '@/lib/api'
import { cx } from '@/lib/cx'
import { isSearchShortcut, matchDevices, resultPath, stepIndex } from '@/lib/search'
import type { Device } from '@/types'
import { StatusLed } from '@/components/StatusLed'

const MAX_RESULTS = 8

function useDevices() {
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [error, setError] = useState('')
  const pending = useRef(false)

  const refresh = useCallback(() => {
    if (pending.current) return
    pending.current = true
    api
      .get<Device[]>('/devices')
      .then(({ data }) => {
        setDevices(data)
        setError('')
      })
      .catch((cause: unknown) => setError(getErrorMessage(cause, 'Could not load devices')))
      .finally(() => {
        pending.current = false
      })
  }, [])

  return { devices, error, refresh }
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  )
}

function ResultRow({ device }: { device: Device }) {
  const online = device.status === 'online'
  return (
    <>
      <StatusLed state={online ? 'on' : 'off'} label={online ? 'Online' : 'Offline'} />
      <span className="mono search-ip">{device.ip}</span>
      <span className={cx('search-host', !device.hostname && 'none')}>{device.hostname || 'No hostname'}</span>
      <span className="mono search-mac">{device.mac}</span>
      <span className="search-where">
        {device.subnet ? (
          <>
            {device.subnet.name} <span className="mono">{device.subnet.cidr}</span>
          </>
        ) : (
          'No subnet'
        )}
      </span>
    </>
  )
}

export function GlobalSearch() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)
  const { devices, error, refresh } = useDevices()

  const matches = useMemo(() => matchDevices(devices ?? [], query), [devices, query])
  const shown = matches.slice(0, MAX_RESULTS)
  const activeIndex = shown.length ? Math.max(0, Math.min(active, shown.length - 1)) : -1
  const open = focused && query.trim() !== ''

  useEffect(() => {
    function handleKey(event: globalThis.KeyboardEvent) {
      if (!isSearchShortcut(event, document.activeElement)) return
      if (document.querySelector('[aria-modal="true"]')) return
      event.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  function leave() {
    setQuery('')
    setActive(0)
    inputRef.current?.blur()
  }

  function choose(device: Device) {
    leave()
    navigate(resultPath(device))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      leave()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(stepIndex(activeIndex, event.key === 'ArrowDown' ? 1 : -1, shown.length))
    } else if (event.key === 'Enter' && shown[activeIndex]) {
      event.preventDefault()
      choose(shown[activeIndex])
    }
  }

  function status(): string | null {
    if (shown.length > 0) return null
    if (!devices) return error || 'Loading devices'
    return 'No devices match'
  }

  const message = status()
  const listed = open && !message

  return (
    <div className="search-box">
      <label className="search">
        <SearchIcon />
        <span className="sr-only">Search devices</span>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={listed}
          aria-controls={listed ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={listed && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          aria-keyshortcuts="/"
          placeholder="Search IP, MAC or hostname"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onFocus={() => {
            setFocused(true)
            refresh()
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
        />
        <kbd className="kbd mono" aria-hidden="true">
          /
        </kbd>
      </label>
      {open && (
        <div className="search-pop panel">
          {message ? (
            <p role="status" className={cx('search-msg', !devices && error && 'err')}>
              {message}
            </p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Matching devices" className="search-list">
              {shown.map((device, index) => (
                <li
                  key={device.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cx('search-opt', index === activeIndex && 'active')}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(device)}
                >
                  <ResultRow device={device} />
                </li>
              ))}
            </ul>
          )}
          {matches.length > shown.length && (
            <p className="search-more">
              Showing {shown.length} of {matches.length} devices, refine the search to see more
            </p>
          )}
        </div>
      )}
    </div>
  )
}
