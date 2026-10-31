import { cx } from '@/lib/cx'

export interface SelectorOption<T extends string> {
  value: T
  label: string
  count?: number
}

interface SelectorProps<T extends string> {
  label: string
  options: SelectorOption<T>[]
  value: T
  onChange: (value: T) => void
}

export function Selector<T extends string>({ label, options, value, onChange }: SelectorProps<T>) {
  return (
    <div className="selector" role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={cx('chip', active && 'active')}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            {option.count !== undefined && <b>{option.count}</b>}
          </button>
        )
      })}
    </div>
  )
}
