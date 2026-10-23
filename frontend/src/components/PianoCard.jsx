import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

// 三维钢琴:Three.js 程序化琴键,点击/键盘弹奏
// 音源:University of Iowa MISpiano(取自 mageirakos/3d-piano)
const NOTES = ['C4', 'Db4', 'D4', 'Eb4', 'E4', 'F4', 'Gb4', 'G4', 'Ab4', 'A4', 'Bb4', 'B4', 'C5']
const BLACK = new Set(['Db4', 'Eb4', 'Gb4', 'Ab4', 'Bb4'])
// 电脑键盘映射(同真实钢琴打谱键位)
const KEY_MAP = { a: 'C4', w: 'Db4', s: 'D4', e: 'Eb4', d: 'E4', f: 'F4', t: 'Gb4', g: 'G4', y: 'Ab4', h: 'A4', u: 'Bb4', j: 'B4', k: 'C5' }

export default function PianoCard() {
  const mountRef = useRef(null)
  const glowRef = useRef(null)   // 当前提示文字 C4 之类的 DOM
  const apiRef = useRef(null)    // { press(note) } 暴露给键盘事件

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
    scene.background = new THREE.Color(0x141414)
    scene.fog = new THREE.Fog(0x141414, 8, 16)
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 50)
    camera.position.set(0, 2.9, 4.6)
    camera.lookAt(0, -.4, 0)

    scene.add(new THREE.HemisphereLight(0xfff6e8, 0x332211, .9))
    const lamp = new THREE.DirectionalLight(0xfff2dd, 1.5)
    lamp.position.set(2.5, 6, 3)
    lamp.castShadow = true
    lamp.shadow.mapSize.set(1024, 1024)
    Object.assign(lamp.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 15 })
    scene.add(lamp)

    // 地面
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(9, 40),
      new THREE.MeshStandardMaterial({ color: 0x1d1b18, roughness: 1 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    // 琴体
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(7.4, .55, 2.1),
      new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: .55 }),
    )
    body.position.y = .32
    body.castShadow = true
    body.receiveShadow = true
    scene.add(body)
    // 品牌青的呢毡条
    const felt = new THREE.Mesh(
      new THREE.BoxGeometry(6.9, .09, .22),
      new THREE.MeshStandardMaterial({ color: 0x0090b3, roughness: .8 }),
    )
    felt.position.set(0, .63, -.8)
    scene.add(felt)

    // 琴键
    const keyGroup = new THREE.Group()
    scene.add(keyGroup)
    const whiteMat = () => new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: .35 })
    const blackMat = () => new THREE.MeshStandardMaterial({ color: 0x23211e, roughness: .4 })
    const keys = {} // note -> { mesh, pivot, pressT }
    const WHITE_W = .52, WHITE_L = 1.55, BLACK_W = .3, BLACK_L = .95

    let whiteIdx = 0
    const HALF = 7 * WHITE_W / 2 // 8 个白键,中心对称
    for (const note of NOTES) {
      const isBlack = BLACK.has(note)
      const pivot = new THREE.Group() // 铰链在琴键后端,按下时前端下沉
      const mesh = new THREE.Mesh(
        isBlack ? new THREE.BoxGeometry(BLACK_W, .22, BLACK_L) : new THREE.BoxGeometry(WHITE_W, .18, WHITE_L),
        isBlack ? blackMat() : whiteMat(),
      )
      mesh.position.z = isBlack ? -BLACK_L / 2 - .28 : -WHITE_L / 2 - .05
      mesh.position.y = isBlack ? .72 : .63
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData.note = note
      pivot.add(mesh)
      if (isBlack) {
        // 黑键落在它左边那个白键与下一个白键的接缝上
        const whitesBefore = NOTES.slice(0, NOTES.indexOf(note)).filter(n => !BLACK.has(n)).length
        pivot.position.x = whitesBefore * WHITE_W - HALF - WHITE_W / 2
      } else {
        pivot.position.x = whiteIdx * WHITE_W - HALF
        whiteIdx++
      }
      keyGroup.add(pivot)
      keys[note] = { pivot, pressT: -1 }
    }

    // 拾取与演奏
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const audioCache = {}
    const playSound = note => {
      try {
        if (!audioCache[note]) audioCache[note] = new Audio(`/sounds/piano/${note}.wav`)
        const a = audioCache[note].cloneNode()
        a.volume = .9
        a.play().catch(() => {})
      } catch { /* 忽略 */ }
      keys[note].pressT = 0
      if (glowRef.current) {
        glowRef.current.textContent = '♪ ' + note.replace('b', '♭')
        glowRef.current.style.opacity = 1
        clearTimeout(glowRef.current._t)
        glowRef.current._t = setTimeout(() => { if (glowRef.current) glowRef.current.style.opacity = 0 }, 900)
      }
    }
    apiRef.current = { press: playSound }

    const pick = e => {
      const r = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(keyGroup.children, true)[0]
      if (hit && hit.object.userData.note) playSound(hit.object.userData.note)
    }
    const onDown = e => { e.preventDefault(); pick(e) }
    renderer.domElement.addEventListener('pointerdown', onDown)
    const onCtx = e => e.preventDefault()
    renderer.domElement.addEventListener('contextmenu', onCtx)

    // 电脑键盘弹奏
    const onKeyDown = e => {
      const note = KEY_MAP[e.key.toLowerCase()]
      if (!note || e.repeat) return
      // 仅当练习页可见时响应,避免打字误触
      if (document.hidden || !mount.isConnected) return
      playSound(note)
    }
    window.addEventListener('keydown', onKeyDown)

    // 尺寸
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

    // 动画:琴键按下回弹 + 缓慢自转展示
    const clock = new THREE.Clock()
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(clock.getDelta(), .05)
      for (const note of NOTES) {
        const k = keys[note]
        if (k.pressT >= 0) {
          k.pressT += dt
          // 0~.12s 按下,之后弹回
          const down = k.pressT < .12 ? k.pressT / .12 : Math.max(0, 1 - (k.pressT - .12) / .18)
          k.pivot.rotation.x = -down * .1
          if (k.pressT > .35) { k.pressT = -1; k.pivot.rotation.x = 0 }
        }
      }
      keyGroup.rotation.y = Math.sin(clock.elapsedTime * .3) * .1 // 轻轻左右摆动
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('contextmenu', onCtx)
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

  return (
    <div className="card piano-card mb-3">
      <div className="d-flex justify-content-between align-items-center px-3 pt-2">
        <span className="small text-muted fw-semibold">🎹 三维钢琴 · 点琴键弹奏</span>
        <span className="small text-muted d-none d-sm-inline">键盘 A–K 也可弹</span>
      </div>
      <div className="piano-stage" ref={mountRef}>
        <span className="piano-note-glow" ref={glowRef} />
      </div>
    </div>
  )
}
