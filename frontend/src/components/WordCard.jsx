import React, { useState, useCallback } from 'react'
import { KAOYAN_WORDS } from '../data/kaoyanWords.js'

// 用 Web Speech API 朗读单词(免费、离线可用),优先选英文发音人
const speak = word => {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(word)
  u.lang = 'en-US'
  u.rate = 0.85
  const voice = speechSynthesis.getVoices().find(v => v.lang?.startsWith('en') && /Google|Natural|Microsoft/i.test(v.name))
  if (voice) u.voice = voice
  speechSynthesis.speak(u)
}

// 考研英语单词卡:随机抽词,可朗读、可换词,释义先隐藏再揭晓
export default function WordCard() {
  const [entry, setEntry] = useState(() => KAOYAN_WORDS[Math.floor(Math.random() * KAOYAN_WORDS.length)])
  const [revealed, setRevealed] = useState(false)
  const [playing, setPlaying] = useState(false)

  const roll = useCallback(() => {
    let next = entry
    while (next === entry && KAOYAN_WORDS.length > 1)
      next = KAOYAN_WORDS[Math.floor(Math.random() * KAOYAN_WORDS.length)]
    setEntry(next)
    setRevealed(false)
  }, [entry])

  const play = () => {
    speak(entry[0])
    setPlaying(true)
    setTimeout(() => setPlaying(false), 900)
  }

  return (
    <div className="card p-3 w-100 word-card">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="small text-muted fw-semibold">📚 今日单词</span>
        <button className="btn btn-sm btn-outline-plain rounded-pill px-3" onClick={roll}>换一个</button>
      </div>

      <div className="word-body" key={entry[0]}>
        <div className="d-flex align-items-center justify-content-center gap-2">
          <span className="fw-bold word-text">{entry[0]}</span>
          <button type="button" className={`word-speak-btn ${playing ? 'playing' : ''}`}
                  title="听发音" onClick={play}>🔊</button>
        </div>
        <div className="text-center text-muted small mt-1 amount">{entry[1]}</div>

        {revealed ? (
          <div className="word-meaning" onClick={() => setRevealed(false)} title="点击收起">
            {entry[2]}
          </div>
        ) : (
          <button type="button" className="word-reveal-btn" onClick={() => { setRevealed(true); play() }}>
            👀 想想意思,点击揭晓
          </button>
        )}
      </div>
    </div>
  )
}
