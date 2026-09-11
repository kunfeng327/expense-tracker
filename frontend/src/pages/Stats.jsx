import React, { useEffect, useState, useRef } from 'react'
import * as echarts from 'echarts'
import { api, fmt, monthShift } from '../api.js'

const PALETTE = ['#6366f1', '#8b5cf6', '#f43f5e', '#f97316', '#10b981', '#0ea5e9', '#eab308', '#ec4899']

export default function Stats() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [stats, setStats] = useState({ summary: { expense: 0, income: 0 }, by_category: [], by_day: [] })
  const pieRef = useRef(null)
  const lineRef = useRef(null)
  const charts = useRef({})

  useEffect(() => {
    charts.current.pie = echarts.init(pieRef.current)
    charts.current.line = echarts.init(lineRef.current)
    const onResize = () => Object.values(charts.current).forEach(c => c.resize())
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); Object.values(charts.current).forEach(c => c.dispose()) }
  }, [])

  useEffect(() => { api.getStats(month).then(setStats) }, [month])

  useEffect(() => {
    const { pie, line } = charts.current
    if (!pie) return

    pie.setOption({
      color: PALETTE,
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 6, itemWidth: 12, itemHeight: 12, itemGap: 14, textStyle: { fontSize: 13, color: '#64748b' } },
      series: [{
        type: 'pie', radius: ['42%', '68%'],
        center: ['50%', '44%'],
        data: stats.by_category,
        label: { formatter: '{b}\n{d}%', fontSize: 13, color: '#475569', lineHeight: 18 },
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      }],
    })

    line.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 56, right: 24, bottom: 34, top: 26 },
      xAxis: {
        type: 'category', data: stats.by_day.map(d => d.date.slice(8)),
        axisLine: { lineStyle: { color: '#cbd5e1' } }, axisLabel: { color: '#94a3b8', fontSize: 12 },
      },
      yAxis: {
        type: 'value', splitLine: { lineStyle: { color: 'rgba(148,163,184,.15)' } },
        axisLabel: { color: '#94a3b8', fontSize: 12 },
      },
      series: [{
        type: 'line', smooth: true, data: stats.by_day.map(d => d.value),
        symbolSize: 7, lineStyle: { width: 3, color: '#6366f1' }, itemStyle: { color: '#6366f1' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(99,102,241,.28)' },
            { offset: 1, color: 'rgba(99,102,241,0)' },
          ]),
        },
      }],
    })
  }, [stats])

  const { expense, income } = stats.summary

  return (
    <div className="stagger d-flex flex-column">
      <div className="month-nav mb-4">
        <button onClick={() => setMonth(m => monthShift(m, -1))}>‹</button>
        <div className="flex-grow-1 text-center fw-semibold">
          {month.split('-')[0]} 年 {Number(month.split('-')[1])} 月
        </div>
        <button onClick={() => setMonth(m => monthShift(m, 1))}>›</button>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-4"><div className="stat-card stat-expense text-center">
          <div className="label">总支出</div><div className="value amount">{fmt(expense)}</div></div></div>
        <div className="col-4"><div className="stat-card stat-income text-center">
          <div className="label">总收入</div><div className="value amount">{fmt(income)}</div></div></div>
        <div className="col-4"><div className="stat-card stat-balance text-center">
          <div className="label">结余</div><div className="value amount">{fmt(income - expense)}</div></div></div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-md-6">
          <div className="card chart-card h-100">
            <div className="chart-title"><span className="dot" />分类占比</div>
            <div ref={pieRef} style={{ height: 320 }} />
          </div>
        </div>
        <div className="col-md-6">
          <div className="card chart-card h-100">
            <div className="chart-title"><span className="dot" />每日支出趋势</div>
            <div ref={lineRef} style={{ height: 320 }} />
          </div>
        </div>
      </div>
    </div>
  )
}
