import React, { useEffect, useState, useCallback, useRef } from 'react'

// 属性 → 颜色(参考宝可梦官方属性色)
const TYPE_COLORS = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
  grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
  ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
  steel: '#B7B7CE', fairy: '#D685AD',
}

// 一代 151 只的名字(本地兜底,API 连不上时也能玩)
const GEN1_NAMES = [
  'bulbasaur', 'ivysaur', 'venusaur', 'charmander', 'charmeleon', 'charizard',
  'squirtle', 'wartortle', 'blastoise', 'caterpie', 'metapod', 'butterfree',
  'weedle', 'kakuna', 'beedrill', 'pidgey', 'pidgeotto', 'pidgeot',
  'rattata', 'raticate', 'spearow', 'fearow', 'ekans', 'arbok',
  'pikachu', 'raichu', 'sandshrew', 'sandslash', 'nidoran-f', 'nidorina',
  'nidoqueen', 'nidoran-m', 'nidorino', 'nidoking', 'clefairy', 'clefable',
  'vulpix', 'ninetales', 'jigglypuff', 'wigglytuff', 'zubat', 'golbat',
  'oddish', 'gloom', 'vileplume', 'paras', 'parasect', 'venonat',
  'venomoth', 'diglett', 'dugtrio', 'meowth', 'persian', 'psyduck',
  'golduck', 'mankey', 'primeape', 'growlithe', 'arcanine', 'poliwag',
  'poliwhirl', 'poliwrath', 'abra', 'kadabra', 'alakazam', 'machop',
  'machoke', 'machamp', 'bellsprout', 'weepinbell', 'victreebel', 'tentacool',
  'tentacruel', 'geodude', 'graveler', 'golem', 'ponyta', 'rapidash',
  'slowpoke', 'slowbro', 'magnemite', 'magneton', 'farfetched', 'doduo',
  'dodrio', 'seel', 'dewgong', 'grimer', 'muk', 'shellder', 'cloyster',
  'gastly', 'haunter', 'gengar', 'onix', 'drowzee', 'hypno', 'krabby',
  'kingler', 'voltorb', 'electrode', 'exeggcute', 'exeggutor', 'cubone',
  'marowak', 'hitmonlee', 'hitmonchan', 'lickitung', 'koffing', 'weezing',
  'rhyhorn', 'rhydon', 'chansey', 'tangela', 'kangaskhan', 'horsea',
  'seadra', 'goldeen', 'seaking', 'staryu', 'starmie', 'mr-mime',
  'scyther', 'jynx', 'electabuzz', 'magmar', 'pinsir', 'tauros',
  'magikarp', 'gyarados', 'lapras', 'ditto', 'eevee', 'vaporeon',
  'jolteon', 'flareon', 'porygon', 'omanyte', 'omastar', 'kabuto',
  'kabutops', 'aerodactyl', 'snorlax', 'dragonite', 'dragonair', 'dragonite',
  'mewtwo', 'mew',
]

// CDN 上的图片和叫声(和 API 不同的域名,连不上时换路走)
const cdnArtwork = id => `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/${id}.png`
const cdnCry = id => `https://cdn.jsdelivr.net/gh/PokeAPI/cries@main/cries/pokemon/latest/${id}.ogg`

// 带超时的 fetch,超时或失败自动重试
const fetchWithRetry = async (url, { timeout = 5000, retries = 1 } = {}) => {
  for (let i = 0; i <= retries; i++) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeout)
      const res = await fetch(url, { signal: ctrl.signal })
      clearTimeout(timer)
      if (res.ok) return res
    } catch { /* 重试 */ }
  }
  throw new Error('network')
}

