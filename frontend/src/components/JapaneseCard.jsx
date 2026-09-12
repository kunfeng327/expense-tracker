import React, { useState, useCallback } from 'react'
import { GOJUON, JP_WORDS } from '../data/jpData.js'

const rand = arr => arr[Math.floor(Math.random() * arr.length)]

// 小绿鸟(多邻国风),点了会开心地跳一下
const GreenBird = ({ excited }) => (
  <svg className={`jp-bird ${excited ? 'talking' : ''}`} viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
    {/* 尾巴 */}
    <path d="M8 38 L2 44 L10 44 Z" fill="#2e7d32" />
    {/* 身体 */}
    <ellipse cx="32" cy="34" rx="24" ry="22" fill="#58cc02" />
    {/* 肚子 */}
    <ellipse cx="32" cy="42" rx="14" ry="11" fill="#89e219" />
    {/* 翅膀 */}
    <ellipse className="jp-wing" cx="12" cy="34" rx="7" ry="10" fill="#4caf00" transform="rotate(15 12 34)" />
    {/* 眼白 */}
    <circle cx="26" cy="24" r="8" fill="#fff" />
    <circle cx="42" cy="24" r="8" fill="#fff" />
    {/* 瞳孔 */}
    <circle className="jp-eye" cx="27" cy="25" r="3.5" fill="#1e293b" />
    <circle className="jp-eye" cx="43" cy="25" r="3.5" fill="#1e293b" />
    {/* 高光 */}
    <circle cx="28.2" cy="23.6" r="1.2" fill="#fff" />
    <circle cx="44.2" cy="23.6" r="1.2" fill="#fff" />
    {/* 嘴 */}
    <path className="jp-beak-top" d="M28 32 L36 32 L32 38 Z" fill="#ffc800" />
    <path className="jp-beak-bottom" d="M29 36 L35 36 L32 41 Z" fill="#e6a800" />
    {/* 头顶呆毛 */}
    <path d="M30 12 Q32 6 36 10 Q33 10 34 14 Z" fill="#58cc02" />
  </svg>
)

// 日语学习卡:五十音图 + N5 单词,配小绿鸟
export default function JapaneseCard() {
  const [mode, setMode] = useState('kana') // kana | word
  const [kana, setKana] = useState(() => rand(GOJUON))
  const [word, setWord] = useState(() => rand(JP_WORDS))
  const [revealed, setRevealed] = useState(false)
  const [excited, setExcited] = useState(false)

  const pat = useCallback(() => {
    setExcited(true)
    setTimeout(() => setExcited(false), 900)
  }, [])

  const roll = useCallback(() => {
    if (mode === 'kana') {
      let next = kana
      while (next === kana) next = rand(GOJUON)
      setKana(next)
    } else {
      let next = word
      while (next === word) next = rand(JP_WORDS)
      setWord(next)
    }
    setRevealed(false)
  }, [mode, kana, word])

  const switchMode = m => { setMode(m); setRevealed(false) }

  return (
    <div className="card p-3 w-100 jp-card">
      <div className="d-flex justify-content-between align-items-center">
        <span className="small text-muted fw-semibold">🇯🇵 日语打卡</span>
        <div className="btn-group btn-group-sm">
          <button className={`btn ${mode === 'kana' ? 'btn-success' : 'btn-outline-success'}`}
                  onClick={() => switchMode('kana')}>五十音</button>
          <button className={`btn ${mode === 'word' ? 'btn-success' : 'btn-outline-success'}`}
                  onClick={() => switchMode('word')}>单词</button>
        </div>
      </div>

      <div className="d-flex align-items-center gap-3">
        {/* 小绿鸟:点一下会开心地跳 */}
        <button type="button" className="jp-bird-btn" title="摸摸小鸟" onClick={pat}>
          <GreenBird excited={excited} />
        </button>

        <div className="flex-grow-1 min-w-0">
          {mode === 'kana' ? (
            <>
              <div className="d-flex align-items-baseline gap-2 flex-wrap">
                <span className="fw-bold jp-kana">{kana[0]}</span>
                <span className="text-muted jp-kana-sm">{kana[1]}</span>
              </div>
              {/* 揭晓区固定高度,揭晓前后假名位置不动 */}
              <div className="jp-slot">
                {revealed
                  ? <div className="word-meaning" onClick={() => setRevealed(false)}>{kana[2]}</div>
                  : <button type="button" className="word-reveal-btn" onClick={() => { setRevealed(true); pat() }}>
                      👀 猜猜罗马音,点击揭晓
                    </button>}
              </div>
            </>
          ) : (
            <>
              <div className="d-flex align-items-baseline gap-2 flex-wrap">
                <span className="fw-bold jp-word">{word[0]}</span>
                <span className="small text-muted amount">{word[1]}</span>
              </div>
              <div className="jp-slot">
                {revealed
                  ? <div className="word-meaning" onClick={() => setRevealed(false)}>{word[2]}</div>
                  : <button type="button" className="word-reveal-btn" onClick={() => { setRevealed(true); pat() }}>
                      👀 猜猜意思,点击揭晓
                    </button>}
              </div>
            </>
          )}
        </div>
      </div>

      <button className="btn btn-sm btn-outline-success rounded-pill px-3 jp-roll align-self-center" onClick={roll}>换一个</button>
    </div>
  )
}
