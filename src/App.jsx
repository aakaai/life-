import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { MODULES } from './modules'
import Layout from './components/Layout'
import Home from './pages/Home'
import ModulePage from './pages/ModulePage'
import More from './pages/More'
import Settings from './pages/Settings'
import Login from './pages/Login'

// HashRouter (#/sport) : indispensable sur GitHub Pages, qui ne sait pas
// renvoyer index.html pour une adresse comme /sport.
function Routed() {
  const { loading, session } = useAuth()
  if (loading) return <div className="boot" aria-busy="true" />
  if (!session) return <Login />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        {MODULES.map((m) => (
          <Route key={m.id} path={`${m.path.slice(1)}/*`} element={<ModulePage module={m} />} />
        ))}
        <Route path="plus" element={<More />} />
        <Route path="reglages" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routed />
      </HashRouter>
    </AuthProvider>
  )
}
