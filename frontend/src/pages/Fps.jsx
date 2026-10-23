import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// 竞技场枪战:第一人称射击(素材全部来自 shorepine/kenney,CC0)
// 玩法:波次进攻的红色小人冲向玩家,开枪击退;5 颗心,坚持越久波数越高
const ARENA = 8
const PLAY_R = ARENA / 2 - 0.6
const SPEED = 3.6
const FIRE_CD = 0.16
const MAX_HP = 5

function fitToWidth(root, width) {
  const box = new THREE.Box3().setFromObject(root)
  const size = new THREE.Vector3()
  box.getSize(size)
  const maxLen = Math.max(size.x, size.z) || 1
  root.scale.setScalar(width / maxLen)
}
function dropToGround(root) {
  root.position.y = 0
  const box = new THREE.Box3().setFromObject(root)
  root.position.y -= box.min.y
}
function tint(root, hex) {
  root.traverse(o => {
    if (o.isMesh && o.material) {
      o.material = o.material.clone()
      o.material.color = new THREE.Color(hex)
    }
  })
}

// 简易合成音效(无音频素材,WebAudio 生成)
let AC = null
function beep(type, f0, f1, dur, vol = .12) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)()
    if (AC.state === 'suspended') AC.resume()
    const osc = AC.createOscillator(), g = AC.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(f0, AC.currentTime)
    osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), AC.currentTime + dur)
    g.gain.setValueAtTime(vol, AC.currentTime)
    g.gain.exponentialRampToValueAtTime(.001, AC.currentTime + dur)
    osc.connect(g).connect(AC.destination)
    osc.start(); osc.stop(AC.currentTime + dur)
  } catch { /* 忽略音频失败 */ }
}
const sfx = {
  fire: () => beep('square', 820, 160, .09),
  hit: () => beep('sine', 1250, 700, .06, .16),
  hurt: () => beep('sawtooth', 150, 60, .22, .18),
  wave: () => beep('triangle', 440, 880, .25, .1),
}

