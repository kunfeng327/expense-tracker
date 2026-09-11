import React, { useEffect, useState, useRef } from 'react'
import * as echarts from 'echarts'
import { api, fmt, monthShift } from '../api.js'

const PALETTE = ['#6366f1', '#8b5cf6', '#f43f5e', '#f97316', '#10b981', '#0ea5e9', '#eab308', '#ec4899']

export default function Stats() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [stats, setStats] = useState({ summary: { expense: 0, income: 0 }, by_category: [], by_day: [] })
  const pieRef = useRef(null)
  const lineRef = useRef(null)
  const barRef = useRef(null)
  const charts = useRef({})

  useEffect(() => {
    charts.current.pie = echarts.init(pieRef.current)
    charts.current.line = echarts.init(lineRef.current)
    charts.current.bar = echarts.init(barRef.current)
    const onResize = () => Object.values(charts.current).forEach(c => c.resize())
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); Object.values(charts.current).forEach(c => c.dispose()) }
  }, [])

  useEffect(() => { api.getStats(month).then(setStats) }, [month])

  useEffect(() => {
    const { pie, line, bar } = charts.current
    if (!pie) return

    pie.setOption({
      color: PALETTE,
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11, color: '#64748b' } },
      series: [{
        type: 'pie', radius: ['42%', '68%'],
        center: ['50%', '44%'],
        data: stats.by_category,
        label: { formatter: '{d}%', fontSize: 11, color: '#64748b' },
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      }],
    })

    line.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 50, right: 20, bottom: 30, top: 20 },
      xAxis: {
        type: 'category', data: stats.by_day.map(d => d.date.slice(8)),
        axisLine: { lineStyle: { color: '#cbd5e1' } }, axisLabel: { color: '#94a3b8' },
      },
      yAxis: {
        type: 'value', splitLine: { lineStyle: { color: 'rgba(148,163,184,.15)' } },
        axisLabel: { color: '#94a3b8' },
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

    bar.setOption({
      tooltip: {},
      grid: { left: 70, right: 50, bottom: 20, top: 10 },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(148,163,184,.15)' } }, axisLabel: { color: '#94a3b8' } },
      yAxis: {
        type: 'category', data: stats.by_category.map(d => d.name).reverse(),
        axisLabel: { color: '#475569', interval: 0 }, axisLine: { show: false }, axisTick: { show: false },
      },
      series: [{
        type: 'bar', data: stats.by_category.map(d => d.value).reverse(), barMaxWidth: 18,
        itemStyle: {
          borderRadius: [0, 9, 9, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#8b5cf6' }, { offset: 1, color: '#6366f1' },
          ]),
        },
        label: { show: true, position: 'right', color: '#64748b', fontSize: 11, fontStyle: 'italic', formatter: p => fmt(p.value) },
      }],
    })
  }, [stats])

  const { expense, income } = stats.summary

  return (
    <>
      <div className="month-nav mb-4">
        <button onClick={() => setMonth(m => monthShift(m, -1))}>‹</button>
        <div className="flex-grow-1 text-center fw-semibold">
          {month.split('-')[0]} 年 {Number(month.split('-')[1])} 月
        </div>
        <button onClick={() => setMonth(m => monthShift(m, 1))}>›</button>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-4"><div className="stat-card stat-expense text-center">
          <div className="label">总支出</div><div className="value amount">{fmt(expense)}</div></div></div>
        <div className="col-4"><div className="stat-card stat-income text-center">
          <div className="label">总收入</div><div className="value amount">{fmt(income)}</div></div></div>
        <div className="col-4"><div className="stat-card stat-balance text-center">
          <div className="label">结余</div><div className="value amount">{fmt(income - expense)}</div></div></div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <div className="card chart-card h-100">
            <div className="chart-title"><span className="dot" />分类占比</div>
            <div ref={pieRef} style={{ height: 300 }} />
          </div>
        </div>
        <div className="col-md-6">
          <div className="card chart-card h-100">
            <div className="chart-title"><span className="dot" />每日支出趋势</div>
            <div ref={lineRef} style={{ height: 300 }} />
          </div>
        </div>
      </div>
      <div className="card chart-card mb-3">
        <div className="chart-title"><span className="dot" />分类排行</div>
        <div ref={barRef} style={{ height: 40 + stats.by_category.length * 40 }} />
      </div>
    </>
  )
}
