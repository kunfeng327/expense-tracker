import React, { useEffect, useState } from 'react'

// WMO 天气代码 → 描述 / emoji / 配色 / 穿衣与带伞建议
const WEATHER = {
  0:  { text: '晴', emoji: '☀️', bg: 'linear-gradient(135deg,#38bdf8,#7dd3fc)', tip: '阳光正好,适合出门溜达 🎈' },
  1:  { text: '大致晴朗', emoji: '🌤️', bg: 'linear-gradient(135deg,#38bdf8,#93c5fd)', tip: '天气不错,轻装出门即可 👕' },
  2:  { text: '多云', emoji: '⛅', bg: 'linear-gradient(135deg,#60a5fa,#a5b4fc)', tip: '云层较厚,体感微凉,备件薄外套 🧥' },
  3:  { text: '阴', emoji: '☁️', bg: 'linear-gradient(135deg,#94a3b8,#cbd5e1)', tip: '天色阴沉,出门加件外套更稳妥 🧥' },
  45: { text: '雾', emoji: '🌫️', bg: 'linear-gradient(135deg,#94a3b8,#d1d5db)', tip: '有雾,开车骑车记得减速慢行 🚗' },
  48: { text: '冻雾', emoji: '🌫️', bg: 'linear-gradient(135deg,#94a3b8,#d1d5db)', tip: '路面易滑,出行注意安全 ⚠️' },
  51: { text: '小毛毛雨', emoji: '🌦️', bg: 'linear-gradient(135deg,#64748b,#93a3b8)', tip: '飘着毛毛雨,带上伞更安心 ☂️' },
  53: { text: '毛毛雨', emoji: '🌦️', bg: 'linear-gradient(135deg,#64748b,#93a3b8)', tip: '毛毛雨绵绵,建议带伞 ☂️' },
  55: { text: '大毛毛雨', emoji: '🌦️', bg: 'linear-gradient(135deg,#64748b,#93a3b8)', tip: '雨虽小但密,带伞别偷懒 ☂️' },
  61: { text: '小雨', emoji: '🌧️', bg: 'linear-gradient(135deg,#475569,#64748b)', tip: '今天有小雨,记得带伞 ☂️' },
  63: { text: '中雨', emoji: '🌧️', bg: 'linear-gradient(135deg,#334155,#475569)', tip: '雨有点大,带伞 + 防水鞋 🌂👟' },
  65: { text: '大雨', emoji: '⛈️', bg: 'linear-gradient(135deg,#1e293b,#334155)', tip: '大雨倾盆,非必要不出门,务必带伞 ☔' },
  71: { text: '小雪', emoji: '🌨️', bg: 'linear-gradient(135deg,#93c5fd,#e0f2fe)', tip: '飘小雪了,穿暖和点,小心路滑 🧣' },
  73: { text: '中雪', emoji: '🌨️', bg: 'linear-gradient(135deg,#93c5fd,#e0f2fe)', tip: '雪越下越大,羽绒服安排上 🧥❄️' },
  75: { text: '大雪', emoji: '❄️', bg: 'linear-gradient(135deg,#bfdbfe,#f0f9ff)', tip: '大雪纷飞,注意保暖防滑,慢点走 🧣⛄' },
  80: { text: '阵雨', emoji: '🌦️', bg: 'linear-gradient(135deg,#475569,#7dd3fc)', tip: '有阵雨,包里塞把伞有备无患 ☂️' },
  81: { text: '强阵雨', emoji: '🌧️', bg: 'linear-gradient(135deg,#334155,#475569)', tip: '阵雨较强,出门一定带伞 ☂️' },
  82: { text: '暴雨', emoji: '⛈️', bg: 'linear-gradient(135deg,#1e293b,#334155)', tip: '可能有暴雨,尽量减少外出 ☔' },
  95: { text: '雷阵雨', emoji: '⛈️', bg: 'linear-gradient(135deg,#4c1d95,#6366f1)', tip: '雷雨来袭,带伞并远离空旷高处 ⚡☂️' },
  96: { text: '雷雨冰雹', emoji: '⛈️', bg: 'linear-gradient(135deg,#4c1d95,#6366f1)', tip: '雷雨伴冰雹,尽量别出门,注意安全 ⚠️' },
  99: { text: '强雷雨冰雹', emoji: '🌩️', bg: 'linear-gradient(135deg,#312e81,#4c1d95)', tip: '恶劣天气预警,建议宅家 ⚠️🏠' },
}
const fallbackWeather = { text: '未知', emoji: '🌡️', bg: 'linear-gradient(135deg,#94a3b8,#cbd5e1)', tip: '暂时拿不到天气,出门自己看看天 👀' }

