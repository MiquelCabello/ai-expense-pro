import { render } from '@testing-library/react'
import { screen, fireEvent } from '@testing-library/dom'
import { expect, describe, it, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import AuthPage from '@/pages/AuthPage'
import { AuthProvider } from '@/hooks/useAuth'

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    }))
  }
}))

const AuthPageWrapper = () => (
  <BrowserRouter>
    <AuthProvider>
      <AuthPage />
    </AuthProvider>
  </BrowserRouter>
)

describe('AuthPage', () => {
  it('renders login form by default', () => {
    render(<AuthPageWrapper />)
    expect(screen.getByText(/iniciar sesión/i)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument()
  })

  it('can switch to register form', async () => {
    render(<AuthPageWrapper />)
    const registerButton = screen.getByText(/crear cuenta/i)
    fireEvent.click(registerButton)
    
    expect(screen.getByText(/registrarse/i)).toBeInTheDocument()
  })
})