import React, { useEffect, useState } from 'react'
import { api } from '../api.js'
import PokemonCard from '../components/PokemonCard.jsx'
import WeatherCard from '../components/WeatherCard.jsx'
import WordCard from '../components/WordCard.jsx'
import JapaneseCard from '../components/JapaneseCard.jsx'
import NoteCard from '../components/NoteCard.jsx'

const today = () => new Date().toISOString().slice(0, 10)

const CAT_EMOJI = {
  '餐饮': '🍜', '交通': '🚗', '购物': '🛍️', '娱乐': '🎮', '居住': '🏠',
  '医疗': '💊', '教育': '📚', '其他': '📌',
  '工资': '💼', '兼职': '🛠️', '奖金': '🏆', '红包': '🧧',
  '理财收益': '📈', '其他收入': '💰',
}
const emojiOf = name => CAT_EMOJI[name] || '🏷️'

// 账本首页:只放每日小卡片,汇总/预算/记录条目统一在统计页
export default function Home() {
  const [categories, setCategories] = useState([])
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [form, setForm] = useState({ type: 'expense', amount: '', category_id: null, date: today(), note: '' })

  useEffect(() => { api.listCategories().then(setCategories).catch(() => {}) }, [])

  const openAdd = () => {
    setForm({ type: 'expense', amount: '', category_id: null, date: today(), note: '' })
    setShowRecordModal(true)
  }

  const saveRecord = async () => {
    const body = { ...form, amount: parseFloat(form.amount) }
    if (!body.amount || !body.date || !body.category_id) return alert('请填写完整')
    try {
      await api.addRecord(body)
      setShowRecordModal(false)
    } catch (e) { alert(e.message) }
  }

  const typeCategories = categories.filter(c => c.type === form.type)

  return (
    <div className="stagger d-flex flex-column">
      {/* 天气 / 单词 / 宝可梦 / 随想 / 日语:卡片墙 */}
      <div className="row g-2 align-items-stretch">
        <div className="col-6 d-flex"><WeatherCard /></div>
        <div className="col-6 d-flex"><WordCard /></div>
        <div className="col-6 d-flex"><PokemonCard /></div>
        <div className="col-6 d-flex"><NoteCard /></div>
        <div className="col-6 d-flex"><JapaneseCard /></div>
      </div>

      <button className="fab" onClick={openAdd}>＋</button>

      {/* 记录弹窗 */}
      {showRecordModal && (
        <div className="modal d-block modal-shell" tabIndex="-1" onClick={() => setShowRecordModal(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content p-2">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">✨ 记一笔</h5>
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
    </div>
  )
}
