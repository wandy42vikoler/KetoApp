import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SplashScreen from '../components/ui/SplashScreen'

export function RootRedirect() {
  const { session, needsOnboarding, loading } = useAuth()
  if (loading) return <SplashScreen />
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={needsOnboarding ? '/onboarding' : '/app'} replace />
}

export function RedirectIfAuthed({ children }) {
  const { session, needsOnboarding, loading } = useAuth()
  if (loading) return <SplashScreen />
  if (session) return <Navigate to={needsOnboarding ? '/onboarding' : '/app'} replace />
  return children
}

export function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return <SplashScreen />
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RequireOnboarding() {
  const { needsOnboarding, loading } = useAuth()
  if (loading) return <SplashScreen />
  if (!needsOnboarding) return <Navigate to="/app" replace />
  return <Outlet />
}

export function RequireOnboarded() {
  const { needsOnboarding, loading } = useAuth()
  if (loading) return <SplashScreen />
  if (needsOnboarding) return <Navigate to="/onboarding" replace />
  return <Outlet />
}
