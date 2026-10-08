'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Activity, ArrowRight, ChartNoAxesCombined, Clock, HeartPulse } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from './ui/button';
import { Badge } from './dashboard';
import { compareInspections, formatDate, type Workspace } from '@/lib/model';

export function Comparison({ data, initialAsset }: { data: Workspace; initialAsset?: string }) {
  const [assetId, setAssetId] = useState(initialAsset ?? '');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const asset = data.equipment.find(item => item.id === assetId) ?? data.equipment[0];
  const history = data.inspections.filter(item => item.assetId === asset?.id).sort((first, second) => first.date.localeCompare(second.date));
  const before = history.find(item => item.date === start) ?? history.at(-2);
  const after = history.find(item => item.date === end) ?? history.at(-1);
  const delta = before && after && before.date < after.date ? compareInspections(before, after) : null;
  const relatedIssues = data.issues.filter(issue => issue.assetId === asset?.id).sort((first, second) => second.date.localeCompare(first.date));
  const relatedLogs = data.maintenance.filter(log => log.assetId === asset?.id).sort((first, second) => second.date.localeCompare(first.date));
  const timeline = history.map(item => ({ ...item, label: formatDate(item.date, { year: undefined }) }));
  const comparisons = before && after && delta ? [
    { label: 'Condition', from: before.condition, to: after.condition, change: delta.condition, unit: '%', deltaUnit: ' pts', icon: HeartPulse, lower: false },
    { label: 'Performance', from: before.performance, to: after.performance, change: delta.performance, unit: '%', deltaUnit: ' pts', icon: Activity, lower: false },
    { label: 'Downtime', from: before.downtime, to: after.downtime, change: delta.downtime, unit: ' h', deltaUnit: ' h', icon: Clock, lower: true },
  ] : [];

  return <>
    <section className="page-head"><div><h1>Performance Comparison</h1><p className="subtitle">Compare inspections and trace changes in asset condition over time.</p></div><Button asChild variant="outline"><Link href="/import">Import inspections</Link></Button></section>
    {!asset ? <div className="panel empty">Add equipment and import inspections to start comparing performance.</div> : <>
      <section className="panel standard-panel compare-controls">
        <label>Equipment<select value={asset.id} onChange={event => { setAssetId(event.target.value); setStart(''); setEnd(''); }}>{data.equipment.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
        <label>Baseline inspection<select disabled={history.length < 2} value={before?.date ?? ''} onChange={event => setStart(event.target.value)}>{history.length < 2 && <option value="">No baseline</option>}{history.slice(0, -1).map(item => <option key={item.id} value={item.date}>{formatDate(item.date)}</option>)}</select></label>
        <label>Comparison inspection<select disabled={history.length < 2} value={after?.date ?? ''} onChange={event => setEnd(event.target.value)}>{!history.length && <option value="">No inspections</option>}{(history.length < 2 ? history : history.slice(1)).map(item => <option key={item.id} value={item.date}>{formatDate(item.date)}</option>)}</select></label>
      </section>
      {!delta ? <div className="panel empty" role="status">{history.length < 2 ? 'This asset needs at least two inspections.' : 'Choose a baseline date earlier than the comparison date.'}</div> : before && after && <>
        <div className="kpi-grid compare-kpis">
          {comparisons.map(({ label, from, to, change, unit, deltaUnit, lower, icon: Icon }) => <section key={label} className="panel kpi"><div className="kpi-top"><span className="metric-icon green"><Icon size={18} /></span></div><p>{label}</p><div className="comparison-value"><strong>{from}{unit}</strong><ArrowRight size={17} /><strong>{to}{unit}</strong></div><small className={change === 0 ? '' : (lower ? change < 0 : change > 0) ? 'positive' : 'negative'}>{change > 0 ? '+' : ''}{change}{deltaUnit}</small></section>)}
          <section className="panel kpi"><div className="kpi-top"><span className="metric-icon violet"><ChartNoAxesCombined size={18} /></span></div><p>Maintenance status</p><div className="comparison-value"><Badge label={before.maintenance} /><ArrowRight size={15} /><Badge label={after.maintenance} /></div><small>{delta.maintenanceChanged ? 'Status changed' : 'Same status in both inspections'}</small></section>
        </div>
        {(before.notes || after.notes) && <section className="panel standard-panel"><div className="panel-heading"><h2>Inspection notes</h2></div><div className="note-grid">{[before, after].map(item => <div key={item.id}><strong>{formatDate(item.date)}</strong><p>{item.notes || 'No notes recorded.'}</p></div>)}</div></section>}
      </>}
      {timeline.length > 0 && <section className="panel standard-panel">
        <div className="panel-heading"><div><h2>Inspection history</h2><p>Condition and performance scores for {asset.code}</p></div><div className="line-legend"><span>Condition</span><span>Performance</span></div></div>
        <div className="history-chart"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 225 }}><LineChart data={timeline} margin={{ top: 14, right: 12, left: -14, bottom: 2 }}>
          <CartesianGrid vertical={false} stroke="#e8edf2" strokeDasharray="4 4" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64758a' }} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={value => value + '%'} tick={{ fontSize: 12, fill: '#64758a' }} />
          <Tooltip formatter={(value, name) => [value + '%', name === 'condition' ? 'Condition' : 'Performance']} labelFormatter={(_label, points) => points[0]?.payload?.date ? formatDate(points[0].payload.date) : ''} />
          <Line dataKey="condition" type="monotone" stroke="#07866e" strokeWidth={2.5} dot={{ r: 3 }} /><Line dataKey="performance" type="monotone" stroke="#6a69b9" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart></ResponsiveContainer></div>
        <div className="table-scroll"><table><thead><tr><th>Inspection date</th><th>Condition</th><th>Performance</th><th>Downtime</th><th>Maintenance</th></tr></thead><tbody>{[...history].reverse().map(item => <tr key={item.id}><td>{formatDate(item.date)}</td><td>{item.condition}%</td><td>{item.performance}%</td><td>{item.downtime} h</td><td><Badge label={item.maintenance} /></td></tr>)}</tbody></table></div>
      </section>}
      <div className="split-grid">
        <section className="panel standard-panel"><div className="panel-heading"><h2>Related issues</h2></div>{relatedIssues.length ? relatedIssues.map(issue => <Link className="related-row" href={`/issues?record=${issue.id}`} key={issue.id}><span><strong>{issue.title}</strong><small>{formatDate(issue.date)} · {data.evidence.filter(item => item.recordId === issue.id).length} attachments</small></span><Badge label={issue.status} /></Link>) : <p className="muted">No issues linked to this asset.</p>}</section>
        <section className="panel standard-panel"><div className="panel-heading"><h2>Maintenance history</h2></div>{relatedLogs.length ? relatedLogs.map(log => <Link className="related-row" href={`/maintenance?record=${log.id}`} key={log.id}><span><strong>{log.title}</strong><small>{formatDate(log.date)} · {log.technician}</small></span><Badge label={log.status} /></Link>) : <p className="muted">No maintenance logged for this asset.</p>}</section>
      </div>
    </>}
  </>;
}
