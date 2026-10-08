'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Boxes, CalendarDays, ClipboardCheck, Download, HeartPulse, Radio, ShieldAlert } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from './ui/button';
import { demoAsset } from '@/lib/demo';
import { formatDate, metrics, type Workspace } from '@/lib/model';

export function Badge({ label }: { label: string }) {
  const tone = ['Operational', 'Resolved', 'Completed', 'Low'].includes(label) ? 'green' :
    ['Critical', 'Out of service', 'P1'].includes(label) ? 'red' :
      ['Needs attention', 'High', 'Scheduled', 'Medium', 'P2'].includes(label) ? 'amber' : 'blue';
  return <span className={`badge ${tone}`}><i />{label}</span>;
}

export function Dashboard({ data, demo }: { data: Workspace; demo: boolean }) {
  const [period, setPeriod] = useState(6);
  const stat = metrics(data);
  const monthly = new Map<string, number>();
  for (const inspection of data.inspections) {
    const month = inspection.date.slice(0, 7);
    monthly.set(month, (monthly.get(month) || 0) + inspection.downtime);
  }
  const latestMonth = [...monthly.keys()].sort().at(-1);
  const end = latestMonth ? new Date(latestMonth + '-01T12:00:00Z') : null;
  const trend = end ? Array.from({ length: period }, (_, index) => {
    const date = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - period + index + 1, 1));
    const key = date.toISOString().slice(0, 7);
    const total = monthly.get(key);
    return { label: formatDate(key + '-01', { day: undefined, year: undefined }), hours: total === undefined ? null : Math.round(total * 10) / 10 };
  }) : [];
  const current = trend.at(-1)?.hours;
  const previous = trend.at(-2)?.hours;
  const change = current != null && previous ? Math.round((current - previous) / previous * 100) : null;
  const statuses = [
    { label: 'Operational', value: stat.healthy, color: '#0b846d' },
    { label: 'Needs attention', value: stat.attention, color: '#eca846' },
    { label: 'Out of service', value: stat.offline, color: '#ec737d' },
  ];
  const cards = [
    { label: 'Total equipment', value: stat.total, note: `${new Set(data.equipment.map(item => item.location)).size} locations tracked`, icon: Boxes, tone: 'blue', url: '/equipment' },
    { label: 'Average health', value: stat.total ? stat.health + '%' : '—', note: 'Across all registered assets', icon: HeartPulse, tone: 'green', url: '/equipment' },
    { label: 'Maintenance completion', value: data.maintenance.length ? stat.completion + '%' : '—', note: `${stat.completed} of ${data.maintenance.length} jobs completed`, icon: ClipboardCheck, tone: 'violet', url: '/maintenance' },
    { label: 'Open issues', value: stat.open.length, note: `${stat.highRisk.length} high or critical severity`, icon: AlertTriangle, tone: 'amber', url: '/issues?filter=active' },
  ];

  return <>
    <section className="page-head">
      <div><p className="eyebrow"><span /> OPERATIONS CENTER</p><h1>Operations overview</h1><p className="subtitle">Monitor equipment health, maintenance, and operational risk.</p></div>
      <Button asChild variant="outline"><Link href="/reports"><Download size={16} /> Export report</Link></Button>
    </section>

    <section className="hero" aria-label="Fleet overview">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-art" aria-hidden="true"><div /><div /><div /><Activity size={42} strokeWidth={1.35} /><i /><i /><i /></div>
      <div className="hero-copy">
        <p className="hero-label"><Radio size={15} /> FLEET MONITOR</p>
        <h2>Fleet health at a glance</h2>
        <p>{stat.total ? <><strong>{stat.healthy} of {stat.total} assets</strong> are operating normally across your facilities.</> : 'Add equipment to start tracking the condition of your fleet.'}</p>
        <Button asChild className="hero-button"><Link href={demo ? `/comparison?asset=${demoAsset}` : '/equipment'}>{demo ? 'Explore recovery case' : 'View equipment'}</Link></Button>
      </div>
      {latestMonth && <div className="hero-date"><CalendarDays size={14} /> Latest reporting period <strong>{formatDate(latestMonth + '-01', { day: undefined, month: 'long' })}</strong></div>}
    </section>

    <div className="kpi-grid">
      {cards.map(({ label, value, note, icon: Icon, tone, url }) => <Link key={label} href={url} className="panel kpi">
        <div className="kpi-top"><span className={`metric-icon ${tone}`}><Icon size={18} /></span><ArrowUpRight className="kpi-arrow" size={16} /></div>
        <p>{label}</p><strong>{value}</strong><small>{note}</small>
      </Link>)}
    </div>

    <div className="dashboard-grid">
      <section className="panel chart-panel">
        <div className="panel-heading"><div><h2>Downtime trend</h2><p>Recorded equipment downtime by month</p></div>
          <select aria-label="Downtime period" value={period} onChange={event => setPeriod(Number(event.target.value))}><option value={6}>Last 6 months</option><option value={3}>Last 3 months</option></select>
        </div>
        {trend.length ? <>
          <div className="chart-totals"><strong>{current} <small>hrs</small></strong>{change !== null && <span className={`trend-chip ${change > 0 ? 'up' : ''}`}>{change > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(change)}% vs prior month</span>}</div>
          <div className="chart-area" aria-label="Area chart of monthly downtime">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 580, height: 157 }}>
              <AreaChart data={trend} margin={{ top: 5, right: 10, bottom: 0, left: -14 }}>
                <defs><linearGradient id="downtime-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#12a78d" stopOpacity={.25} /><stop offset="100%" stopColor="#12a78d" stopOpacity={.02} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#e8edf2" strokeDasharray="4 4" />
                <XAxis dataKey="label" tick={{ fill: '#69788d', fontSize: 12 }} tickLine={false} axisLine={false} dy={7} />
                <YAxis tick={{ fill: '#69788d', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={value => value + 'h'} />
                <Tooltip formatter={value => [value + ' hrs', 'Downtime']} contentStyle={{ borderRadius: 10, borderColor: '#dce5ec' }} />
                <Area dataKey="hours" type="monotone" fill="url(#downtime-fill)" stroke="#07866e" strokeWidth={2.5} dot={{ r: 3, fill: 'white', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </> : <div className="empty">Import inspections to see downtime trends.</div>}
      </section>
      <section className="panel health-panel">
        <div className="panel-heading"><div><h2>Equipment status</h2><p>Current availability across the fleet</p></div></div>
        <div className="donut" aria-label={`${stat.healthy} operational, ${stat.attention} needs attention, ${stat.offline} out of service`}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 260, height: 154 }}>
            <PieChart><Pie data={stat.total ? statuses.filter(item => item.value) : [{ label: 'No equipment', value: 1, color: '#e8edf2' }]} dataKey="value" nameKey="label" innerRadius={52} outerRadius={72} paddingAngle={stat.total ? 4 : 0} cornerRadius={4} startAngle={90} endAngle={-270} stroke="none">
              {(stat.total ? statuses.filter(item => item.value) : [{ label: 'Empty', color: '#e8edf2' }]).map(item => <Cell key={item.label} fill={item.color} />)}
            </Pie><Tooltip /></PieChart>
          </ResponsiveContainer>
          <div className="donut-label"><strong>{stat.total}</strong><span>Total assets</span></div>
        </div>
        <div className="legend">{statuses.map(item => <Link key={item.label} href={`/equipment?filter=${encodeURIComponent(item.label)}`}><span><i style={{ background: item.color }} />{item.label}</span><strong>{item.value}</strong></Link>)}</div>
      </section>
    </div>

    <section className="panel risk-panel">
      <div className="panel-heading"><div className="risk-title"><span className="metric-icon amber"><ShieldAlert size={19} /></span><div><h2>Operational risk alerts</h2><p>High-severity issues that need attention</p></div></div>
        <Button asChild variant="ghost"><Link href="/issues?filter=active">View all issues</Link></Button>
      </div>
      {stat.highRisk.length ? <div className="table-scroll"><table><thead><tr><th>Issue</th><th>Equipment</th><th>Severity</th><th>Status</th></tr></thead><tbody>
        {[...stat.highRisk].sort((first, second) => first.priority.localeCompare(second.priority) || second.date.localeCompare(first.date)).map(issue => <tr key={issue.id}><td><Link className="text-link" href={`/issues?record=${issue.id}`}>{issue.title}</Link></td><td>{data.equipment.find(asset => asset.id === issue.assetId)?.code}</td><td><Badge label={issue.severity} /></td><td><Badge label={issue.status} /></td></tr>)}
      </tbody></table></div> : <div className="empty">No active high or critical issues.</div>}
    </section>
  </>;
}
