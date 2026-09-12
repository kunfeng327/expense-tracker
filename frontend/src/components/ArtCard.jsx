import React, { useEffect, useRef, useState } from 'react'

const CACHE_KEY = 'daily-art'
const todayStr = () => new Date().toISOString().slice(0, 10)

// 每天固定一幅:当天第一次打开随机抽一幅馆藏名画,缓存到 localStorage
const loadCached = () => {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY))
    if (c && c.date === todayStr() && c.img) return c
  } catch {}
  return null
}

// 优先取中文维基百科摘要;没有中文条目就用 MyMemory 免费翻译;都失败用馆藏信息兜底
const wikiSummary = async (lang, title) => {
  try {
    const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
    if (res.ok) {
      const w = await res.json()
      if (w.extract) return w.extract
    }
  } catch {}
  return null
}

const translateZh = async text => {
  try {
    const q = text.slice(0, 450) // MyMemory 单次限 500 字符
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=en|zh-CN`)
    if (res.ok) {
      const t = await res.json()
      const out = t?.responseData?.translatedText
      // 翻译失败时服务会原样返回英文,校验一下确实译成了中文
      if (out && /[\u4e00-\u9fff]/.test(out)) return out
    }
  } catch {}
  return null
}

const fetchIntro = async d => {
  const title = d.title || ''
  const zh = await wikiSummary('zh', title)
  if (zh) return zh
  const en = await wikiSummary('en', title)
  if (en) {
    const t = await translateZh(en)
    if (t) return t
    return en
  }
  // 没有百科条目:把馆藏信息(材质/文化/年代)也翻成中文
  const meta = [d.medium, d.period || d.culture, d.objectDate].filter(Boolean).join(' · ')
  if (meta) return (await translateZh(meta)) || meta
  return '馆藏精选画作'
}

// 🖼️ 今日名画:大都会博物馆 API(免费无 key),精选馆藏每天一幅
export default function ArtCard() {
  const [art, setArt] = useState(loadCached)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [showIntro, setShowIntro] = useState(false)
  const [introPending, setIntroPending] = useState(false)
  const fetching = useRef(false)

  const fetchArt = async () => {
    if (fetching.current) return // 防重复请求(含 StrictMode 双挂载)
    fetching.current = true
    setLoading(true)
    setFailed(false)
    try {
      // 先搜"有图 + 精选"的藏品 id 池,再随机挑一个拿详情
      const sres = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isHighlight=true&q=painting')
      const { objectIDs } = await sres.json()
      if (!objectIDs?.length) throw new Error('empty')
      for (let i = 0; i < 5; i++) { // 个别藏品可能没图,最多重试 5 次
        const id = objectIDs[Math.floor(Math.random() * objectIDs.length)]
        const ores = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`)
        const d = await ores.json()
        if (d.primaryImage || d.primaryImageSmall) {
          const item = {
            date: todayStr(),
            img: d.primaryImage || d.primaryImageSmall, // 优先高清大图
            title: d.title || '无题',
            artist: d.artistDisplayName || '佚名',
            year: d.objectDate || '',
          }
          setArt(item)
          localStorage.setItem(CACHE_KEY, JSON.stringify(item))
          // 简介异步补上,不阻塞图片展示;占位文案避免卡片高度跳动
          setIntroPending(true)
          fetchIntro(d).then(intro => {
            item.intro = intro
            setArt({ ...item })
            localStorage.setItem(CACHE_KEY, JSON.stringify(item))
          }).finally(() => setIntroPending(false))
          return
        }
      }
      throw new Error('no image')
    } catch {
      setFailed(true)
    } finally {
      fetching.current = false
      setLoading(false)
    }
  }

  useEffect(() => { if (!art) fetchArt() }, [])

  return (
    <div className="card p-3 w-100 dog-card art-card">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="small text-muted fw-semibold">🖼️ 今日名画</span>
        <button className="btn btn-sm btn-outline-plain rounded-pill px-3" onClick={fetchArt} disabled={loading}>
          {loading ? '寻找中…' : '换一幅'}
        </button>
      </div>

      <div className="dog-body" onClick={fetchArt} title="点击换一幅">
        {failed ? (
          <div className="d-flex flex-column align-items-center justify-content-center flex-grow-1 small text-muted">
            <span style={{ fontSize: 40 }}>🎨</span>
            <div className="mt-2">画框空了,点击再看看</div>
          </div>
        ) : art ? (
          <>
            <div className="dog-img-wrap">
              <img src={art.img} alt={art.title} className="dog-img" />
            </div>
            {/* 文字区在 dog-body 外,点简介展开不会再触发"换一幅" */}
            <div className="small text-muted text-center mt-2 art-caption">
              <div className="fw-semibold art-title">{art.title}</div>
              <div className="amount">{art.artist}{art.year ? ` (${art.year})` : ''}</div>
              {art.intro ? (
                <div className="art-intro"
                     title="点击查看完整简介"
                     onClick={e => { e.stopPropagation(); setShowIntro(true) }}>{art.intro}</div>
              ) : (
                <div className="art-intro art-intro-placeholder">
                  {introPending ? '⏳ 正在获取简介…' : '暂无简介'}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="d-flex align-items-center justify-content-center flex-grow-1 small text-muted">
            {loading ? '正在打开画廊… 🎨' : <span style={{ fontSize: 40 }}>🎨</span>}
          </div>
        )}
      </div>

      {/* 简介浮层:覆盖在卡片内部展示全文,卡片和画作大小不变 */}
      {showIntro && art?.intro && (
        <div className="art-overlay">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="fw-semibold art-title">{art.title}</span>
            <button type="button" className="btn-close" onClick={() => setShowIntro(false)} title="收起简介" />
          </div>
          <div className="text-muted small amount mb-2">{art.artist}{art.year ? ` (${art.year})` : ''}</div>
          <div className="small art-overlay-text">{art.intro}</div>
        </div>
      )}
    </div>
  )
}
