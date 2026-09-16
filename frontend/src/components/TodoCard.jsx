import React, { useEffect, useState } from 'react'

// 任务存在 localStorage,按日期分桶:过天自动换新清单
const keyOf = () => {
  const d = new Date()
  return `todo-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const load = () => {
  try {
    const arr = JSON.parse(localStorage.getItem(keyOf()))
    if (Array.isArray(arr)) return arr.filter(t => t && typeof t.text === 'string')
  } catch { /* 损坏则重置 */ }
  return []
}
const persist = tasks => {
  try { localStorage.setItem(keyOf(), JSON.stringify(tasks)) } catch { /* 存不了就只在内存里 */ }
}

// 今日任务卡:固定大小,卡片只显示进度和前几条;点"加一个任务"弹窗管理(仿随想笔记本)
export default function TodoCard() {
  const [tasks, setTasks] = useState(load)
  const [text, setText] = useState('')
  const [showModal, setShowModal] = useState(false)
  useEffect(() => { persist(tasks) }, [tasks])

  const add = e => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setTasks(ts => [...ts, { id: Date.now(), text: t, done: false }])
    setText('')
  }
  const toggle = id => setTasks(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t))
  const del = id => setTasks(ts => ts.filter(t => t.id !== id))

  const done = tasks.filter(t => t.done).length

  const renderItem = t => (
    <div key={t.id} className="todo-item">
      <button type="button"
              className={`todo-check ${t.done ? 'done' : ''}`}
              onClick={() => toggle(t.id)}
              title={t.done ? '点击标记未完成' : '点击完成'}>{t.done ? '✓' : ''}</button>
      <span className={`todo-text flex-grow-1 min-w-0 ${t.done ? 'done' : ''}`}
            onClick={() => toggle(t.id)}>{t.text}</span>
      <button type="button" className="todo-del" onClick={() => del(t.id)} title="删除">✕</button>
    </div>
  )

  return (
    <div className="card p-3 w-100 todo-card">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="small text-muted fw-semibold">✅ 今日任务</span>
        <button className="btn btn-sm btn-gradient rounded-pill px-3" onClick={() => setShowModal(true)}>➕ 加任务</button>
      </div>

      {tasks.length > 0 && (
        <div className="progress todo-progress mb-2" style={{ height: 5 }}>
          <div className="progress-bar" role="progressbar"
               style={{ width: `${Math.round(done / tasks.length * 100)}%` }} />
        </div>
      )}

      {tasks.length > 0 ? (
        <div className="todo-list">
          {tasks.slice(0, 4).map(renderItem)}
          {tasks.length > 4 && (
            <div className="small text-muted text-end mt-1" style={{ cursor: 'pointer' }}
                 onClick={() => setShowModal(true)}>共 {tasks.length} 项,点击查看全部 ▼</div>
          )}
        </div>
      ) : (
        <div className="todo-list todo-empty small text-muted" style={{ cursor: 'pointer' }} onClick={() => setShowModal(true)}>
          今天还没有任务,点"加任务"添加一个吧~
        </div>
      )}

      {showModal && (
        <div className="modal d-block modal-shell" tabIndex="-1" onClick={() => setShowModal(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content p-2">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">✅ 今日任务 · {done}/{tasks.length}</h5>
                <button className="btn-close" onClick={() => setShowModal(false)} /></div>
              <div className="modal-body">
                <form className="d-flex gap-2 mb-3" onSubmit={add}>
                  <input className="form-control bg-light border-0 todo-input"
                         placeholder="要做什么…" maxLength="50" autoFocus
                         value={text} onChange={e => setText(e.target.value)} />
                  <button className="btn btn-gradient rounded-3 px-4 flex-shrink-0" type="submit">添加</button>
                </form>
                {tasks.length === 0 && <div className="small text-muted">还没有任务,在上面输入第一个吧~</div>}
                <div className="todo-history">
                  {tasks.map(renderItem)}
                </div>
              </div>
              <div className="modal-footer px-3 pb-3">
                <button className="btn btn-gradient rounded-3 px-4" onClick={() => setShowModal(false)}>完成</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
