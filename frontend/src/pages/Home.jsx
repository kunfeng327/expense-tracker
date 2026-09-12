import React from 'react'
import PokemonCard from '../components/PokemonCard.jsx'
import WeatherCard from '../components/WeatherCard.jsx'
import WordCard from '../components/WordCard.jsx'
import JapaneseCard from '../components/JapaneseCard.jsx'
import NoteCard from '../components/NoteCard.jsx'
import ListeningCard from '../components/ListeningCard.jsx'
import ArtCard from '../components/ArtCard.jsx'

// 账本首页:只放每日小卡片;记账入口、汇总、记录条目统一在统计页
export default function Home() {
  return (
    <div className="stagger d-flex flex-column">
      {/* 天气 / 单词 / 宝可梦 / 随想 / 日语 / 听力 / 名画:卡片墙 */}
      <div className="row g-2 align-items-stretch">
        <div className="col-12 col-sm-6 d-flex"><WeatherCard /></div>
        <div className="col-12 col-sm-6 d-flex"><WordCard /></div>
        <div className="col-12 col-sm-6 d-flex"><PokemonCard /></div>
        <div className="col-12 col-sm-6 d-flex"><NoteCard /></div>
        <div className="col-12 col-sm-6 d-flex"><JapaneseCard /></div>
        <div className="col-12 col-sm-6 d-flex"><ListeningCard /></div>
        <div className="col-12 d-flex"><ArtCard /></div>
      </div>
    </div>
  )
}
