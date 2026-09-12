import React, { useEffect, useState } from 'react'
import { api } from '../api.js'

const GENDER_OPTS = [
  { value: 'male', label: '👦 男' },
  { value: 'female', label: '👧 女' },
  { value: 'other', label: '🌈 保密' },
]
const AVATARS = ['👤', '🐱', '🐶', '🦊', '🐼', '🐧', '🐸', '🦁', '🐯', '🦄', '🐙', '🍀', '⭐', '🌙', '🍎', '🧋']

const GENDER_LABEL = { male: '男', female: '女', other: '保密' }

// 由生日算年龄
const calcAge = birthday => {
  if (!birthday) return null
  const b = new Date(birthday), n = new Date()
  let age = n.getFullYear() - b.getFullYear()
  const m = n.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) age--
  return age >= 0 && age < 150 ? age : null
}

// 由生日算星座(灵动小彩蛋)
const ZODIAC = [
  [1.20, '♒ 水瓶座'], [2.19, '♓ 双鱼座'], [3.21, '♈ 白羊座'], [4.20, '♉ 金牛座'],
  [5.21, '♊ 双子座'], [6.22, '♋ 巨蟹座'], [7.23, '♌ 狮子座'], [8.23, '♍ 处女座'],
  [9.23, '♎ 天秤座'], [10.24, '♏ 天蝎座'], [11.23, '♐ 射手座'], [12.22, '♑ 摩羯座'],
]
const calcZodiac = birthday => {
  if (!birthday) return null
  const b = new Date(birthday)
  const v = (b.getMonth() + 1) + b.getDate() / 100
  for (let i = 0; i < ZODIAC.length; i++)
    if (v >= ZODIAC[i][0] && v < ZODIAC[(i + 1) % 12][0]) return ZODIAC[i][1]
  return v >= 12.22 || v < 1.20 ? '♑ 摩羯座' : ZODIAC[0][1]
}

// 个人资料:头像 emoji / 性别 / 生日,自动算年龄和星座
export default function Profile({ onSaved }) {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ gender: '', birthday: '', avatar: '👤' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [delPassword, setDelPassword] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    api.getProfile().then(p => {
      setProfile(p)
      setForm({ gender: p.gender || '', birthday: p.birthday || '', avatar: p.avatar || '👤' })
    }).catch(() => setProfile({}))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.setProfile(form)
      onSaved?.()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  // 注销账号:验证密码后删除全部数据,不可恢复
  const confirmDelete = async () => {
    if (!delPassword) return alert('请输入密码确认')
    if (!confirm('确定要注销账号吗?所有数据将被永久删除,无法恢复!')) return
    setDeleting(true)
    try {
      await api.deleteAccount({ password: delPassword })
      localStorage.removeItem('token')
      localStorage.removeItem('username')
      localStorage.removeItem('avatar')
      alert('账号已注销,期待再相逢 🌱')
      location.hash = '#/login'
      location.reload()
    } catch (e) {
      alert('注销失败:' + e.message)
      setDeleting(false)
    }
  }

  const age = calcAge(form.birthday)
  const zodiac = calcZodiac(form.birthday)
  const today = new Date().toISOString().slice(0, 10)
  const isBirthday = form.birthday && form.birthday.slice(5) === today.slice(5)

  return (
    <div className="stagger d-flex flex-column">
      <div className="card p-4 mb-3 text-center profile-card">
        {/* 头像 */}
        <div className="profile-avatar mx-auto" title="选一个喜欢的头像">
          {form.avatar}
        </div>
        <div className="fw-bold mt-2" style={{ fontSize: '1.2rem' }}>{profile?.username || '…'}</div>
        {isBirthday && <div className="birthday-banner mt-2">🎂 今天生日,生日快乐!</div>}
        <div className="small text-muted mt-1">
          {age != null && <span>{age} 岁</span>}
          {age != null && zodiac && <span> · {zodiac}</span>}
          {form.birthday && <span> · {form.birthday}</span>}
          {!form.birthday && '完善资料,展示你的年龄和星座'}
        </div>
      </div>

      <div className="card p-3 mb-3">
        <div className="small text-muted fw-semibold mb-2">🎯 头像</div>
        <div className="d-flex flex-wrap gap-2">
          {AVATARS.map(a => (
            <button key={a} type="button"
                    className={`note-emoji-btn small-size ${form.avatar === a ? 'active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, avatar: a }))}>{a}</button>
          ))}
        </div>

        <div className="small text-muted fw-semibold mb-2 mt-3">性别</div>
        <div className="d-flex gap-2">
          {GENDER_OPTS.map(o => (
            <button key={o.value} type="button"
                    className={`cat-chip flex-grow-1 ${form.gender === o.value ? 'active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, gender: o.value }))}>{o.label}</button>
          ))}
        </div>

        <div className="small text-muted fw-semibold mb-2 mt-3">🎂 生日</div>
        <input type="date" className="form-control" max={today}
               value={form.birthday}
               onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} />

        <div className="d-flex gap-2 mt-4">
          <a href="#/" className="btn btn-light rounded-3 px-4 flex-grow-1 text-decoration-none">返回</a>
          <button className="btn btn-gradient rounded-3 px-4 flex-grow-1" disabled={saving} onClick={save}>
            {saved ? '✅ 已保存' : saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>

      {profile?.created_at && (
        <div className="small text-muted text-center">
          🗓️ 于 {profile.created_at.slice(0, 10)} 加入账本
        </div>
      )}

      {/* 危险区:注销账号 */}
      <div className="card p-3 mt-3 border-danger-subtle">
        <div className="small text-muted fw-semibold mb-1">⚠️ 危险区</div>
        <div className="small text-muted mb-2">注销后账号和全部数据(消费记录、随想、练习记录等)将被永久删除,无法恢复。</div>
        <button className="btn btn-outline-danger rounded-3 w-100" onClick={() => { setShowDelete(true); setDelPassword('') }}>
          🗑️ 注销账号
        </button>
      </div>

      {showDelete && (
        <div className="modal d-block modal-shell" tabIndex="-1" onClick={() => !deleting && setShowDelete(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content p-2">
              <div className="modal-header">
                <h5 className="modal-title fw-bold text-danger">⚠️ 确认注销账号</h5>
                <button className="btn-close" disabled={deleting} onClick={() => setShowDelete(false)} />
              </div>
              <div className="modal-body">
                <div className="small text-muted mb-3">
                  此操作<b className="text-danger">不可恢复</b>,将删除你的账号及全部数据。请输入登录密码确认是本人操作。
                </div>
                <input type="password" className="form-control" placeholder="输入登录密码"
                       value={delPassword} disabled={deleting}
                       onChange={e => setDelPassword(e.target.value)} />
              </div>
              <div className="modal-footer px-3 pb-3">
                <button className="btn btn-light rounded-3 px-4" disabled={deleting} onClick={() => setShowDelete(false)}>取消</button>
                <button className="btn btn-danger rounded-3 px-4" disabled={deleting || !delPassword} onClick={confirmDelete}>
                  {deleting ? '注销中…' : '确认注销'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
