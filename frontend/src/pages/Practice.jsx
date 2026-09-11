import React, { useEffect, useState, useCallback } from 'react'
import { api } from '../api.js'

const today = () => new Date().toISOString().slice(0, 10)

const INSTRUMENTS = [
  { value: 'guitar', label: '🎸 吉他' },
  { value: 'piano', label: '🎹 钢琴' },
]
const KINDS = [
  { value: 'spider', label: '🕸️ 爬格子', hint: '半音阶 / 蜘蛛练习' },
  { value: 'scale', label: '🎵 音阶', hint: '大小调音阶 / 琶音 / 哈农' },
  { value: 'song', label: '🎼 曲目', hint: '在练的曲子' },
  { value: 'technique', label: '💪 技巧', hint: '击勾滑弦 / 轮指 / 和弦转换' },
]
const INSTRUMENT_LABEL = { guitar: '🎸', piano: '🎹' }
const KIND_LABEL = { spider: '爬格子', scale: '音阶', song: '曲目', technique: '技巧' }

// 吉他 / 钢琴练习记录:BPM、爬格子、音阶、曲目、技巧
export default function Practice() {
  const [logs, setLogs] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    instrument: 'guitar', kind: 'spider', bpm: '', minutes: '', date: today(), note: '',
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => setLogs(await api.listPractice()), [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await api.addPractice(form)
      setShowModal(false)
      load()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const del = async id => {
    if (!confirm('删除这条练习记录吗?')) return
    await api.deletePractice(id)
    load()
  }

  // 本周小结:总时长、总次数、各类型分布
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6)
  const weekLogs = (logs || []).filter(l => new Date(l.date) >= weekStart)
  const weekMinutes = weekLogs.reduce((s, l) => s + l.minutes, 0)
  const kindCount = {}
  weekLogs.forEach(l => { kindCount[l.kind] = (kindCount[l.kind] || 0) + 1 })
  const streak = (() => {
    const days = new Set((logs || []).map(l => l.date.slice(0, 10)))
    let n = 0, d = new Date()
    while (days.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1) }
    return n
  })()

  // 按日期分组
  const groups = {}
  ;(logs || []).forEach(l => { (groups[l.date.slice(0, 10)] ||= []).push(l) })
  const groupKeys = Object.keys(groups).sort().reverse()

  return (
    <div className="stagger d-flex flex-column">
      {/* 本周小结 */}
      <div className="row g-2 mb-3">
        <div className="col-4"><div className="stat-card stat-income text-center">
          <div className="label">本周练习</div><div className="value">{weekMinutes} 分钟</div></div></div>
        <div className="col-4"><div className="stat-card stat-balance text-center">
          <div className="label">连续打卡</div><div className="value">{streak} 天 🔥</div></div></div>
        <div className="col-4"><div className="stat-card stat-expense text-center">
          <div className="label">本周次数</div><div className="value">{weekLogs.length} 次</div></div></div>
      </div>

      {weekLogs.length > 0 && (
        <div className="card p-3 mb-3">
          <div className="small text-muted fw-semibold mb-2">📈 本周都练了啥</div>
          <div className="d-flex flex-wrap gap-2">
            {KINDS.map(k => kindCount[k.value] && (
              <span key={k.value} className="poke-type-badge" style={{ background: 'var(--primary)' }}>
                {k.label} × {kindCount[k.value]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 记录列表 */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {logs === null ? (
          <div className="text-center py-5 text-muted small">加载中…</div>
        ) : groupKeys.length ? groupKeys.map(d => (
          <div key={d}>
            <div className="practice-date">{d.slice(5)} · 共 {groups[d].reduce((s, l) => s + l.minutes, 0)} 分钟</div>
            {groups[d].map(l => (
              <div key={l.id} className="record-item">
                <div className="record-icon">{INSTRUMENT_LABEL[l.instrument]}</div>
                <div className="flex-grow-1 min-w-0">
                  <div className="d-flex align-items-center gap-2">
                    <span className="fw-semibold">{KIND_LABEL[l.kind]}</span>
                    {l.bpm && <span className="practice-bpm">♩ {l.bpm} BPM</span>}
                  </div>
                  {l.note && <div className="small text-muted text-truncate">{l.note}</div>}
                </div>
                <div className="text-end">
                  <div className="fw-bold amount">{l.minutes} min</div>
                  <button className="btn btn-sm btn-light border-0 p-1 px-2 mt-1" onClick={() => del(l.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )) : (
          <div className="empty-state">
            <span className="emoji">🎸</span>
            还没有练习记录<br />
            <span className="small">点击右下角 ＋ 记一次练习</span>
          </div>
        )}
      </div>

      <button className="fab" onClick={() => { setForm({ instrument: 'guitar', kind: 'spider', bpm: '', minutes: '', date: today(), note: '' }); setShowModal(true) }}>＋</button>

      {showModal && (
        <div className="modal d-block modal-shell" tabIndex="-1" onClick={() => setShowModal(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content p-2">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">🎸 记一次练习</h5>
                <button className="btn-close" onClick={() => setShowModal(false)} /></div>
              <div className="modal-body">
                <div className="d-flex gap-2 mb-3">
                  {INSTRUMENTS.map(i => (
                    <button key={i.value}
                            className={`btn w-50 type-btn btn-outline-plain ${form.instrument === i.value ? (i.value === 'guitar' ? 'active-expense' : 'active-income') : ''}`}
                            onClick={() => setForm(f => ({ ...f, instrument: i.value }))}>{i.label}</button>
                  ))}
                </div>

                <label className="form-label small text-muted">练习内容</label>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {KINDS.map(k => (
                    <button key={k.value}
                            className={`cat-chip ${form.kind === k.value ? 'active' : ''}`}
                            title={k.hint}
                            onClick={() => setForm(f => ({ ...f, kind: k.value }))}>{k.label}</button>
                  ))}
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label small text-muted">♩ BPM(可选)</label>
                    <input type="number" min="20" max="400" className="form-control" placeholder="如 80"
                           value={form.bpm} onChange={e => setForm(f => ({ ...f, bpm: e.target.value }))} />
                  </div>
                  <div className="col-6">
                    <label className="form-label small text-muted">时长(分钟)</label>
                    <input type="number" min="1" max="1440" className="form-control" placeholder="如 30"
                           value={form.minutes} onChange={e => setForm(f => ({ ...f, minutes: e.target.value }))} />
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label small text-muted">日期</label>
                    <input type="date" className="form-control" value={form.date}
                           onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div className="col-6">
                    <label className="form-label small text-muted">备注(可选)</label>
                    <input type="text" className="form-control" placeholder="如 C 大调两个八度"
                           value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer px-3 pb-3">
                <button className="btn btn-light rounded-3 px-4" onClick={() => setShowModal(false)}>取消</button>
                <button className="btn btn-gradient rounded-3 px-4" disabled={saving} onClick={save}>
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
