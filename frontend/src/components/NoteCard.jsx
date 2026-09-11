import React, { useEffect, useState } from 'react'

const STORAGE_KEY = 'mood-notes'

// 心情 emoji + 常用装饰 emoji
const MOOD_EMOJIS = ['😊', '😔', '😠', '😭', '😱', '🥳', '😴', '🤔']
const DECOR_EMOJIS = ['✨', '🌈', '🍀', '🌸', '☕', '🎵', '💪', '🔥', '⭐', '🌙', '❤️', '🎉']

const loadNotes = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] }
}

// 随想笔记本:随手记录心情,支持选心情/装饰 emoji,存在浏览器本地
export default function NoteCard() {
  const [notes, setNotes] = useState(loadNotes)
  const [showModal, setShowModal] = useState(false)
  const [draft, setDraft] = useState({ mood: '😊', text: '', decor: [] })

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)) }, [notes])

  const openNew = () => { setDraft({ mood: '😊', text: '', decor: [] }); setShowModal(true) }

  const save = () => {
    const text = draft.text.trim()
    if (!text) return alert('写点什么再保存吧~')
    setNotes(n => [{ mood: draft.mood, text, decor: draft.decor, time: new Date().toISOString() }, ...n].slice(0, 50))
    setShowModal(false)
  }

  const del = i => setNotes(n => n.filter((_, j) => j !== i))

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

      {latest ? (
        <div className="note-preview" onClick={openNew} title="再写一笔">
          <span className="note-mood">{latest.mood}</span>
          <div className="flex-grow-1 min-w-0">
            <div className="small text-truncate">{latest.text}</div>
            <div className="small text-muted">{latest.decor.join(' ')} {timeLabel(latest.time)}</div>
          </div>
        </div>
      ) : (
        <div className="note-preview note-empty" onClick={openNew}>
          <span className="note-mood">💭</span>
          <span className="small text-muted">今天心情怎么样?点这里写下来…</span>
        </div>
      )}

      {notes.length > 1 && (
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
                      {notes.map((n, i) => (
                        <div key={i} className="note-history-item">
                          <span>{n.mood}</span>
                          <div className="flex-grow-1 min-w-0">
                            <div className="small text-truncate">{n.text}</div>
                            <div className="small text-muted" style={{ fontSize: '.7rem' }}>{timeLabel(n.time)}</div>
                          </div>
                          <button className="btn btn-sm btn-light border-0 p-1 px-2" onClick={() => del(i)}>🗑️</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer px-3 pb-3">
                <button className="btn btn-light rounded-3 px-4" onClick={() => setShowModal(false)}>取消</button>
                <button className="btn btn-gradient rounded-3 px-4" onClick={save}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
