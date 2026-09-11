import React, { useEffect, useState, useCallback, useRef } from 'react'

// 属性 → 颜色(参考宝可梦官方属性色)
const TYPE_COLORS = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
  grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
  ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
  steel: '#B7B7CE', fairy: '#D685AD',
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
    try {
      const id = Math.floor(Math.random() * 1025) + 1
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
      if (!res.ok) throw new Error()
      const d = await res.json()
      setPokemon({
        id: d.id,
        name: d.name,
        artwork: d.sprites?.other?.['official-artwork'],
        sprite: d.sprites,
        types: d.types.map(t => t.type.name),
        height: (d.height / 10).toFixed(1),
        weight: (d.weight / 10).toFixed(1),
        cry: d.cries?.latest || d.cries?.legacy,
      })
    } catch {
      setError(true)
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
    <div className="card p-4 mb-3 poke-card" style={{ '--type-color': typeColor }}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="small text-muted fw-semibold">🎲 今日偶遇</span>
        <button className="btn btn-sm btn-outline-plain rounded-pill px-3" onClick={roll}>换一只</button>
      </div>

      {loading ? (
        <div className="text-center py-5 text-muted small">正在草丛里寻找…</div>
      ) : error ? (
        <div className="text-center py-4 text-muted small">
          野草茂密,没找到宝可梦(网络问题)<br />
          <button className="btn btn-sm btn-gradient rounded-pill px-3 mt-2" onClick={roll}>再试一次</button>
        </div>
      ) : (
        <div className="d-flex flex-column align-items-center">
          {/* 圆形属性色光环 + 官方原画 */}
          <div className="poke-orb position-relative">
            {image
              ? <img src={image} alt={pokemon.name} className="poke-img" />
              : <span style={{ fontSize: 64 }} className="text-muted">?</span>}
            {hasShiny && (
              <button type="button" className={`poke-shiny-btn ${shiny ? 'on' : ''}`}
                      title={shiny ? '切回普通形态' : '看看异色(闪光)形态'}
                      aria-pressed={shiny} onClick={() => setShiny(v => !v)}>✨</button>
            )}
          </div>

          <div className="d-flex align-items-center gap-2 mt-2">
            <span className="fw-bold text-capitalize" style={{ fontSize: '1.3rem' }}>{pokemon.name}</span>
            {pokemon.cry && (
              <button type="button" className="poke-cry-btn" title="听叫声" onClick={playCry}>🔊</button>
            )}
          </div>
          <div className="small text-muted mb-2">No.{String(pokemon.id).padStart(4, '0')}</div>

          <div className="d-flex gap-2 mb-2">
            {pokemon.types.map(t => (
              <span key={t} className="poke-type-badge text-capitalize"
                    style={{ background: TYPE_COLORS[t] || '#888' }}>{t}</span>
            ))}
          </div>

          <div className="small text-muted">
            身高 {pokemon.height} m · 体重 {pokemon.weight} kg
          </div>
        </div>
      )}
    </div>
  )
}
