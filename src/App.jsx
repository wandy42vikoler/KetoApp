import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RootRedirect, RedirectIfAuthed, RequireAuth, RequireOnboarding, RequireOnboarded } from './routes/Guards'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import Onboarding from './pages/onboarding/Onboarding'
import AppShell from './pages/app/AppShell'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route
            path="/login"
            element={
              <RedirectIfAuthed>
                <Login />
              </RedirectIfAuthed>
            }
          />
          <Route
            path="/signup"
            element={
              <RedirectIfAuthed>
                <Signup />
              </RedirectIfAuthed>
            }
          />
          <Route element={<RequireAuth />}>
            <Route element={<RequireOnboarding />}>
              <Route path="/onboarding" element={<Onboarding />} />
            </Route>
            <Route element={<RequireOnboarded />}>
              <Route path="/app" element={<AppShell />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
