import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// 金币竞技场:Kenney Mini Arena(CC0)模型 + Three.js
// 玩法:60 秒内控制小士兵捡金币(+1)和红包(+5),冲击最高分
const ARENA = 8                 // 地板 8x8 格
const PLAY_R = ARENA / 2 - 0.6  // 可活动半径
const SPEED = 3.4               // 移动速度 单位/秒
const GAME_TIME = 60

// 把 GLB 场景缩放到指定宽度(模型原始比例未知,按包围盒自适应)
function fitToWidth(root, width) {
  const box = new THREE.Box3().setFromObject(root)
  const size = new THREE.Vector3()
  box.getSize(size)
  const maxLen = Math.max(size.x, size.z) || 1
  root.scale.setScalar(width / maxLen)
}
// 模型底面贴到 y=0
function dropToGround(root) {
  root.position.y = 0
  const box = new THREE.Box3().setFromObject(root)
  root.position.y -= box.min.y
}

function makeCoin() {
  const g = new THREE.Group()
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd24a, metalness: .55, roughness: .3, emissive: 0x7a5a00, emissiveIntensity: .35 })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, .05, 24), gold)
  body.rotation.x = Math.PI / 2
  body.castShadow = true
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.19, .03, 10, 24), new THREE.MeshStandardMaterial({ color: 0xe8a91c, metalness: .6, roughness: .35 }))
  g.add(body, rim)
  return g
}
function makePacket() {
  const g = new THREE.Group()
  const red = new THREE.MeshStandardMaterial({ color: 0xe5484d, roughness: .5 })
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd24a, metalness: .5, roughness: .35 })
  const body = new THREE.Mesh(new THREE.BoxGeometry(.3, .4, .12), red)
  body.castShadow = true
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .13, 16), gold)
  seal.rotation.x = Math.PI / 2
  g.add(body, seal)
  return g
}