export default function Fps() {
  const mountRef = useRef(null)
  const joyRef = useRef(null)
  const [phase, setPhase] = useState('loading')
  const [hp, setHp] = useState(MAX_HP)
  const [wave, setWave] = useState(0)
  const [kills, setKills] = useState(0)
  const [best, setBest] = useState(() => Number(localStorage.getItem('game-fps-best') || 0))
  const [isRecord, setIsRecord] = useState(false)
  const [banner, setBanner] = useState('')
  const [hitMark, setHitMark] = useState(0)
  const [dmgFlash, setDmgFlash] = useState(0)

  const start = useCallback(() => {
    setHp(MAX_HP); setWave(0); setKills(0); setIsRecord(false)
    setPhase('playing')
    window.dispatchEvent(new CustomEvent('fps-restart'))
  }, [])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    let raf = 0

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xffe0bd)   // 黄昏暖色,与金币竞技场区分
    scene.fog = new THREE.Fog(0xffe0bd, 16, 38)

    const camera = new THREE.PerspectiveCamera(66, 1, .1, 100)
    camera.rotation.order = 'YXZ'

    scene.add(new THREE.HemisphereLight(0xfff0d8, 0xc9a877, 1.0))
    const sun = new THREE.DirectionalLight(0xffd9a0, 1.7)
    sun.position.set(-7, 10, 6)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 2, far: 30 })
    scene.add(sun)

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(22, 48),
      new THREE.MeshStandardMaterial({ color: 0xe0c48f, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.02
    ground.receiveShadow = true
    scene.add(ground)

    // ---------- 输入 ----------
    const keys = new Set()
    const onKeyDown = e => {
      const k = e.key.toLowerCase()
      keys.add(k)
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault()
    }
    const onKeyUp = e => keys.delete(e.key.toLowerCase())
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    // 鼠标视角(指针锁定)
    let yaw = 0, pitch = -0.12
    let firing = false, fireHeld = false
    const onCanvasClick = () => {
      if (phaseRef.current === 'playing' && !('ontouchstart' in window)) {
        if (document.pointerLockElement !== renderer.domElement) {
          const p = renderer.domElement.requestPointerLock()
          if (p && p.catch) p.catch(() => {})
        }
      }
    }
    const onMouseMove = e => {
      if (document.pointerLockElement === renderer.domElement) {
        yaw -= e.movementX * .0024
        pitch = THREE.MathUtils.clamp(pitch - e.movementY * .0024, -1.25, 1.25)
      }
    }
    const onMouseDown = e => { if (e.button === 0 && document.pointerLockElement === renderer.domElement) fireHeld = true }
    const onMouseUp = () => { fireHeld = false }
    const onLockChange = () => { if (document.pointerLockElement !== renderer.domElement) fireHeld = false }
    renderer.domElement.addEventListener('click', onCanvasClick)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('pointerlockchange', onLockChange)
    const onCtx = e => e.preventDefault()
    renderer.domElement.addEventListener('contextmenu', onCtx)

    // 移动摇杆(移动)
    const joyVec = { x: 0, y: 0 }
    const joy = joyRef.current
    const knob = joy?.querySelector('.joy-knob')
    let joyId = null
    const setKnob = (dx, dy) => { if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)` }
    const onJoyDown = e => { if (joyId !== null) return; joyId = e.pointerId; joy.setPointerCapture(e.pointerId); onJoyMove(e) }
    const onJoyMove = e => {
      if (e.pointerId !== joyId || !joy) return
      const r = joy.getBoundingClientRect()
      let dx = e.clientX - (r.left + r.width / 2)
      let dy = e.clientY - (r.top + r.height / 2)
      const len = Math.hypot(dx, dy), max = r.width / 2 - 18
      if (len > max) { dx = dx / len * max; dy = dy / len * max }
      setKnob(dx, dy)
      joyVec.x = dx / max; joyVec.y = dy / max
    }
    const onJoyUp = e => { if (e.pointerId !== joyId) return; joyId = null; joyVec.x = 0; joyVec.y = 0; setKnob(0, 0) }
    if (joy) {
      joy.addEventListener('pointerdown', onJoyDown)
      joy.addEventListener('pointermove', onJoyMove)
      joy.addEventListener('pointerup', onJoyUp)
      joy.addEventListener('pointercancel', onJoyUp)
    }

    // 触屏视角(右侧拖动看)
    let lookId = null, lookX = 0, lookY = 0
    const lookZone = mount.querySelector('.look-zone')
    const onLookDown = e => { if (lookId !== null) return; lookId = e.pointerId; lookX = e.clientX; lookY = e.clientY; lookZone.setPointerCapture(e.pointerId) }
    const onLookMove = e => {
      if (e.pointerId !== lookId) return
      yaw -= (e.clientX - lookX) * .0052
      pitch = THREE.MathUtils.clamp(pitch - (e.clientY - lookY) * .0052, -1.25, 1.25)
      lookX = e.clientX; lookY = e.clientY
    }
    const onLookUp = e => { if (e.pointerId === lookId) lookId = null }
    if (lookZone) {
      lookZone.addEventListener('pointerdown', onLookDown)
      lookZone.addEventListener('pointermove', onLookMove)
      lookZone.addEventListener('pointerup', onLookUp)
      lookZone.addEventListener('pointercancel', onLookUp)
    }
    // 开火按钮(按住连发)
    const fireBtn = mount.querySelector('.fire-btn')
    const onFireDown = e => { e.preventDefault(); fireHeld = true }
    const onFireUp = () => { fireHeld = false }
    if (fireBtn) {
      fireBtn.addEventListener('pointerdown', onFireDown)
      fireBtn.addEventListener('pointerup', onFireUp)
      fireBtn.addEventListener('pointercancel', onFireUp)
    }

    // ---------- 对象 ----------
    const player = { pos: new THREE.Vector3(0, 1.55, 2.5), bobT: 0 }
    const gun = new THREE.Group()          // 武器视图模型(挂在相机上)
    const gunFlash = new THREE.PointLight(0xffd9a0, 0, 6)
    const enemies = []                     // { root, speed, hitCd, bob }
    const particles = []                   // 击杀碎块
    const tracers = []                     // 弹道线
    const enemySphere = new THREE.Sphere(new THREE.Vector3(), .48)
    const ray = new THREE.Ray()

    let soldierMale = null, soldierFemale = null
    let waveNum = 0, hp = MAX_HP, killCount = 0
    let spawnLeft = 0, spawnTimer = 0, waveRest = 0
    let invuln = 0, fireCd = 0, recoil = 0

    function spawnEnemy() {
      const useFemale = Math.random() < .35 && soldierFemale
      const proto = useFemale ? soldierFemale : soldierMale
      const e = proto.clone(true)
      tint(e, useFemale ? 0xff8f8f : 0xffb0a6)
      e.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false } })
      fitToWidth(e, .8)
      dropToGround(e)
      const a = Math.random() * Math.PI * 2
      e.position.set(Math.cos(a) * (PLAY_R - .1), 0, Math.sin(a) * (PLAY_R - .1))
      scene.add(e)
      enemies.push({ root: e, speed: 1.0 + waveNum * .12 + Math.random() * .25, hitCd: 0, bob: Math.random() * 6 })
    }

    function killEnemy(e) {
      const i = enemies.indexOf(e)
      if (i >= 0) enemies.splice(i, 1)
      scene.remove(e.root)
      killCount++
      setKills(killCount)
      sfx.hit()
      setHitMark(Date.now())
      // 碎块爆开
      for (let k = 0; k < 10; k++) {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(.09, .09, .09),
          new THREE.MeshStandardMaterial({ color: k % 3 ? 0xffb0a6 : 0x6b4a3f }),
        )
        m.position.copy(e.root.position).y += .7
        particles.push({
          mesh: m, t: 0,
          vel: new THREE.Vector3((Math.random() - .5) * 4, Math.random() * 3.4 + 1, (Math.random() - .5) * 4),
        })
        scene.add(m)
      }
    }

    function damagePlayer() {
      if (invuln > 0 || hp <= 0) return
      hp--
      setHp(hp)
      invuln = .9
      setDmgFlash(Date.now())
      sfx.hurt()
      if (hp <= 0) {
        setPhase('over')
        const prev = Number(localStorage.getItem('game-fps-best') || 0)
        if (killCount > prev) {
          localStorage.setItem('game-fps-best', killCount)
          setBest(killCount)
          setIsRecord(true)
        }
        if (document.pointerLockElement === renderer.domElement) document.exitPointerLock()
      }
    }

    function shoot() {
      fireCd = FIRE_CD
      recoil = 1
      sfx.fire()
      gunFlash.intensity = 3.2
      camera.getWorldDirection(ray.direction)
      ray.origin.copy(camera.position)
      // 最近命中
      let hitE = null, hitDist = Infinity
      for (const e of enemies) {
        enemySphere.center.set(e.root.position.x, e.root.position.y + .75, e.root.position.z)
        const p = new THREE.Vector3()
        if (ray.intersectSphere(enemySphere, p)) {
          const d = p.distanceTo(camera.position)
          if (d < hitDist) { hitDist = d; hitE = e; }
        }
      }
      const end = new THREE.Vector3()
      if (hitE) { end.copy(ray.origin).addScaledVector(ray.direction, hitDist); killEnemy(hitE) }
      else end.copy(ray.origin).addScaledVector(ray.direction, 26)
      // 弹道
      const muzzle = new THREE.Vector3(.22, -.18, -.9).applyQuaternion(camera.quaternion).add(camera.position)
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([muzzle, end]),
        new THREE.LineBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: .9 }),
      )
      scene.add(line)
      tracers.push({ mesh: line, t: 0 })
    }

    const onRestart = () => {
      for (const e of enemies) scene.remove(e.root)
      enemies.length = 0
      player.pos.set(0, 1.55, 2.5)
      yaw = 0; pitch = -0.12
      waveNum = 0; hp = MAX_HP; killCount = 0
      spawnLeft = 0; spawnTimer = 0; waveRest = .6
      invuln = 0; fireCd = 0
    }
    window.addEventListener('fps-restart', onRestart)

    // ---------- 加载素材并搭场景(竞技场复用 Mini Arena,武器/敌人/木箱来自 shorepine/kenney) ----------
    const loader = new GLTFLoader()
    const load = path => loader.loadAsync(path)
    const cloneReady = src => {
      const c = src.clone(true)
      c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
      return c
    }

    Promise.all([
      load('/models/floor.glb'), load('/models/border-straight.glb'), load('/models/border-corner.glb'),
      load('/models/column.glb'), load('/models/tree.glb'),
      load('/models/fps/blaster/blaster-a.glb'),
      load('/models/fps/characters/character-male-a.glb'),
      load('/models/fps/characters/character-female-b.glb'),
      load('/models/fps/blaster/crate-medium.glb'),
    ]).then(models => {
      if (disposed) return
      const [floorG, borderG, cornerG, columnG, treeG, gunG, maleG, femaleG, crateG] = models.map(m => m.scene)

      fitToWidth(floorG, 1)
      for (let i = 0; i < ARENA; i++) {
        for (let j = 0; j < ARENA; j++) {
          const f = cloneReady(floorG)
          f.position.set(i - ARENA / 2 + .5, 0, j - ARENA / 2 + .5)
          f.rotation.y = ((i * 3 + j) % 4) * Math.PI / 2
          f.castShadow = false
          scene.add(f)
        }
      }
      fitToWidth(borderG, 1)
      const placeBorder = (x, z, rot) => {
        const b = cloneReady(borderG); b.position.set(x, 0, z); b.rotation.y = rot; scene.add(b)
      }
      for (let k = 0; k < ARENA; k++) {
        const p = k - ARENA / 2 + .5
        placeBorder(p, -ARENA / 2 - .5, 0); placeBorder(p, ARENA / 2 + .5, Math.PI)
        placeBorder(-ARENA / 2 - .5, p, Math.PI / 2); placeBorder(ARENA / 2 + .5, p, -Math.PI / 2)
      }
      fitToWidth(cornerG, 1)
      ;[[-1, -1, 0], [1, -1, Math.PI / 2], [1, 1, Math.PI], [-1, 1, -Math.PI / 2]].forEach(([sx, sz, rot]) => {
        const c = cloneReady(cornerG)
        c.position.set(sx * (ARENA / 2 + .5), 0, sz * (ARENA / 2 + .5)); c.rotation.y = rot
        scene.add(c)
      })
      fitToWidth(columnG, 1); fitToWidth(treeG, 1.3); fitToWidth(crateG, 1.05)
      const deco = (src, x, z, rot = 0) => {
        const d = cloneReady(src); d.position.set(x, 0, z); d.rotation.y = rot; dropToGround(d); scene.add(d)
      }
      deco(columnG, -ARENA / 2 - 1.2, -ARENA / 2 - 1.2); deco(columnG, ARENA / 2 + 1.2, -ARENA / 2 - 1.2)
      deco(columnG, -ARENA / 2 - 1.2, ARENA / 2 + 1.2); deco(columnG, ARENA / 2 + 1.2, ARENA / 2 + 1.2)
      deco(treeG, -ARENA / 2 - 1.4, .3, .4); deco(treeG, ARENA / 2 + 1.4, -1, 2.1)
      // 场内掩体木箱
      deco(crateG, -1.8, -1.2, .3); deco(crateG, 2.0, 1.4, -.5); deco(crateG, .2, -2.4, 1.1)

      // 武器视图模型
      fitToWidth(gunG, .5)
      gunG.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false } })
      gun.add(gunG)
      gun.position.set(.30, -.27, -.52)
      camera.add(gun)
      gunFlash.position.set(.05, .12, -.35)
      gun.add(gunFlash)
      scene.add(camera)

      soldierMale = maleG
      soldierFemale = femaleG
      setPhase('ready')
    }).catch(err => console.error('枪战素材加载失败', err))

    // ---------- 尺寸 ----------
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

      // 键盘视角(方向键)
      if (playing) {
        if (keys.has('arrowleft')) yaw += 1.8 * dt
        if (keys.has('arrowright')) yaw -= 1.8 * dt
        if (keys.has('arrowup')) pitch = THREE.MathUtils.clamp(pitch + 1.2 * dt, -1.25, 1.25)
        if (keys.has('arrowdown')) pitch = THREE.MathUtils.clamp(pitch - 1.2 * dt, -1.25, 1.25)
      }
      camera.rotation.set(pitch, yaw, 0)

      // 移动(相对朝向)
      let mx = 0, mz = 0
      if (playing) {
        if (keys.has('w')) mz -= 1
        if (keys.has('s')) mz += 1
        if (keys.has('a')) mx -= 1
        if (keys.has('d')) mx += 1
        mx += joyVec.x; mz += joyVec.y
      }
      const mlen = Math.hypot(mx, mz)
      let moving = false
      if (mlen > .01) {
        moving = true
        const nx = mx / Math.max(mlen, 1), nz = mz / Math.max(mlen, 1)
        // 屏幕方向 → 世界方向:W 沿相机朝向前进(yaw=0 时朝 -Z)
        const sin = Math.sin(yaw), cos = Math.cos(yaw)
        const wx = nx * cos + nz * sin
        const wz = -nx * sin + nz * cos
        player.pos.x = THREE.MathUtils.clamp(player.pos.x + wx * SPEED * dt, -PLAY_R, PLAY_R)
        player.pos.z = THREE.MathUtils.clamp(player.pos.z + wz * SPEED * dt, -PLAY_R, PLAY_R)
      }
      player.bobT += dt * (moving ? 9 : 2)
      const bob = moving ? Math.sin(player.bobT) * .035 : 0
      camera.position.set(player.pos.x, player.pos.y + bob, player.pos.z)

      // 开火
      fireCd -= dt
      if (playing && (fireHeld || keys.has(' ')) && fireCd <= 0) shoot()
      gunFlash.intensity = Math.max(0, gunFlash.intensity - dt * 26)
      // 后坐力回弹 + 待机摆动
      recoil = Math.max(0, recoil - dt * 7)
      gun.position.z = -.52 + recoil * .09
      gun.rotation.x = recoil * .16
      gun.position.y = -.27 + Math.sin(player.bobT) * .008

      // 波次
      if (playing) {
        if (waveRest > 0) {
          waveRest -= dt
          if (waveRest <= 0) {
            waveNum++
            setWave(waveNum)
            setBanner(`第 ${waveNum} 波来袭!`)
            setTimeout(() => { if (!disposed) setBanner('') }, 1400)
            spawnLeft = 2 + waveNum * 2
            spawnTimer = 0
            sfx.wave()
          }
        } else if (spawnLeft > 0) {
          spawnTimer -= dt
          if (spawnTimer <= 0) { spawnEnemy(); spawnLeft--; spawnTimer = Math.max(.35, .95 - waveNum * .07) }
        } else if (enemies.length === 0) {
          waveRest = 2.2
        }
      }

      // 敌人 AI(仅进行中;结算画面冻结全场)
      invuln = Math.max(0, invuln - dt)
      if (playing) {
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i]
          const dx = player.pos.x - e.root.position.x
          const dz = player.pos.z - e.root.position.z
          const dist = Math.hypot(dx, dz)
          e.root.rotation.y = Math.atan2(dx, dz)
          if (dist > .95) {
            e.root.position.x += dx / dist * e.speed * dt
            e.root.position.z += dz / dist * e.speed * dt
            e.root.position.y = Math.abs(Math.sin(t * 9 + e.bob)) * .05
          }
          e.hitCd = Math.max(0, e.hitCd - dt)
          if (dist < 1.0 && e.hitCd <= 0) {
            e.hitCd = 1.2
            damagePlayer()
            e.root.position.x -= dx / dist * 1.2  // 击退敌人
            e.root.position.z -= dz / dist * 1.2
          }
        }
      }

      // 碎块粒子
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.t += dt
        p.vel.y -= 9 * dt
        p.mesh.position.addScaledVector(p.vel, dt)
        p.mesh.rotation.x += dt * 6; p.mesh.rotation.y += dt * 4
        p.mesh.scale.setScalar(Math.max(.01, 1 - p.t * 1.6))
        if (p.t > .7) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); particles.splice(i, 1) }
      }
      // 弹道淡出
      for (let i = tracers.length - 1; i >= 0; i--) {
        const tr = tracers[i]
        tr.t += dt
        tr.mesh.material.opacity = Math.max(0, .9 - tr.t * 12)
        if (tr.t > .09) { scene.remove(tr.mesh); tr.mesh.geometry.dispose(); tr.mesh.material.dispose(); tracers.splice(i, 1) }
      }

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
      window.removeEventListener('fps-restart', onRestart)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('pointerlockchange', onLockChange)
      renderer.domElement.removeEventListener('click', onCanvasClick)
      renderer.domElement.removeEventListener('contextmenu', onCtx)
      if (joy) {
        joy.removeEventListener('pointerdown', onJoyDown)
        joy.removeEventListener('pointermove', onJoyMove)
        joy.removeEventListener('pointerup', onJoyUp)
        joy.removeEventListener('pointercancel', onJoyUp)
      }
      if (lookZone) {
        lookZone.removeEventListener('pointerdown', onLookDown)
        lookZone.removeEventListener('pointermove', onLookMove)
        lookZone.removeEventListener('pointerup', onLookUp)
        lookZone.removeEventListener('pointercancel', onLookUp)
      }
      if (fireBtn) {
        fireBtn.removeEventListener('pointerdown', onFireDown)
        fireBtn.removeEventListener('pointerup', onFireUp)
        fireBtn.removeEventListener('pointercancel', onFireUp)
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
    <div className="game-wrap card fps-wrap" ref={mountRef}>
      {/* HUD */}
      <div className="game-hud-top">
        <span className="hud-pill fps-hp">{'❤️'.repeat(Math.max(0, hp))}{'🖤'.repeat(Math.max(0, MAX_HP - hp))}</span>
        <span className="hud-pill score">💀 {kills}</span>
        <span className="hud-pill best">🏆 {best}</span>
      </div>
      {wave > 0 && <div className="hud-wave">第 {wave} 波</div>}

      {/* 准星(每次命中用 key 重挂载触发爆闪动画) */}
      {phase === 'playing' && (
        <div className="fps-crosshair">
          <i className="dot" /><i className="l" /><i className="r" /><i className="u" /><i className="d" />
          {hitMark > 0 && <i key={hitMark} className="hit-ring" />}
        </div>
      )}
      {/* 受伤红闪(动画播完停在透明) */}
      {dmgFlash > 0 && <div key={dmgFlash} className="dmg-flash" />}

      {/* 移动摇杆 / 视角区 / 开火键 */}
      <div className={`joy ${phase === 'playing' ? '' : 'd-none'}`} ref={joyRef}>
        <div className="joy-knob" />
      </div>
      <div className={`look-zone ${phase === 'playing' ? '' : 'd-none'}`} />
      <button className={`fire-btn ${phase === 'playing' ? '' : 'd-none'}`}>🔥</button>

      {banner && <div className="wave-banner">{banner}</div>}

      {phase === 'loading' && (
        <div className="game-overlay"><div className="loading-shake" style={{ fontSize: 40 }}>🔫</div>正在装载武器…</div>
      )}
      {phase === 'ready' && (
        <div className="game-overlay">
          <div className="game-title">🔫 竞技场枪战</div>
          <p className="mb-1">红色小人一波波冲过来,开枪击退它们!</p>
          <p className="small mb-1">你只有 {MAX_HP} 颗心,被碰到就掉一颗</p>
          <p className="small text-muted mb-3">电脑:点击画面锁定鼠标瞄准,左键/空格开火,WASD 移动<br />手机:左摇杆移动,右半屏滑动瞄准,右下按钮开火</p>
          <button className="btn btn-gradient px-4" onClick={start}>开 始</button>
        </div>
      )}
      {phase === 'over' && (
        <div className="game-overlay">
          <div className="game-title">💔 你倒下了</div>
          <div className="game-result">
            坚持到 <b>第 {wave} 波</b>,击倒 <b className="amount">{kills}</b> 个
            {isRecord
              ? <div className="new-best">🎉 新纪录!</div>
              : <div className="small text-muted mt-1">最高击倒 {best}</div>}
          </div>
          <button className="btn btn-gradient px-4 mt-3" onClick={start}>再来一局</button>
        </div>
      )}
    </div>
  )
}
