import React, { useState } from 'react'
import { BIBLE_CHAPTERS } from '../data/bibleChapters.js'

// 按当年第几天轮换章节,同一天内容固定,人人一致
const dayOfYear = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  return Math.floor((now - start) / 86400000)
}

// 每日读圣经卡:默认只显示今日金句,点击卡片展开整章经文
export default function BibleCard() {
  const [expanded, setExpanded] = useState(false)
  const day = dayOfYear()
  const chapter = BIBLE_CHAPTERS[day % BIBLE_CHAPTERS.length]
  const verseIdx = day % chapter.verses.length

  return (
    <div
      className={`card p-3 w-100 bible-card ${expanded ? 'expanded' : ''}`}
      onClick={() => setExpanded(v => !v)}
      title={expanded ? '点击收起' : '点击查看全章'}
    >
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="small text-muted fw-semibold">📖 每日读圣经 · {chapter.ref}</span>
        <span className="bible-hint small text-muted">{expanded ? '收起 ▲' : '全章 ▼'}</span>
      </div>

      {expanded ? (
        <div className="bible-full art-overlay-text">
          {chapter.verses.map((v, i) => (
            <p key={i} className={`mb-1 ${i === verseIdx ? 'bible-today' : ''}`}>
              <sup className="bible-verse-no">{i + 1}</sup> {v}
            </p>
          ))}
        </div>
      ) : (
        <div className="bible-today-verse">
          <p className="bible-verse-text mb-1">
            <sup className="bible-verse-no">{verseIdx + 1}</sup> {chapter.verses[verseIdx]}
          </p>
          <div className="small text-muted text-center">{chapter.ref}</div>
        </div>
      )}
    </div>
  )
}
