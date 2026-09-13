import React, { useEffect, useState, useRef, useCallback } from 'react'
import * as echarts from 'echarts'
import { api, fmt, monthShift } from '../api.js'
import { getCache, setCache } from '../cache.js'

const PALETTE = ['#6366f1', '#8b5cf6', '#f43f5e', '#f97316', '#10b981', '#0ea5e9', '#eab308', '#ec4899']

const CAT_EMOJI = {
  '餐饮': '🍜', '交通': '🚗', '购物': '🛍️', '娱乐': '🎮', '居住': '🏠',
  '医疗': '💊', '教育': '📚', '其他': '📌',
  '工资': '💼', '兼职': '🛠️', '奖金': '🏆', '红包': '🧧',
  '理财收益': '📈', '其他收入': '💰',
}
const emojiOf = name => CAT_EMOJI[name] || '🏷️'
const today = () => new Date().toISOString().slice(0, 10)

// 统计页:汇总 / 预算 / 图表 / 记录条目统一在这里
export default function Stats() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [stats, setStats] = useState({ summary: { expense: 0, income: 0 }, by_category: [], by_day: [] })
  const [records, setRecords] = useState([])
  const [categories, setCategories] = useState([])
  const [budget, setBudget] = useState({ total: 0, category_budget: {} })
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ type: 'expense', amount: '', category_id: null, date: today(), note: '' })
  const [budgetForm, setBudgetForm] = useState({ total: '', category_budget: {} })
  const pieRef = useRef(null)
  const lineRef = useRef(null)
  const charts = useRef({})

  useEffect(() => {
    charts.current.pie = echarts.init(pieRef.current)
    charts.current.line = echarts.init(lineRef.current)
    const onResize = () => Object.values(charts.current).forEach(c => c.resize())
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); Object.values(charts.current).forEach(c => c.dispose()) }
  }, [])

  const refresh = useCallback(() => {
    api.getStats(month).then(d => { setCache('stats:' + month, d); setStats(d) }).catch(() => {})
    api.listRecords(month).then(d => { setCache('records:' + month, d); setRecords(d) }).catch(() => {})
    api.getBudget(month).then(b => {
      setCache('budget:' + month, b)
      setBudget(b)
      setBudgetForm({ total: b.total || '', category_budget: { ...(b.category_budget || {}) } })
    }).catch(() => {})
  }, [month])
  useEffect(() => { refresh() }, [refresh])
  // 切页/切月回来先秒显缓存的数据,后台刷新到了再无声更新
  useEffect(() => {
    const s = getCache('stats:' + month)
    if (s) setStats(s)
    const r = getCache('records:' + month)
    if (r) setRecords(r)
    const b = getCache('budget:' + month)
    if (b) {
      setBudget(b)
      setBudgetForm({ total: b.total || '', category_budget: { ...(b.category_budget || {}) } })
    }
  }, [month])
  useEffect(() => {
    const c = getCache('categories')
    if (c) setCategories(c)
    api.listCategories().then(d => { setCache('categories', d); setCategories(d) }).catch(() => {})
  }, [])

  useEffect(() => {
    const { pie, line } = charts.current
    if (!pie) return

    pie.setOption({
      color: PALETTE,
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 6, itemWidth: 12, itemHeight: 12, itemGap: 14, textStyle: { fontSize: 13, color: '#64748b' } },
      series: [{
        type: 'pie', radius: ['42%', '68%'],
        center: ['50%', '44%'],
        data: stats.by_category,
        label: { formatter: '{b}\n{d}%', fontSize: 13, color: '#475569', lineHeight: 18 },
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      }],
    })

    line.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 56, right: 24, bottom: 34, top: 26 },
      xAxis: {
        type: 'category', data: stats.by_day.map(d => d.date.slice(8)),
        axisLine: { lineStyle: { color: '#cbd5e1' } }, axisLabel: { color: '#94a3b8', fontSize: 12 },
      },
      yAxis: {
        type: 'value', splitLine: { lineStyle: { color: 'rgba(148,163,184,.15)' } },
        axisLabel: { color: '#94a3b8', fontSize: 12 },
      },
      series: [{
        type: 'line', smooth: true, data: stats.by_day.map(d => d.value),
        symbolSize: 7, lineStyle: { width: 3, color: '#6366f1' }, itemStyle: { color: '#6366f1' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(99,102,241,.28)' },
            { offset: 1, color: 'rgba(99,102,241,0)' },
          ]),
        },
      }],
    })
  }, [stats])

  const { expense, income } = stats.summary
  const expenseCategories = categories.filter(c => c.type === 'expense')
  const pct = budget.total > 0 ? Math.min(100, expense / budget.total * 100) : 0
  const remaining = budget.total - expense

  const openAdd = () => {
    setEditing(null)
    setForm({ type: 'expense', amount: '', category_id: null, date: today(), note: '' })
    setShowRecordModal(true)
  }

  const openEdit = r => {
    setEditing(r)
    setForm({ type: r.type, amount: String(r.amount), category_id: r.category_id, date: r.date, note: r.note || '' })
    setShowRecordModal(true)
  }

  const saveRecord = async () => {
    const body = { ...form, amount: parseFloat(form.amount) }
    if (!body.amount || !body.date || !body.category_id) return alert('请填写完整')
    try {
      if (editing) await api.updateRecord(editing.id, body)
      else await api.addRecord(body)
      setShowRecordModal(false)
      refresh()
    } catch (e) { alert(e.message) }
  }

  const delRecord = async id => {
    if (!confirm('确定删除这条记录吗?')) return
    await api.deleteRecord(id)
    refresh()
  }

  const saveBudget = async () => {
    const category_budget = {}
    Object.entries(budgetForm.category_budget).forEach(([k, v]) => {
      if (v !== '' && v != null) category_budget[k] = parseFloat(v)
    })
    await api.setBudget(month, { total: parseFloat(budgetForm.total || 0), category_budget })
    setShowBudgetModal(false)
    refresh()
  }

  const typeCategories = categories.filter(c => c.type === form.type)

  return (
    <div className="stagger d-flex flex-column">
      <div className="month-nav mb-4">
        <button onClick={() => setMonth(m => monthShift(m, -1))}>‹</button>
        <div className="flex-grow-1 text-center fw-semibold">
          {month.split('-')[0]} 年 {Number(month.split('-')[1])} 月
        </div>
        <button onClick={() => setMonth(m => monthShift(m, 1))}>›</button>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-4"><div className="stat-card stat-expense text-center">
          <div className="label">总支出</div><div className="value amount">{fmt(expense)}</div></div></div>
        <div className="col-4"><div className="stat-card stat-income text-center">
          <div className="label">总收入</div><div className="value amount">{fmt(income)}</div></div></div>
        <div className="col-4"><div className="stat-card stat-balance text-center">
          <div className="label">结余</div><div className="value amount">{fmt(income - expense)}</div></div></div>
      </div>

      {/* 预算 */}
      <div className="card p-3 mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="fw-semibold small">🎯 本月预算</span>
          {budget.total > 0 && (
            <span className="small">
              <span className="text-muted amount">{fmt(expense)} / {fmt(budget.total)}</span>
              <span className={`ms-2 fw-bold ${pct >= 100 ? 'text-danger' : pct >= 80 ? 'text-warning' : 'text-success'}`}>
                {pct.toFixed(0)}%
              </span>
            </span>
          )}
        </div>
        <div className="progress" style={{ height: 10 }}>
          <div className={`progress-bar ${budget.total > 0 ? (pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-success') : ''}`}
               style={{ width: budget.total > 0 ? pct + '%' : '0%' }} />
        </div>
        <div className="d-flex justify-content-between mt-2">
          <span className="small text-muted amount">
            {budget.total > 0
              ? (remaining >= 0 ? `还可花 ${fmt(remaining)}` : `已超支 ${fmt(-remaining)} 😰`)
              : '还没有设置预算,设一个控制开销吧 ✨'}
          </span>
          <a href="#" className="small text-decoration-none" style={{ color: 'var(--primary)' }}
             onClick={e => { e.preventDefault(); setShowBudgetModal(true) }}>{budget.total > 0 ? '调整' : '去设置'}</a>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-md-6">
          <div className="card chart-card h-100">
            <div className="chart-title"><span className="dot" />分类占比</div>
            <div ref={pieRef} style={{ height: 320 }} />
          </div>
        </div>
        <div className="col-md-6">
          <div className="card chart-card h-100">
            <div className="chart-title"><span className="dot" />每日支出趋势</div>
            <div ref={lineRef} style={{ height: 320 }} />
          </div>
        </div>
      </div>

      {/* 记录列表 */}
      <div className="card mb-4" style={{ overflow: 'hidden' }}>
        {records.length ? records.map((r, i) => (
          <div key={r.id} className="record-item" style={{ '--i': i }}>
            <div className={`record-icon ${r.type === 'income' ? 'income' : ''}`}>{emojiOf(r.category)}</div>
            <div className="flex-grow-1 min-w-0">
              <div className="d-flex align-items-center gap-2">
                <span className="fw-semibold">{r.category}</span>
                <span className="small text-muted">{r.date.slice(5)}</span>
              </div>
              {r.note && <div className="small text-muted text-truncate">{r.note}</div>}
            </div>
            <div className="text-end">
              <div className={`fw-bold amount ${r.type === 'expense' ? 'text-danger' : 'text-success'}`}>
                {r.type === 'expense' ? '-' : '+'}{fmt(r.amount)}
              </div>
              <div className="d-flex gap-1 justify-content-end mt-1">
                <button className="btn btn-sm btn-light border-0 p-1 px-2" onClick={() => openEdit(r)}>✏️</button>
                <button className="btn btn-sm btn-light border-0 p-1 px-2" onClick={() => delRecord(r.id)}>🗑️</button>
              </div>
            </div>
          </div>
        )) : (
          <div className="empty-state">
            <span className="emoji">🪄</span>
            本月暂无记录<br />
            <span className="small">点击右下角 ＋ 记一笔吧</span>
          </div>
        )}
      </div>

      <button className="fab" onClick={openAdd}>＋</button>

      {/* 记录新增/编辑弹窗 */}
      {showRecordModal && (
        <div className="modal d-block modal-shell" tabIndex="-1" onClick={() => setShowRecordModal(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content p-2">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">{editing ? '✏️ 编辑记录' : '✨ 记一笔'}</h5>
                <button className="btn-close" onClick={() => setShowRecordModal(false)} /></div>
              <div className="modal-body">
                <div className="d-flex gap-2 mb-3">
                  <button className={`btn w-50 type-btn btn-outline-plain ${form.type === 'expense' ? 'active-expense' : ''}`}
                          onClick={() => setForm(f => ({ ...f, type: 'expense', category_id: null }))}>💸 支出</button>
                  <button className={`btn w-50 type-btn btn-outline-plain ${form.type === 'income' ? 'active-income' : ''}`}
                          onClick={() => setForm(f => ({ ...f, type: 'income', category_id: null }))}>💰 收入</button>
                </div>
                <div className="mb-3">
                  <label className="form-label small text-muted">金额</label>
                  <div className="input-group">
                    <span className="input-group-text border-0 bg-light rounded-start-3 fw-bold">¥</span>
                    <input type="number" step="0.01" min="0.01" className="form-control form-control-lg border-0 bg-light"
                           style={{ borderRadius: '0 .6rem .6rem 0' }}
                           value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label small text-muted">分类</label>
                  <div className="d-flex flex-wrap gap-2">
                    {typeCategories.map(c => (
                      <button key={c.id}
                              className={`cat-chip ${form.category_id === c.id ? 'active' : ''}`}
                              onClick={() => setForm(f => ({ ...f, category_id: c.id }))}>
                        {emojiOf(c.name)} {c.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label small text-muted">日期</label>
                    <input type="date" className="form-control" value={form.date}
                           onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div className="col-6">
                    <label className="form-label small text-muted">备注</label>
                    <input type="text" className="form-control" value={form.note} placeholder="可选"
                           onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer px-3 pb-3">
                <button className="btn btn-light rounded-3 px-4" onClick={() => setShowRecordModal(false)}>取消</button>
                <button className="btn btn-gradient rounded-3 px-4" onClick={saveRecord}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 预算弹窗 */}
      {showBudgetModal && (
        <div className="modal d-block modal-shell" tabIndex="-1" onClick={() => setShowBudgetModal(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content p-2">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">🎯 设置预算 · {month}</h5>
                <button className="btn-close" onClick={() => setShowBudgetModal(false)} /></div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label small text-muted">月度总预算</label>
                  <div className="input-group">
                    <span className="input-group-text border-0 bg-light fw-bold">¥</span>
                    <input type="number" step="0.01" min="0" className="form-control form-control-lg border-0 bg-light"
                           style={{ borderRadius: '0 .6rem .6rem 0' }} placeholder="0 表示不设预算"
                           value={budgetForm.total}
                           onChange={e => setBudgetForm(f => ({ ...f, total: e.target.value }))} />
                  </div>
                </div>
                <label className="form-label small text-muted">分类预算(可选,留空则不限)</label>
                {expenseCategories.map(c => (
                  <div key={c.id} className="input-group input-group-sm mb-2">
                    <span className="input-group-text bg-light border-0" style={{ width: 90 }}>{emojiOf(c.name)} {c.name}</span>
                    <input type="number" step="0.01" min="0" className="form-control bg-light border-0" placeholder="不限"
                           value={budgetForm.category_budget[c.name] ?? ''}
                           onChange={e => setBudgetForm(f => ({
                             ...f, category_budget: { ...f.category_budget, [c.name]: e.target.value },
                           }))} />
                  </div>
                ))}
              </div>
              <div className="modal-footer px-3 pb-3">
                <button className="btn btn-light rounded-3 px-4" onClick={() => setShowBudgetModal(false)}>取消</button>
                <button className="btn btn-gradient rounded-3 px-4" onClick={saveBudget}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
