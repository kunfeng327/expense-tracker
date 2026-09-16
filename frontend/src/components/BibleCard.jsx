import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { BIBLE_CHAPTERS } from '../data/bibleChapters.js'

// 按当年第几天挑"今日金句"的序号(章节本身由服务端进度决定)
const dayOfYear = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  return Math.floor((now - start) / 86400000)
}

// 书卷名 → getbible.net 书卷编号(和合本简体 cus)
// 兼容旧数据里的繁体名,进度表里历史记录也能正确取章
const BOOKS = {
  '诗篇': 19, '詩篇': 19,
  '箴言': 20, '箴言': 20,
  '传道书': 21, '傳道書': 21,
  '马太福音': 40, '馬太福音': 40,
  '约翰福音': 43, '約翰福音': 43,
}

// 从 getbible.net 拉整章和合本简体(cus,公有领域,支持 CORS);按天缓存
// 拉不到(离线/接口变动)就回退本地精选章,卡片永远有内容
const fetchChapter = async (book, chapterNum) => {
  const bookNo = BOOKS[book] || 19
  const apiRef = `${book} ${chapterNum}`
  const cacheKey = `bible-${new Date().toISOString().slice(0, 10)}-${apiRef}`
  try {
    const hit = JSON.parse(localStorage.getItem(cacheKey))
    if (hit && Array.isArray(hit.verses) && hit.verses.length) return hit
  } catch { /* 缓存损坏则重新拉 */ }
  const res = await fetch(`https://api.getbible.net/v2/cus/${bookNo}/${chapterNum}.json`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  const d = await res.json()
  const verses = (d.verses || []).map(v => v.text.trim())
  if (!verses.length) throw new Error('空章节')
  const chapter = { ref: apiRef, verses }
  try { localStorage.setItem(cacheKey, JSON.stringify(chapter)) } catch { /* 缓存失败不影响使用 */ }
  return chapter
}

// 本地兜底章(离线时按天轮换)
const localFallback = () => BIBLE_CHAPTERS[dayOfYear() % BIBLE_CHAPTERS.length]

// 每日读圣经卡:章节由账号的阅读进度决定(服务端记录),读完点"读完了"推进到下一章
export default function BibleCard() {
  const day = dayOfYear()
  const [chapter, setChapter] = useState(localFallback)
  const [progress, setProgress] = useState(null) // { book, chapter, doneToday }
  const [showModal, setShowModal] = useState(false)

  // 拉进度并按进度加载章节;进度接口失败(未登录/离线)则用本地兜底
  useEffect(() => {
    api.getBibleProgress()
      .then(p => {
        setProgress(p)
        return fetchChapter(p.book, p.chapter)
      })
      .then(setChapter)
      .catch(() => {})
  }, [])

  const verseIdx = day % chapter.verses.length

  // 读完关闭:点 X / 遮罩 / 关闭按钮都算"读完",静默推进到下一章(每天一次)
  const closeAsDone = () => {
    setShowModal(false)
    if (progress && !progress.doneToday) {
      api.bibleDone()
        .then(p => {
          setProgress(prev => ({ ...prev, book: p.book, chapter: p.chapter, doneToday: true }))
          return fetchChapter(p.book, p.chapter)
        })
        .then(setChapter)
        .catch(() => {}) // 推进失败不打扰,下次打开再试
    }
  }

  // 暂时不读了:关闭但不推进进度
  const closeOnly = () => setShowModal(false)


  return (
    <div className="card p-3 w-100 bible-card" onClick={() => setShowModal(true)} title="点击查看全章">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="small text-muted fw-semibold">📖 每日读圣经</span>
        <span className="small text-muted">
          {progress ? `${progress.book} ${progress.chapter}` : chapter.ref} ▼
        </span>
      </div>

      <div className="bible-today-verse">
        <p className="bible-verse-text mb-1">
          <sup className="bible-verse-no">{verseIdx + 1}</sup> {chapter.verses[verseIdx]}
        </p>
        <div className="small text-muted text-center">
          {progress ? `${progress.book} ${progress.chapter} · 点击查看全章` : `${chapter.ref} · 点击查看全章`}
        </div>
      </div>

      {showModal && (
        <div className="modal d-block modal-shell" tabIndex="-1" onClick={closeAsDone}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" onClick={e => e.stopPropagation()}>
            <div className="modal-content p-2">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">📖 {progress ? `${progress.book} ${progress.chapter}` : chapter.ref}</h5>
                <button className="btn-close" onClick={closeAsDone} /></div>
              <div className="modal-body art-overlay-text">
                {chapter.verses.map((v, i) => (
                  <p key={i} className={`mb-1 ${i === verseIdx ? 'bible-today' : ''}`}>
                    <sup className="bible-verse-no">{i + 1}</sup> {v}
                  </p>
                ))}
              </div>
              <div className="modal-footer px-3 pb-3">
                <button className="btn btn-light rounded-3 px-4" onClick={closeOnly}>稍后再读</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