// 根据气温补充穿衣建议
const clothTip = t => {
  if (t == null) return ''
  if (t >= 28) return '短袖短裤,注意防晒 🧴'
  if (t >= 22) return '薄短袖刚刚好 👕'
  if (t >= 16) return '长袖 + 薄外套,早晚凉 🧥'
  if (t >= 10) return '夹克或卫衣,别硬扛 🍂'
  if (t >= 0) return '厚外套 / 大衣安排上 🧥'
  return '羽绒服护体,帽子围巾全副武装 🧣🧤'
}

// 定位:浏览器地理定位,失败则回退到北京
const locate = () => new Promise(resolve =>
  navigator.geolocation?.getCurrentPosition(
    p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
    () => resolve({ lat: 39.9, lon: 116.4 }),
    { timeout: 5000 },
  ) ?? resolve({ lat: 39.9, lon: 116.4 })
)

// Open-Meteo 免费无 Key,展示今日天气 + 出门提醒
export default function WeatherCard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const { lat, lon } = await locate()
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`
        )
        if (!res.ok) throw new Error()
        const d = await res.json()
        setData({
          temp: Math.round(d.current?.temperature_2m),
          code: d.current?.weather_code,
          max: Math.round(d.daily?.temperature_2m_max?.[0]),
          min: Math.round(d.daily?.temperature_2m_min?.[0]),
          rain: d.daily?.precipitation_probability_max?.[0] ?? 0,
        })
      } catch { setData({ failed: true }) }
    })()
  }, [])

  const w = data ? (WEATHER[data.code] || fallbackWeather) : fallbackWeather
  const cloth = data && !data.failed ? clothTip(data.temp) : ''
  const rainWarn = data && !data.failed && data.rain >= 50

  return (
    <div className="card p-3 w-100 weather-card" style={{ background: w.bg }}>
      {!data ? (
        <div className="text-center py-3 small" style={{ color: 'rgba(255,255,255,.9)' }}>正在仰望天空… 🔭</div>
      ) : (
        <>
          <div className="d-flex justify-content-between align-items-center mb-1">
            <span className="small fw-semibold" style={{ color: 'rgba(255,255,255,.92)' }}>🌤️ 今日天气</span>
            <span className="small amount" style={{ color: 'rgba(255,255,255,.92)' }}>
              {data.failed ? '--' : `${data.min}° ~ ${data.max}°`}
            </span>
          </div>

          <div className="d-flex align-items-center gap-3">
            <span className="weather-emoji">{w.emoji}</span>
            <div className="flex-grow-1">
              <div className="d-flex align-items-baseline gap-2">
                <span className="fw-bold amount" style={{ fontSize: '2rem', color: '#fff' }}>
                  {data.failed ? '--' : data.temp + '°'}
                </span>
                <span className="small" style={{ color: 'rgba(255,255,255,.92)' }}>{w.text}</span>
              </div>
              <div className="small mt-1" style={{ color: 'rgba(255,255,255,.95)' }}>{w.tip}</div>
              {cloth && <div className="small mt-1" style={{ color: 'rgba(255,255,255,.95)' }}>{cloth}</div>}
            </div>
          </div>

          {rainWarn && (
            <div className="weather-rain-pill mt-2">
              ☔ 降雨概率 {data.rain}%,今天出门记得带伞!
            </div>
          )}
        </>
      )}
    </div>
  )
}
