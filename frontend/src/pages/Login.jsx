import React, { useState } from 'react'
import { api } from '../api.js'

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'register') {
        // 注册成功后不自动登录,跳到登录界面
        await api.auth('register', { username, password })
        setMode('login')
        setPassword('')
        setNotice('🎉 注册成功,请登录')
      } else {
        const data = await api.auth('login', { username, password })
        localStorage.setItem('token', data.token)
        localStorage.setItem('username', data.username)
        onLogin(data.username)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-scroll d-flex justify-content-center" style={{ paddingTop: '6vh', paddingBottom: 24 }}>
      <div style={{ width: 380, maxWidth: '92vw' }}>
        <div className="text-center mb-3">
          <div style={{
            width: 56, height: 56, margin: '0 auto 10px', borderRadius: 17, fontSize: 28,
            background: 'linear-gradient(120deg, var(--primary-deep), var(--violet))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-lg)',
          }}>💰</div>
          <h4 className="fw-bold mb-1">我的账本</h4>
          <p className="text-muted small mb-0">
            {mode === 'login' ? '欢迎回来,登录后继续记账' : '创建账号,开启理性消费之旅'}
          </p>
        </div>

        <div className="card p-4 pt-3">
          {error && <div className="alert alert-danger py-2 small mb-3">⚠️ {error}</div>}
          {notice && <div className="alert alert-success py-2 small mb-3">{notice}</div>}
          <form onSubmit={submit}>
            <div className="mb-3">
              <label className="form-label small text-muted">用户名</label>
              <input className="form-control form-control-lg bg-light border-0" style={{ borderRadius: 14, paddingLeft: 16 }}
                     value={username} autoComplete="username"
                     onChange={e => setUsername(e.target.value)} placeholder="3-20 个字符" required />
            </div>
            <div className="mb-3">
              <label className="form-label small text-muted">密码</label>
              <input type="password" className="form-control form-control-lg bg-light border-0" style={{ borderRadius: 14, paddingLeft: 16 }}
                     value={password}
                     autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                     onChange={e => setPassword(e.target.value)} placeholder="至少 6 位" required />
            </div>
            <button className="btn btn-gradient w-100 py-2 fw-semibold" disabled={loading} style={{ borderRadius: 14 }}>
              {loading ? '请稍候...' : (mode === 'login' ? '登 录' : '注 册')}
            </button>
          </form>
          <div className="text-center mt-2 mb-1">
            <a href="#" className="small text-decoration-none" style={{ color: 'var(--primary)' }} onClick={e => {
              e.preventDefault()
              setMode(m => m === 'login' ? 'register' : 'login')
              setError('')
              setNotice('')
            }}>
              {mode === 'login' ? '没有账号?去注册 →' : '← 已有账号?去登录'}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
