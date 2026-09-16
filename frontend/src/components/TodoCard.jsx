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

// 今日任务卡:添加/勾选/删除当天任务,进度条一目了然
export default function TodoCard() {
  const [tasks, setTasks] = useState(load)
  const [text, setText] = useState('')
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

  return (
    <div className="card p-3 w-100 todo-card">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="small text-muted fw-semibold">✅ 今日任务</span>
        {tasks.length > 0 && (
          <span className="small text-muted">{done}/{tasks.length} 完成</span>
        )}
      </div>

      {tasks.length > 0 && (
        <div className="progress todo-progress mb-2" style={{ height: 5 }}>
          <div className="progress-bar" role="progressbar"
               style={{ width: `${Math.round(done / tasks.length * 100)}%` }} />
        </div>
      )}

      <div className="todo-list">
        {tasks.map(t => (
          <div key={t.id} className="todo-item">
            <button type="button"
                    className={`todo-check ${t.done ? 'done' : ''}`}
                    onClick={() => toggle(t.id)}
                    title={t.done ? '点击标记未完成' : '点击完成'}>{t.done ? '✓' : ''}</button>
            <span className={`todo-text flex-grow-1 min-w-0 ${t.done ? 'done' : ''}`}
                  onClick={() => toggle(t.id)}>{t.text}</span>
            <button type="button" className="todo-del" onClick={() => del(t.id)} title="删除">✕</button>
          </div>
        ))}
      </div>

      <form className="d-flex gap-2 mt-2" onSubmit={add}>
        <input className="form-control form-control-sm bg-light border-0 todo-input"
               placeholder="添加今天的任务…" maxLength="50"
               value={text} onChange={e => setText(e.target.value)} />
        <button className="btn btn-sm btn-gradient rounded-pill px-3 flex-shrink-0" type="submit">添加</button>
      </form>
    </div>
  )
}
