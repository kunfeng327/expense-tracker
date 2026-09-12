import React, { useEffect, useState } from 'react'
import { api } from '../api'

// 心情 emoji + 常用装饰 emoji
const MOOD_EMOJIS = ['😊', '😔', '😠', '😭', '😱', '🥳', '😴', '🤔']
const DECOR_EMOJIS = ['✨', '🌈', '🍀', '🌸', '☕', '🎵', '💪', '🔥', '⭐', '🌙', '❤️', '🎉']

// 随想笔记本:随手记录心情,支持选心情/装饰 emoji,保存在服务端(按账号隔离)
export default function NoteCard() {
  const [notes, setNotes] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [draft, setDraft] = useState({ mood: '😊', text: '', decor: [] })
  const [viewId, setViewId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    api.listNotes().then(setNotes).catch(() => {}) // 拉取失败保持现状,不打断页面
  }
  useEffect(() => {
    load()
    // 一次性迁移:把旧版存在 localStorage 的随想上传到账号,成功后清掉本地
    const migrate = async () => {
      let local = []
      try { local = JSON.parse(localStorage.getItem('mood-notes')) || [] } catch { local = [] }
      if (!local.length) return
      try {
        for (const n of local.slice().reverse()) {
          if (n && n.text) await api.addNote({ mood: n.mood || '😊', text: n.text, decor: n.decor || [] })
        }
        localStorage.removeItem('mood-notes')
        load()
      } catch { /* 迁移失败下次再试 */ }
    }
    migrate()
  }, [])

  const openNew = () => { setDraft({ mood: '😊', text: '', decor: [] }); setShowModal(true) }

  const save = async () => {
    const text = draft.text.trim()
    if (!text) return alert('写点什么再保存吧~')
    if (text.length > 500) return alert('随想最多 500 字哦~')
    setSaving(true)
    try {
      await api.addNote({ mood: draft.mood, text, decor: draft.decor })
      setShowModal(false)
      load()
    } catch (e) {
      alert('保存失败:' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const del = async id => {
    try { await api.deleteNote(id); load() } catch (e) { alert('删除失败:' + e.message) }
  }

  const toggleDecor = e =>
    setDraft(d => ({ ...d, decor: d.decor.includes(e) ? d.decor.filter(x => x !== e) : [...d.decor, e] }))

  const latest = notes[0]
  const timeLabel = iso => {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="card p-3 w-100 note-card">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="small text-muted fw-semibold">📔 随想笔记本</span>
        <button className="btn btn-sm btn-gradient rounded-pill px-3" onClick={openNew}>✍️ 写一笔</button>
      </div>

      {notes.length > 0 ? (
        <div className="note-list">
          {notes.slice(0, 3).map(n => (
            <div key={n.id} className="note-preview" onClick={() => setViewId(n.id)} title="点击查看全文">
              <span className="note-mood">{n.mood}</span>
              <div className="flex-grow-1 min-w-0">
                <div className="small note-text-clamp">{n.text}</div>
                <div className="small text-muted note-time">{n.decor.join(' ')} {timeLabel(n.time)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="note-preview note-empty" onClick={openNew}>
          <span className="note-mood">💭</span>
          <span className="small text-muted">今天心情怎么样?点这里写下来…</span>
        </div>
      )}

      {notes.length > 3 && (
        <div className="small text-muted text-end mt-1">
          共 {notes.length} 条随想
        </div>
      )}

      {showModal && (
        <div className="modal d-block modal-shell" tabIndex="-1" onClick={() => setShowModal(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content p-2">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">📔 写下此刻</h5>
                <button className="btn-close" onClick={() => setShowModal(false)} /></div>
              <div className="modal-body">
                <label className="form-label small text-muted">此刻的心情</label>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {MOOD_EMOJIS.map(m => (
                    <button key={m} type="button"
                            className={`note-emoji-btn ${draft.mood === m ? 'active' : ''}`}
                            onClick={() => setDraft(d => ({ ...d, mood: m }))}>{m}</button>
                  ))}
                </div>

                <label className="form-label small text-muted">加点装饰(可多选)</label>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {DECOR_EMOJIS.map(m => (
                    <button key={m} type="button"
                            className={`note-emoji-btn small-size ${draft.decor.includes(m) ? 'active' : ''}`}
                            onClick={() => toggleDecor(m)}>{m}</button>
                  ))}
                </div>

                <textarea className="form-control bg-light border-0 mb-2" rows="4" placeholder="这一刻在想什么…"
                          value={draft.text} onChange={e => setDraft(d => ({ ...d, text: e.target.value }))} />

                {notes.length > 0 && (
                  <>
                    <label className="form-label small text-muted mt-2">历史随想</label>
                    <div className="note-history">
                      {notes.map(n => (
                        <div key={n.id} className="note-history-item" style={{ cursor: 'pointer' }} onClick={() => { setShowModal(false); setViewId(n.id) }}>
                          <span>{n.mood}</span>
                          <div className="flex-grow-1 min-w-0">
                            <div className="small note-text-clamp">{n.text}</div>
                            <div className="small text-muted" style={{ fontSize: '.7rem' }}>{timeLabel(n.time)}</div>
                          </div>
                          <button className="btn btn-sm btn-light border-0 p-1 px-2" onClick={e => { e.stopPropagation(); del(n.id) }}>🗑️</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer px-3 pb-3">
                <button className="btn btn-light rounded-3 px-4" onClick={() => setShowModal(false)}>取消</button>
                <button className="btn btn-gradient rounded-3 px-4" disabled={saving} onClick={save}>{saving ? '保存中…' : '保存'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewId !== null && (() => {
        const cur = notes.find(n => n.id === viewId)
        if (!cur) return null
        return (
        <div className="modal d-block modal-shell" tabIndex="-1" onClick={() => setViewId(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content p-2">
              <div className="modal-header">
                <h5 className="modal-title fw-bold"><span className="note-mood">{cur.mood}</span> 这一刻</h5>
                <button className="btn-close" onClick={() => setViewId(null)} /></div>
              <div className="modal-body">
                <div className="note-view-text">{cur.text}</div>
                <div className="small text-muted text-end mt-3">
                  {cur.decor.join(' ')} {timeLabel(cur.time)}
                </div>
              </div>
              <div className="modal-footer px-3 pb-3">
                <button className="btn btn-light rounded-3 px-4" onClick={() => setViewId(null)}>关闭</button>
                <button className="btn btn-outline-danger rounded-3 px-4"
                        onClick={() => { del(cur.id); setViewId(null) }}>🗑️ 删除</button>
              </div>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}
