import React, { useEffect, useState, useCallback } from 'react'
import { api, fmt, monthShift } from '../api.js'
import PokemonCard from '../components/PokemonCard.jsx'

const today = () => new Date().toISOString().slice(0, 10)

const CAT_EMOJI = {
  '餐饮': '🍜', '交通': '🚗', '购物': '🛍️', '娱乐': '🎮', '居住': '🏠',
  '医疗': '💊', '教育': '📚', '其他': '📌',
  '工资': '💼', '兼职': '🛠️', '奖金': '🏆', '红包': '🧧',
  '理财收益': '📈', '其他收入': '💰',
}
const emojiOf = name => CAT_EMOJI[name] || '🏷️'

export default function Home() {
  const [month, setMonth] = useState(today().slice(0, 7))
  const [categories, setCategories] = useState([])
  const [records, setRecords] = useState([])
  const [budget, setBudget] = useState({ total: 0, category_budget: {} })
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ type: 'expense', amount: '', category_id: null, date: today(), note: '' })
  const [budgetForm, setBudgetForm] = useState({ total: '', category_budget: {} })

  const loadCategories = useCallback(async () => setCategories(await api.listCategories()), [])
  const loadRecords = useCallback(async () => setRecords(await api.listRecords(month)), [month])
  const loadBudget = useCallback(async () => {
    const b = await api.getBudget(month)
    setBudget(b)
    setBudgetForm({ total: b.total || '', category_budget: { ...(b.category_budget || {}) } })
  }, [month])

  useEffect(() => { loadCategories() }, [])
  useEffect(() => { loadRecords(); loadBudget() }, [loadRecords, loadBudget])

  const expense = records.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0)
  const income = records.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0)

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
      loadRecords()
    } catch (e) { alert(e.message) }
  }

  const delRecord = async id => {
    if (!confirm('确定删除这条记录吗?')) return
    await api.deleteRecord(id)
    loadRecords()
  }

  const saveBudget = async () => {
    const category_budget = {}
    Object.entries(budgetForm.category_budget).forEach(([k, v]) => {
      if (v !== '' && v != null) category_budget[k] = parseFloat(v)
    })
    await api.setBudget(month, { total: parseFloat(budgetForm.total || 0), category_budget })
    setShowBudgetModal(false)
    loadBudget()
  }

  const typeCategories = categories.filter(c => c.type === form.type)
  const expenseCategories = categories.filter(c => c.type === 'expense')
  const pct = budget.total > 0 ? Math.min(100, expense / budget.total * 100) : 0
  const remaining = budget.total - expense

  return (
    <div className="stagger d-flex flex-column">
      {/* 月份切换 */}
      <div className="month-nav mb-4">
        <button onClick={() => setMonth(m => monthShift(m, -1))}>‹</button>
        <div className="flex-grow-1 text-center fw-semibold">
          {month.split('-')[0]} 年 {Number(month.split('-')[1])} 月
        </div>
        <button onClick={() => setMonth(m => monthShift(m, 1))}>›</button>
      </div>

      {/* 汇总 */}
      <div className="row g-2 mb-3">
        <div className="col-4"><div className="stat-card stat-expense text-center">
          <div className="label">支出</div><div className="value amount">{fmt(expense)}</div></div></div>
        <div className="col-4"><div className="stat-card stat-income text-center">
          <div className="label">收入</div><div className="value amount">{fmt(income)}</div></div></div>
        <div className="col-4"><div className="stat-card stat-balance text-center">
          <div className="label">结余</div><div className="value amount">{fmt(income - expense)}</div></div></div>
      </div>

      {/* 预算 */}
      {budget.total > 0 ? (
        <div className="card p-3 mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="fw-semibold small">🎯 本月预算</span>
            <span className="small">
              <span className="text-muted amount">{fmt(expense)} / {fmt(budget.total)}</span>
              <span className={`ms-2 fw-bold ${pct >= 100 ? 'text-danger' : pct >= 80 ? 'text-warning' : 'text-success'}`}>
                {pct.toFixed(0)}%
              </span>
            </span>
          </div>
          <div className="progress" style={{ height: 10 }}>
            <div className={`progress-bar ${pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-success'}`}
                 style={{ width: pct + '%' }} />
          </div>
          <div className="d-flex justify-content-between mt-2">
            <span className="small text-muted amount">
              {remaining >= 0 ? `还可花 ${fmt(remaining)}` : `已超支 ${fmt(-remaining)} 😰`}
            </span>
            <a href="#" className="small text-decoration-none" style={{ color: 'var(--primary)' }}
               onClick={e => { e.preventDefault(); setShowBudgetModal(true) }}>调整</a>
          </div>
        </div>
      ) : (
        <a href="#" className="d-block small text-end mb-3 text-decoration-none"
           style={{ color: 'var(--primary)' }}
           onClick={e => { e.preventDefault(); setShowBudgetModal(true) }}>🎯 设置本月预算</a>
      )}

      {/* 随机宝可梦彩蛋 */}
      <PokemonCard />

      {/* 记录列表 */}
      <div className="card" style={{ overflow: 'hidden' }}>
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

      {/* 记录弹窗 */}
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
