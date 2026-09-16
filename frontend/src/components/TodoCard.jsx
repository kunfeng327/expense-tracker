import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../api'

// 北京时间的今天,与服务端日期判断一致
const todayStr = () => {
  const now = new Date()
  const bj = new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60000)
  return `${bj.getFullYear()}-${String(bj.getMonth() + 1).padStart(2, '0')}-${String(bj.getDate()).padStart(2, '0')}`
}

// 渲染某天的任务条目;readOnly 时不给勾选/删除(历史日期只读)
const renderItem = (t, onToggle, onDel, readOnly) => (
  <div key={t.id} className="todo-item">
    <button type="button"
            className={`todo-check ${t.done ? 'done' : ''}`}
            onClick={readOnly ? undefined : () => onToggle(t)}
            disabled={readOnly}
            title={t.done ? '点击标记未完成' : '点击完成'}>{t.done ? '✓' : ''}</button>
    <span className={`todo-text flex-grow-1 min-w-0 ${t.done ? 'done' : ''}`}
          onClick={readOnly ? undefined : () => onToggle(t)}>{t.text}</span>
    {!readOnly && <button type="button" className="todo-del" onClick={() => onDel(t)} title="删除">✕</button>}
  </div>
)

// 今日任务卡:任务存服务端(按账号+日期),日历可回看每天完成了什么;历史日期只读
export default function TodoCard() {
  const today = todayStr()
  const [tasks, setTasks] = useState([])
  const [text, setText] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [month, setMonth] = useState(today.slice(0, 7))   // 日历当前月
  const [marks, setMarks] = useState({})                   // { '2026-09-16': {total, done} }
  const [viewDate, setViewDate] = useState(null)           // 日历里点开的那天
  const [viewTasks, setViewTasks] = useState([])

  const load = useCallback(() => {
    api.listTodo(today).then(setTasks).catch(() => {})
  }, [today])

  const loadMarks = useCallback(() => {
    api.listTodoMonth(month)
      .then(rows => setMarks(Object.fromEntries(rows.map(r => [r.date, { total: r.total, done: Number(r.done) }]))))
      .catch(() => {})
  }, [month])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadMarks() }, [loadMarks])

  const openDay = d => {
    setViewDate(d)
    setViewTasks([])
    api.listTodo(d).then(setViewTasks).catch(() => {})
  }

  const add = async e => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    try {
      await api.addTodo({ text: t })
      setText('')
      load()
      loadMarks()
    } catch (err) {
      alert('添加失败:' + err.message)
    }
  }
  const toggle = async t => {
    try {
      await api.updateTodo(t.id, { done: !t.done })
      load()
      loadMarks()
    } catch (err) { alert('操作失败:' + err.message) }
  }
  const del = async t => {
    try {
      await api.deleteTodo(t.id)
      load()
      loadMarks()
    } catch (err) { alert('删除失败:' + err.message) }
  }

  const done = tasks.filter(t => t.done).length

  // 日历网格:周一开头的 6×7 格
  const calendarGrid = () => {
    const [y, m] = month.split('-').map(Number)
    const first = new Date(y, m - 1, 1)
    const daysInMonth = new Date(y, m, 0).getDate()
    const lead = (first.getDay() + 6) % 7 // 周一=0
    const cells = []
    for (let i = 0; i < lead; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++)
      cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    return cells
  }
  const shiftMonth = delta => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="card p-3 w-100 todo-card">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="small text-muted fw-semibold">✅ 今日任务</span>
        <div className="d-flex gap-1">
          <button className="btn btn-sm btn-light rounded-pill px-3" onClick={() => { setViewDate(null); setShowModal(true) }}>📅 日历</button>
          <button className="btn btn-sm btn-gradient rounded-pill px-3" onClick={() => { setViewDate(today); setShowModal(true) }}>➕ 加任务</button>
        </div>
      </div>

      {tasks.length > 0 && (
        <div className="progress todo-progress mb-2" style={{ height: 5 }}>
          <div className="progress-bar" role="progressbar"
               style={{ width: `${Math.round(done / tasks.length * 100)}%` }} />
        </div>
      )}

      {tasks.length > 0 ? (
        <div className="todo-list">
          {tasks.slice(0, 4).map(t => renderItem(t, toggle, del, false))}
          {tasks.length > 4 && (
            <div className="small text-muted text-end mt-1" style={{ cursor: 'pointer' }}
                 onClick={() => { setViewDate(today); setShowModal(true) }}>共 {tasks.length} 项,点击管理 ▼</div>
          )}
        </div>
      ) : (
        <div className="todo-list todo-empty small text-muted" style={{ cursor: 'pointer' }}
             onClick={() => { setViewDate(today); setShowModal(true) }}>
          今天还没有任务,点"加任务"添加一个吧~
        </div>
      )}

      <form className="d-flex gap-2 mt-2" onSubmit={add}>
        <input className="form-control form-control-sm bg-light border-0 todo-input"
               placeholder="添加今天的任务…" maxLength="50"
               value={text} onChange={e => setText(e.target.value)} />
        <button className="btn btn-sm btn-gradient rounded-pill px-3 flex-shrink-0" type="submit">添加</button>
      </form>

      {showModal && (
        <div className="modal d-block modal-shell" tabIndex="-1" onClick={() => setShowModal(false)}>
          <div className={`modal-dialog modal-dialog-centered ${viewDate ? '' : 'modal-sm'}`} onClick={e => e.stopPropagation()}>
            <div className="modal-content p-2">
              {viewDate ? (
                <>
                  <div className="modal-header">
                    <h5 className="modal-title fw-bold">✅ {viewDate}{viewDate === today ? ' · 今天' : ''}</h5>
                    <button className="btn-close" onClick={() => setShowModal(false)} /></div>
                  <div className="modal-body">
                    {viewDate === today && (
                      <form className="d-flex gap-2 mb-3" onSubmit={add}>
                        <input className="form-control bg-light border-0 todo-input"
                               placeholder="要做什么…" maxLength="50" autoFocus
                               value={text} onChange={e => setText(e.target.value)} />
                        <button className="btn btn-gradient rounded-3 px-4 flex-shrink-0" type="submit">添加</button>
                      </form>
                    )}
                    {viewTasks.length === 0 && <div className="small text-muted">这一天没有任务记录</div>}
                    <div className="todo-history">
                      {viewTasks.map(t => renderItem(t, toggle, del, viewDate !== today))}
                    </div>
                  </div>
                  <div className="modal-footer px-3 pb-3">
                    <button className="btn btn-light rounded-3 px-4" onClick={() => setViewDate(null)}>📅 返回日历</button>
                    <button className="btn btn-gradient rounded-3 px-4" onClick={() => setShowModal(false)}>关闭</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="modal-header">
                    <h5 className="modal-title fw-bold">📅 任务日历</h5>
                    <button className="btn-close" onClick={() => setShowModal(false)} /></div>
                  <div className="modal-body todo-cal-modal">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <button className="btn btn-sm btn-light px-3" onClick={() => shiftMonth(-1)}>‹</button>
                      <span className="fw-semibold">{month}</span>
                      <button className="btn btn-sm btn-light px-3" onClick={() => shiftMonth(1)}>›</button>
                    </div>
                    <div className="todo-calendar">
                      {calendarGrid().map((d, i) => {
                        if (!d) return <div key={`e${i}`} />
                        const mk = marks[d]
                        const allDone = mk && mk.done >= mk.total
                        return (
                          <button key={d} type="button"
                                  className={`todo-cal-day ${d === today ? 'today' : ''} ${mk ? (allDone ? 'has-all' : 'has-some') : ''}`}
                                  onClick={() => openDay(d)} title={mk ? `${mk.done}/${mk.total} 完成` : '无任务'}>
                            {Number(d.slice(8))}
                          </button>
                        )
                      })}
                    </div>
                    <div className="small text-muted mt-2 text-center">紫点 = 有任务 · 绿点 = 全部完成</div>
                  </div>
                  <div className="modal-footer px-3 pb-3">
                    <button className="btn btn-gradient rounded-3 px-4" onClick={() => setShowModal(false)}>关闭</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
