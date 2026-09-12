import React, { useState } from 'react'
import { LISTENING_SENTENCES } from '../data/listeningSentences.js'

const LAST_KEY = 'last-listening'

// 随机抽一句,且不与最近几句重复(记录最近 8 句的索引)
const pickIndex = exceptIdx => {
  let last = []
  try { last = JSON.parse(localStorage.getItem(LAST_KEY)) || [] } catch {}
  let i = exceptIdx
  for (let tries = 0; tries < 20; tries++) {
    i = Math.floor(Math.random() * LISTENING_SENTENCES.length)
    if (i !== exceptIdx && !last.includes(i)) break
  }
  localStorage.setItem(LAST_KEY, JSON.stringify([...last, i].slice(-8)))
  return i
}

// 挑最自然的英文发音人:Edge 在线自然语音 > Google > Microsoft 本地
const pickVoice = () => {
  const voices = speechSynthesis.getVoices().filter(v => v.lang?.startsWith('en'))
  return voices.find(v => /Natural|Neural/i.test(v.name))
      || voices.find(v => /Google/i.test(v.name))
      || voices.find(v => /Microsoft/i.test(v.name))
      || voices.find(v => /en-US/i.test(v.lang))
}

const speak = sentence => {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(sentence)
  u.lang = 'en-US'
  u.rate = 0.9
  u.pitch = 1
  const voice = pickVoice()
  if (voice) u.voice = voice
  speechSynthesis.speak(u)
}

// 每日英语听力句:长难句听写,先听音猜句,再揭晓英文和中文
export default function ListeningCard() {
  const [idx, setIdx] = useState(() => pickIndex(-1))
  const [revealed, setRevealed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [en, zh] = LISTENING_SENTENCES[idx]

  const roll = () => {
    setIdx(pickIndex(idx))
    setRevealed(false)
  }

  const play = () => {
    speak(en)
    setPlaying(true)
    setTimeout(() => setPlaying(false), 1200)
  }

  // 长句缩小字号,保证卡片高度与同行卡片一致
  const long = en.length > 90

  return (
    <div className="card p-3 w-100 listening-card">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="small text-muted fw-semibold">🎧 每日听力</span>
        <button className="btn btn-sm btn-outline-plain rounded-pill px-3" onClick={roll}>换一句</button>
      </div>

      <div className="word-body" key={en}>
        {revealed ? (
          <>
            <div className="d-flex align-items-start justify-content-center gap-2">
              <span className={`listening-text ${long ? 'long' : ''}`} title={en}>{en}</span>
              <button type="button" className={`word-speak-btn mt-1 ${playing ? 'playing' : ''}`}
                      title="再听一遍" onClick={play}>🔊</button>
            </div>
            <div className="word-meaning" onClick={() => setRevealed(false)} title="点击收起,重新听">
              {zh}
            </div>
          </>
        ) : (
          <div className="d-flex flex-column align-items-center justify-content-center flex-grow-1">
            <button type="button" className={`word-speak-btn listening-big-play ${playing ? 'playing' : ''}`}
                    title="听朗读" onClick={play}>🔊</button>
            <button type="button" className="word-reveal-btn" onClick={() => { setRevealed(true); play() }}>
              👂 听听看,点击揭晓原文和中文
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