export default function Game() {
  const mountRef = useRef(null)
  const joyRef = useRef(null)
  const [phase, setPhase] = useState('loading') // loading → ready → playing → over
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_TIME)
  const [best, setBest] = useState(() => Number(localStorage.getItem('game-coin-best') || 0))
  const [isRecord, setIsRecord] = useState(false)
  const [pops, setPops] = useState([]) // +1/+5 飘字

  const start = useCallback(() => {
    setScore(0)
    setTimeLeft(GAME_TIME)
    setIsRecord(false)
    setPhase('playing')
    window.dispatchEvent(new CustomEvent('coin-arena-restart'))
  }, [])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    let raf = 0

    // ---------- 渲染器 / 场景 / 相机 ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xcfe9f4)
    scene.fog = new THREE.Fog(0xcfe9f4, 18, 40)

    const camera = new THREE.PerspectiveCamera(45, 1, .1, 100)
    const camOff = new THREE.Vector3(0, 10.5, 8.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 5)

    // ---------- 灯光:天光 + 暖色平行光(软阴影) ----------
    scene.add(new THREE.HemisphereLight(0xd7ecf5, 0xd8c9a0, .95))
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.6)
    sun.position.set(7, 11, 5)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 2, far: 30 })
    scene.add(sun)

    // ---------- 环境地面(竞技场外的沙地) ----------
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(22, 48),
      new THREE.MeshStandardMaterial({ color: 0xe6d9ae, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.02
    ground.receiveShadow = true
    scene.add(ground)

    // ---------- 输入:键盘 + 虚拟摇杆 ----------
    const keys = new Set()
    const onKeyDown = e => {
      const k = e.key.toLowerCase()
      keys.add(k)
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault()
    }
    const onKeyUp = e => keys.delete(e.key.toLowerCase())
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const joyVec = { x: 0, y: 0 }
    const joy = joyRef.current
    const knob = joy?.querySelector('.joy-knob')
    let joyId = null
    const setKnob = (dx, dy) => { if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)` }
    const onJoyDown = e => {
      if (joyId !== null) return
      joyId = e.pointerId
      joy.setPointerCapture(e.pointerId)
      onJoyMove(e)
    }
    const onJoyMove = e => {
      if (e.pointerId !== joyId || !joy) return
      const r = joy.getBoundingClientRect()
      let dx = e.clientX - (r.left + r.width / 2)
      let dy = e.clientY - (r.top + r.height / 2)
      const len = Math.hypot(dx, dy), max = r.width / 2 - 18
      if (len > max) { dx = dx / len * max; dy = dy / len * max }
      setKnob(dx, dy)
      joyVec.x = dx / max
      joyVec.y = dy / max
    }
    const onJoyUp = e => {
      if (e.pointerId !== joyId) return
      joyId = null; joyVec.x = 0; joyVec.y = 0; setKnob(0, 0)
    }
    if (joy) {
      joy.addEventListener('pointerdown', onJoyDown)
      joy.addEventListener('pointermove', onJoyMove)
      joy.addEventListener('pointerup', onJoyUp)
      joy.addEventListener('pointercancel', onJoyUp)
    }

    // ---------- 游戏对象 ----------
    const player = new THREE.Group()
    const pickables = []   // { group, value, phase, taken }
    const effects = []     // 拾取光环
    let heading = 0

    function spawnPickable() {
      const isPacket = Math.random() < 0.18
      const g = isPacket ? makePacket() : makeCoin()
      let x, z, tries = 0
      do {
        const a = Math.random() * Math.PI * 2
        const r = Math.sqrt(Math.random()) * (PLAY_R - .3)
        x = Math.cos(a) * r; z = Math.sin(a) * r
        tries++
      } while (tries < 8 && Math.hypot(x - player.position.x, z - player.position.z) < 1.4)
      g.position.set(x, .45, z)
      scene.add(g)
      pickables.push({ group: g, value: isPacket ? 5 : 1, phase: Math.random() * Math.PI * 2, taken: false })
    }

    function collect(p) {
      p.taken = true
      scene.remove(p.group)
      setScore(s => s + p.value)
      const id = Date.now() + Math.random()
      setPops(list => [...list, { id, text: p.value > 1 ? '+5 🧧' : '+1', big: p.value > 1 }])
      setTimeout(() => { if (!disposed) setPops(list => list.filter(x => x.id !== id)) }, 800)
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(.2, .04, 8, 32),
        new THREE.MeshBasicMaterial({ color: p.value > 1 ? 0xffd24a : 0x0090b3, transparent: true }),
      )
      ring.rotation.x = Math.PI / 2
      ring.position.set(p.group.position.x, .05, p.group.position.z)
      scene.add(ring)
      effects.push({ mesh: ring, t: 0 })
      spawnPickable()
    }

    // 重新开局:清掉场上道具并重铺,计时/计分归零
    let timeLeft = GAME_TIME
    let lastSec = GAME_TIME
    let gameScore = 0
    const onRestart = () => {
      for (const p of pickables) scene.remove(p.group)
      pickables.length = 0
      player.position.set(0, 0, 2)
      heading = 0
      timeLeft = GAME_TIME
      lastSec = GAME_TIME
      gameScore = 0
      for (let i = 0; i < 5; i++) spawnPickable()
    }
    window.addEventListener('coin-arena-restart', onRestart)

    // ---------- 加载模型并搭建竞技场 ----------
    const loader = new GLTFLoader()
    const load = name => loader.loadAsync(`/models/${name}.glb`)
    const cloneReady = src => {
      const c = src.clone(true)
      c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
      return c
    }

    load('floor').then(floorG => {
      if (disposed) return
      const floor = floorG.scene
      fitToWidth(floor, 1)
      for (let i = 0; i < ARENA; i++) {
        for (let j = 0; j < ARENA; j++) {
          const f = cloneReady(floor)
          f.position.set(i - ARENA / 2 + .5, 0, j - ARENA / 2 + .5)
          f.rotation.y = ((i * 3 + j) % 4) * Math.PI / 2 // 打乱朝向避免重复感
          f.castShadow = false
          scene.add(f)
        }
      }
      return Promise.all([
        load('border-straight'), load('border-corner'), load('column'),
        load('tree'), load('statue'), load('banner'), load('trophy'), load('character-soldier'), load('block'),
      ])
    }).then(models => {
      if (disposed || !models) return
      const [borderG, cornerG, columnG, treeG, statueG, bannerG, trophyG, soldierG, blockG] = models.map(m => m.scene)

      // 围边一圈
      fitToWidth(borderG, 1)
      const placeBorder = (x, z, rot) => {
        const b = cloneReady(borderG); b.position.set(x, 0, z); b.rotation.y = rot; scene.add(b)
      }
      for (let k = 0; k < ARENA; k++) {
        const p = k - ARENA / 2 + .5
        placeBorder(p, -ARENA / 2 - .5, 0)
        placeBorder(p, ARENA / 2 + .5, Math.PI)
        placeBorder(-ARENA / 2 - .5, p, Math.PI / 2)
        placeBorder(ARENA / 2 + .5, p, -Math.PI / 2)
      }
      fitToWidth(cornerG, 1)
      ;[[-1, -1, 0], [1, -1, Math.PI / 2], [1, 1, Math.PI], [-1, 1, -Math.PI / 2]].forEach(([sx, sz, rot]) => {
        const c = cloneReady(cornerG)
        c.position.set(sx * (ARENA / 2 + .5), 0, sz * (ARENA / 2 + .5))
        c.rotation.y = rot
        scene.add(c)
      })

      // 装饰:四角立柱 + 树,北侧雕像/奖杯台,南侧旗帜
      fitToWidth(columnG, 1); fitToWidth(treeG, 1.3); fitToWidth(statueG, 1.1)
      fitToWidth(bannerG, 1); fitToWidth(trophyG, .7); fitToWidth(blockG, .9)
      const deco = (src, x, z, rot = 0) => {
        const d = cloneReady(src); d.position.set(x, 0, z); d.rotation.y = rot
        dropToGround(d)
        scene.add(d)
      }
      deco(columnG, -ARENA / 2 - 1.2, -ARENA / 2 - 1.2); deco(columnG, ARENA / 2 + 1.2, -ARENA / 2 - 1.2)
      deco(columnG, -ARENA / 2 - 1.2, ARENA / 2 + 1.2); deco(columnG, ARENA / 2 + 1.2, ARENA / 2 + 1.2)
      deco(treeG, -ARENA / 2 - 1.4, 0, .4); deco(treeG, ARENA / 2 + 1.4, 1.2, 2.1); deco(treeG, 0, ARENA / 2 + 1.5, 1.2)
      deco(statueG, 0, -ARENA / 2 - 1.3)
      deco(bannerG, -2.2, ARENA / 2 + 1.3, Math.PI); deco(bannerG, 2.2, ARENA / 2 + 1.3, Math.PI)
      // 奖杯摆在石台上
      const bk = cloneReady(blockG); bk.position.set(2.1, 0, -ARENA / 2 - 1.3); dropToGround(bk); scene.add(bk)
      const tp = cloneReady(trophyG); tp.position.set(2.1, new THREE.Box3().setFromObject(bk).max.y, -ARENA / 2 - 1.3); scene.add(tp)

      // 玩家士兵
      fitToWidth(soldierG, .75)
      soldierG.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false } })
      player.add(soldierG)
      player.position.set(0, 0, 2)
      scene.add(player)

      for (let i = 0; i < 5; i++) spawnPickable()
      setPhase('ready')
    }).catch(err => { console.error('竞技场模型加载失败', err) })

    // ---------- 尺寸自适应 ----------
    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(mount)
    resize()

    // ---------- 主循环 ----------
    const clock = new THREE.Clock()

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(clock.getDelta(), .05)
      const t = clock.elapsedTime
      const playing = phaseRef.current === 'playing'

      if (playing) {
        timeLeft -= dt
        const sec = Math.max(0, Math.ceil(timeLeft))
        if (sec !== lastSec) { lastSec = sec; setTimeLeft(sec) }
        if (timeLeft <= 0) {
          setPhase('over')
          const prevBest = Number(localStorage.getItem('game-coin-best') || 0)
          if (gameScore > prevBest && gameScore > 0) {
            localStorage.setItem('game-coin-best', gameScore)
            setBest(gameScore)
            setIsRecord(true)
          }
        }
      }

      // 移动(键盘 + 摇杆矢量叠加,限幅)
      let mx = 0, mz = 0
      if (playing) {
        if (keys.has('w') || keys.has('arrowup')) mz -= 1
        if (keys.has('s') || keys.has('arrowdown')) mz += 1
        if (keys.has('a') || keys.has('arrowleft')) mx -= 1
        if (keys.has('d') || keys.has('arrowright')) mx += 1
        mx += joyVec.x; mz += joyVec.y
      }
      const mlen = Math.hypot(mx, mz)
      if (mlen > 0.01) {
        const nx = mx / Math.max(mlen, 1), nz = mz / Math.max(mlen, 1)
        player.position.x = THREE.MathUtils.clamp(player.position.x + nx * SPEED * dt, -PLAY_R, PLAY_R)
        player.position.z = THREE.MathUtils.clamp(player.position.z + nz * SPEED * dt, -PLAY_R, PLAY_R)
        // 朝向:最短角差,避免原地转圈
        const target = Math.atan2(nx, nz)
        let d = target - heading
        d = Math.atan2(Math.sin(d), Math.cos(d))
        heading += d * (1 - Math.pow(.0005, dt))
        player.rotation.y = heading
        player.position.y = Math.abs(Math.sin(t * 11)) * .04 // 跑动小碎步
      } else {
        player.position.y *= .8
      }

      // 金币旋转/浮动 + 拾取判定(水平距离)
      for (const p of pickables) {
        if (p.taken) continue
        p.group.rotation.y += dt * 2.2
        p.group.position.y = .45 + Math.sin(t * 2 + p.phase) * .07
        if (playing && Math.hypot(player.position.x - p.group.position.x, player.position.z - p.group.position.z) < .6) {
          gameScore += p.value
          collect(p)
        }
      }

      // 光环特效
      for (let i = effects.length - 1; i >= 0; i--) {
        const e = effects[i]
        e.t += dt
        e.mesh.scale.setScalar(1 + e.t * 6)
        e.mesh.material.opacity = Math.max(0, 1 - e.t * 2.5)
        if (e.t > .45) { scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose(); effects.splice(i, 1) }
      }

      // 相机跟随(看向玩家与场地中心之间)
      camera.position.lerp(new THREE.Vector3(player.position.x * .6, 0, player.position.z * .6).add(camOff), 1 - Math.pow(.02, dt))
      camera.lookAt(player.position.x * .6, .6, player.position.z * .6)

      renderer.render(scene, camera)
    }
    tick()

    // ---------- 清理 ----------
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('coin-arena-restart', onRestart)
      if (joy) {
        joy.removeEventListener('pointerdown', onJoyDown)
        joy.removeEventListener('pointermove', onJoyMove)
        joy.removeEventListener('pointerup', onJoyUp)
        joy.removeEventListener('pointercancel', onJoyUp)
      }
      scene.traverse(o => {
        if (o.isMesh) {
          o.geometry?.dispose()
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          mats.forEach(m => m?.dispose())
        }
      })
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  const phaseRef = useRef(phase)
  phaseRef.current = phase

  return (
    <div className="game-wrap card" ref={mountRef}>
      {/* HUD */}
      <div className="game-hud-top">
        <span className={`hud-pill ${timeLeft <= 10 ? 'danger' : ''}`}>⏱ {timeLeft}s</span>
        <span className="hud-pill score">🪙 {score}</span>
        <span className="hud-pill best">🏆 {best}</span>
      </div>

      {pops.map(p => (
        <div key={p.id} className={`score-pop ${p.big ? 'big' : ''}`}>{p.text}</div>
      ))}

      {/* 虚拟摇杆 */}
      <div className={`joy ${phase === 'playing' ? '' : 'd-none'}`} ref={joyRef}>
        <div className="joy-knob" />
      </div>

      {phase === 'loading' && (
        <div className="game-overlay"><div className="loading-shake" style={{ fontSize: 40 }}>⚔️</div>正在搭建竞技场…</div>
      )}
      {phase === 'ready' && (
        <div className="game-overlay">
          <div className="game-title">⚔️ 金币竞技场</div>
          <p className="mb-1">60 秒内捡金币 +1,红包 +5</p>
          <p className="small text-muted mb-3">电脑:WASD / 方向键 · 手机:左下摇杆</p>
          <button className="btn btn-gradient px-4" onClick={start}>开 始</button>
        </div>
      )}
      {phase === 'over' && (
        <div className="game-overlay">
          <div className="game-title">⏹ 时间到!</div>
          <div className="game-result">
            本局捡到 <b className="amount">{score}</b> 金币
            {isRecord
              ? <div className="new-best">🎉 新纪录!</div>
              : <div className="small text-muted mt-1">最高纪录 {best}</div>}
          </div>
          <button className="btn btn-gradient px-4 mt-3" onClick={start}>再来一局</button>
        </div>
      )}
    </div>
  )
}
