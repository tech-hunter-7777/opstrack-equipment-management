'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { maintenancePdf, workspaceCsv } from '@/lib/export';
import { metrics, type Workspace } from '@/lib/model';

const exports = [
  ['equipment', 'Equipment register', 'Asset assignments, current condition, and service dates.'],
  ['maintenance', 'Maintenance logs', 'Inspection, preventive, and corrective work records.'],
  ['issues', 'Issue register', 'Fault severity, status, causes, and resolution notes.'],
  ['inspections', 'Inspection history', 'Condition, performance, and downtime readings.'],
] as const;

export function Reports({ data }: { data: Workspace }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [asset, setAsset] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const invalid = Boolean(start && end && start > end);
  const matches = (row: { date: string; assetId: string }) => (!asset || row.assetId === asset) && (!start || row.date >= start) && (!end || row.date <= end);
  const scoped = {
    ...data,
    equipment: data.equipment.filter(item => !asset || item.id === asset),
    maintenance: data.maintenance.filter(matches),
    issues: data.issues.filter(matches),
    inspections: data.inspections.filter(matches),
  };
  const stats = metrics(scoped);

  async function run(kind: (typeof exports)[number][0] | 'pdf') {
    setBusy(kind);
    setError('');
    setMessage('');
    try {
      if (kind === 'pdf') {
        const location = data.equipment.find(item => item.id === asset)?.code ?? 'All equipment';
        await maintenancePdf(scoped, `${location} | ${start || 'Any start date'} to ${end || 'Any end date'}`);
      } else await workspaceCsv(scoped, kind);
      setMessage('Your report download has started.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Report generation failed.');
    } finally {
      setBusy('');
    }
  }

  return <>
    <section className="page-head"><div><h1>Reports</h1><p className="subtitle">Download fleet records and maintenance summaries.</p></div></section>
    <section className="panel standard-panel compare-controls">
      <label>Equipment<select value={asset} onChange={event => setAsset(event.target.value)}><option value="">All equipment</option>{data.equipment.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
      <label>From date<input type="date" value={start} onChange={event => setStart(event.target.value)} /></label>
      <label>Through date<input type="date" value={end} onChange={event => setEnd(event.target.value)} /></label>
      <p className="muted full-field">Date filters apply to maintenance logs, issues, and inspections.</p>
    </section>
    {(invalid || error) && <div className="notice error" role="alert">{invalid ? 'The end date must be on or after the start date.' : error}</div>}
    {message && <div className="notice success" role="status">{message}</div>}
    <section className="panel standard-panel">
      <div className="panel-heading report-heading"><div className="risk-title"><span className="metric-icon violet"><FileText size={20} /></span><div><h2>Maintenance summary</h2><p>{scoped.maintenance.length} work records · {stats.completed} completed</p></div></div>
        <Button disabled={invalid || Boolean(busy)} onClick={() => void run('pdf')}><Download size={16} />{busy === 'pdf' ? 'Generating…' : 'Download PDF'}</Button></div>
    </section>
    <section className="panel standard-panel">
      <div className="panel-heading"><div><h2>CSV exports</h2><p>Download the selected records as spreadsheets.</p></div></div>
      {exports.map(([kind, label, detail]) => <div className="related-row export-row" key={kind}><span className="risk-title"><span className="metric-icon green"><FileSpreadsheet size={18} /></span><span><strong>{label}</strong><small>{scoped[kind].length} records · {detail}</small></span></span><Button variant="outline" disabled={invalid || Boolean(busy)} onClick={() => void run(kind)}><Download size={15} /> {busy === kind ? 'Exporting…' : 'CSV'}</Button></div>)}
    </section>
  </>;
}
