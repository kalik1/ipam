import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getErrorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/useTheme'
import { Button } from '@/components/Button'
import { FormField, inputClass } from '@/components/FormField'
import { Panel } from '@/components/Panel'
import { Tooltip } from '@/components/Tooltip'
import { BrandMark, ThemeIcon } from '@/components/icons'

export default function LoginPage() {
  const { login } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const themeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid username or password'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login">
      <Tooltip tip={themeLabel} describe={false}>
        <Button icon className="login-theme" aria-label={themeLabel} onClick={toggle}>
          <ThemeIcon />
        </Button>
      </Tooltip>
      <Panel hud className="login-card" aria-labelledby="login-title">
        <span className="cscrew tl" aria-hidden="true" />
        <span className="cscrew tr" aria-hidden="true" />
        <span className="cscrew bl" aria-hidden="true" />
        <span className="cscrew br" aria-hidden="true" />
        <div className="login-head brushed">
          <BrandMark ledClassName="brand-led" />
          <div>
            <b>IPAM</b>
            <span>Network address manager</span>
          </div>
          <span className="vent" aria-hidden="true" />
        </div>
        <form onSubmit={handleSubmit} className="login-body">
          <h1 id="login-title" className="heading">
            Sign in
          </h1>
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <FormField label="Username">
            <input
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </FormField>
          <FormField label="Password">
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </FormField>
          <Button type="submit" variant="primary" disabled={loading} aria-busy={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </Panel>
    </main>
  )
}
