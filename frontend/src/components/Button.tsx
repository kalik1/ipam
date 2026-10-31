import type { ButtonHTMLAttributes } from 'react'
import { cx } from '@/lib/cx'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

export function buttonClass(variant: ButtonVariant = 'secondary', icon = false): string {
  return cx('btn', variant !== 'secondary' && `btn-${variant}`, icon && 'btn-icon')
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: boolean
}

export function Button({ variant = 'secondary', icon = false, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cx(buttonClass(variant, icon), className)} {...rest} />
}