// 从 PokéAPI 随机抽一只宝可梦展示,可切换异色、听叫声、点击换一只
export default function PokemonCard() {
  const [pokemon, setPokemon] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [shiny, setShiny] = useState(false)
  const audioRef = useRef(null)

  const roll = useCallback(async () => {
    setLoading(true)
    setError(false)
    setShiny(false)
    const id = Math.floor(Math.random() * 1025) + 1
    try {
      const res = await fetchWithRetry(`https://pokeapi.co/api/v2/pokemon/${id}`)
      const d = await res.json()
      setPokemon({
        id: d.id, name: d.name,
        artwork: d.sprites?.other?.['official-artwork'],
        sprite: d.sprites,
        types: d.types.map(t => t.type.name),
        height: (d.height / 10).toFixed(1),
        weight: (d.weight / 10).toFixed(1),
        cry: d.cries?.latest || d.cries?.legacy,
      })
    } catch {
      // API 连不上:用本地一代数据 + jsDelivr CDN 兜底
      const fid = Math.floor(Math.random() * GEN1_NAMES.length) + 1
      setPokemon({
        id: fid, name: GEN1_NAMES[fid - 1] || `No.${fid}`,
        artwork: { front_default: cdnArtwork(fid) },
        sprite: null, types: [], height: null, weight: null,
        cry: cdnCry(fid),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { roll() }, [roll])

  // 官方原画优先,异色/普通/像素图依次回退
  const image = pokemon && (
    (shiny ? pokemon.artwork?.front_shiny : pokemon.artwork?.front_default) ||
    (shiny ? pokemon.sprite?.front_shiny : pokemon.sprite?.front_default)
  )
  const hasShiny = !!(pokemon?.artwork?.front_shiny || pokemon?.sprite?.front_shiny)
  const typeColor = pokemon ? (TYPE_COLORS[pokemon.types[0]] || '#888') : '#888'

  const playCry = () => {
    if (!pokemon?.cry) return
    if (audioRef.current) audioRef.current.pause()
    audioRef.current = new Audio(pokemon.cry)
    audioRef.current.play().catch(() => {})
  }

  return (
    <div className="card p-3 w-100 poke-card" style={{ '--type-color': typeColor }}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="small text-muted fw-semibold">🎲 今日偶遇</span>
        <button className="btn btn-sm btn-outline-plain rounded-pill px-3" onClick={roll}>换一只</button>
      </div>

      {loading ? (
        <div className="flex-grow-1 d-flex align-items-center justify-content-center small text-muted">正在草丛里寻找…</div>
      ) : (
        <div className="d-flex flex-column align-items-center">
          {/* 圆形属性色光环 + 官方原画 */}
          <div className="poke-orb position-relative">
            {image
              ? <img src={image} alt={pokemon.name} className="poke-img" />
              : <span style={{ fontSize: 48 }} className="text-muted">?</span>}
            {hasShiny && (
              <button type="button" className={`poke-shiny-btn ${shiny ? 'on' : ''}`}
                      title={shiny ? '切回普通形态' : '看看异色(闪光)形态'}
                      aria-pressed={shiny} onClick={() => setShiny(v => !v)}>✨</button>
            )}
          </div>

          <div className="d-flex align-items-center gap-2 mt-2">
            <span className="fw-bold text-capitalize" style={{ fontSize: '1.15rem' }}>{pokemon.name}</span>
            {pokemon.cry && (
              <button type="button" className="poke-cry-btn" title="听叫声" onClick={playCry}>🔊</button>
            )}
          </div>
          <div className="small text-muted mb-2">No.{String(pokemon.id).padStart(4, '0')}</div>

          <div className="d-flex gap-2 mb-2">
            {pokemon.types.length
              ? pokemon.types.map(t => (
                  <span key={t} className="poke-type-badge text-capitalize"
                        style={{ background: TYPE_COLORS[t] || '#888' }}>{t}</span>
                ))
              : <span className="poke-type-badge" style={{ background: '#94a3b8' }}>type ??</span>}
          </div>

          {pokemon.height && (
            <div className="small text-muted">
              身高 {pokemon.height} m · 体重 {pokemon.weight} kg
            </div>
          )}
        </div>
      )}
    </div>
  )
}
