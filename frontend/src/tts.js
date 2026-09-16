// 共享英文朗读:优先在线自然语音(Natural/Neural/Google),支持男/女声偏好
// 发音人列表是异步加载的,首次朗读时先等列表就绪再挑,避免回退到系统机械音

let voicesReady = null

const waitForVoices = () => {
  if (!voicesReady) {
    voicesReady = new Promise(resolve => {
      const list = speechSynthesis.getVoices()
      if (list.length) return resolve(list)
      // voices 多数浏览器在 voiceschanged 事件时才有;加 1s 兜底超时
      const timer = setTimeout(() => resolve(speechSynthesis.getVoices()), 1000)
      speechSynthesis.addEventListener('voiceschanged', () => {
        clearTimeout(timer)
        resolve(speechSynthesis.getVoices())
      }, { once: true })
    })
  }
  return voicesReady
}

// 在线自然语音关键词,越靠前越优先
const NATURAL = /Natural|Neural|Premium|Enhanced/i
// 女声常见名字(Aria/Jenny/Michelle/Zira/Samantha/Serena...)
const FEMALE = /Aria|Jenny|Michelle|Emma|Libby|Sonja|Zira|Samantha|Serena|Joanna|Salli|Kendra|Kimberly|Female|(?<!\w)F\b/i
// 男声常见名字(Guy/Daniel/Ryan/Eric/David/Mark/George...)
const MALE = /Guy|Daniel|Ryan|Eric|Brian|Christopher|Roger|Steffan|David|Mark|George|Alex|Tom|Male|(?<!\w)M\b/i

const pickVoice = (voices, gender) => {
  const en = voices.filter(v => v.lang?.toLowerCase().startsWith('en'))
  const want = gender === 'male' ? MALE : FEMALE
  return (
    // 首选:在线自然语音 + 匹配性别
    en.find(v => NATURAL.test(v.name) && want.test(v.name))
    // 次选:Google 在线音色(本身较自然)+ 匹配性别
    || en.find(v => /Google/i.test(v.name) && want.test(v.name))
    // 再次:任意自然语音 / Google
    || en.find(v => NATURAL.test(v.name))
    || en.find(v => /Google/i.test(v.name))
    // 最后兜底:对应性别的本地 Microsoft/Apple 音色,再退任意 en
    || en.find(v => want.test(v.name))
    || en.find(v => /en-US/i.test(v.lang))
    || en[0]
  )
}

export const speak = async (text, { rate = 0.9, gender = 'female' } = {}) => {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = rate
  u.pitch = 1
  const voices = await waitForVoices()
  const voice = pickVoice(voices, gender)
  if (voice) u.voice = voice
  speechSynthesis.speak(u)
}
