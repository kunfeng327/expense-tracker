import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import Home from './pages/Home.jsx'
import Stats from './pages/Stats.jsx'
import Login from './pages/Login.jsx'
import './style.css'

function Layout({ user, onLogout, children }) {
  return (
    <div className="app-shell">
      <nav className="navbar topbar" style={{ flex: 'none' }}>
        <div className="container d-flex justify-content-between align-items-center">
          <span className="brand text-white fw-bold">✦ 我的账本</span>
          {user && (
            <span className="text-white d-flex align-items-center gap-2">
              <span className="avatar">👤</span>
              <span className="small d-none d-sm-inline">{user}</span>
              <a href="#" className="text-white-50 small text-decoration-none"
                 onClick={e => { e.preventDefault(); onLogout() }}>退出</a>
            </span>
          )}
        </div>
      </nav>
      <div className="page-scroll">
        <div className="container pt-3" style={{ maxWidth: 640, paddingBottom: 92 }}>{children}</div>
      </div>
      <div className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon">📒</span>记账
        </NavLink>
        <NavLink to="/stats" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon">📊</span>统计
        </NavLink>
      </div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(
    localStorage.getItem('token') ? (localStorage.getItem('username') || null) : null
  )

  useEffect(() => {
    if (localStorage.getItem('token')) {
      import('./api.js').then(({ api }) =>
        api.me().then(d => setUser(d.username)).catch(() => setUser(null)))
    }
  }, [])

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    setUser(null)
  }

  return (
    <HashRouter>
      {user ? (
        <Layout user={user} onLogout={logout}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      ) : (
        <Routes>
          <Route path="/login" element={<Login onLogin={setUser} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </HashRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
