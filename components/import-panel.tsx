'use client';

import { useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './dashboard';
import { downloadText } from '@/lib/export';
import { parseFile, requiredColumns, sampleCsv, validateImport } from '@/lib/import';
import { formatDate } from '@/lib/model';
import type { WorkspaceController } from '@/lib/workspace';

export function ImportPanel({ workspace }: { workspace: WorkspaceController }) {
  const [filename, setFilename] = useState('');
  const [matrix, setMatrix] = useState<unknown[][] | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const preview = matrix ? validateImport(matrix, workspace.data.equipment, workspace.data.inspections) : null;

  async function choose(file?: File) {
    if (!file || busy) return;
    setFilename(file.name);
    setBusy(true);
    setMatrix(null);
    setError('');
    setSuccess('');
    try {
      setMatrix(await parseFile(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The file could not be read.');
    } finally {
      setBusy(false);
    }
  }

  async function importRows() {
    if (!preview?.rows.length || preview.errors.length || busy) return;
    setBusy(true);
    setError('');
    try {
      await workspace.write('inspections', preview.rows.map(row => ({ ...row, id: crypto.randomUUID() })));
      setSuccess(`Imported ${preview.rows.length} inspections from ${filename}.`);
      setMatrix(null);
      setFilename('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The import could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <section className="page-head"><div><h1>Data Import</h1><p className="subtitle">Validate and upload equipment inspections from CSV or Excel.</p></div><Button variant="outline" onClick={() => downloadText('opstrack-inspection-template.csv', sampleCsv)}><Download size={16} /> Download template</Button></section>
    <div className="split-grid">
      <section className="panel standard-panel">
        <div className="panel-heading"><div><h2>Upload inspection data</h2><p>Choose a CSV or .xlsx file up to 5 MB.</p></div></div>
        <label className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(!busy); }} onDragLeave={() => setDragging(false)} onDrop={event => {
          event.preventDefault(); setDragging(false); void choose(event.dataTransfer.files[0]);
        }}><span className="metric-icon green"><UploadCloud size={23} /></span><strong>{busy ? 'Working…' : filename || 'Drop a spreadsheet or browse files'}</strong><small>CSV or Excel · up to 5,000 rows</small><input type="file" accept=".csv,.xlsx" aria-label="Upload inspection file" disabled={busy} onChange={event => {
          void choose(event.currentTarget.files?.[0]); event.currentTarget.value = '';
        }} /></label>
        {error && <p className="notice error" role="alert">{error}</p>}
        {success && <p className="notice success" role="status"><CheckCircle2 size={18} /> {success}</p>}
      </section>
      <section className="panel standard-panel">
        <div className="panel-heading"><div><h2>File requirements</h2><p>Use the first worksheet for Excel imports.</p></div><FileSpreadsheet size={20} /></div>
        <div className="column-list">{requiredColumns.map(column => <code key={column}>{column}</code>)}<code>notes (optional)</code></div>
        <p className="muted">Use a registered asset code, dates as YYYY-MM-DD, condition and performance from 0 to 100, positive or zero downtime hours, and Scheduled or Completed maintenance.</p>
      </section>
    </div>
    {preview && <section className="panel standard-panel preview-panel">
      <div className="panel-heading"><div><h2>Import preview</h2><p>{preview.rows.length} valid rows · {preview.errors.length} errors{preview.rows.length > 12 ? ' · Showing first 12' : ''}</p></div>
        <Button disabled={busy || Boolean(preview.errors.length) || !preview.rows.length} onClick={importRows}><UploadCloud size={16} /> {busy ? 'Importing…' : `Import ${preview.rows.length} rows`}</Button></div>
      {!!preview.errors.length && <div className="notice error" role="alert"><strong>Fix these errors and upload the file again.</strong><ul>{preview.errors.slice(0, 15).map(message => <li key={message}>{message}</li>)}</ul>{preview.errors.length > 15 && <small>Showing the first 15 errors.</small>}</div>}
      {!!preview.rows.length && <div className="table-scroll"><table><thead><tr>{['Equipment', 'Inspection date', 'Condition', 'Performance', 'Downtime', 'Maintenance'].map(item => <th key={item}>{item}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 12).map(row => <tr key={row.assetId + row.date}><td>{workspace.data.equipment.find(item => item.id === row.assetId)?.code}</td><td>{formatDate(row.date)}</td><td>{row.condition}%</td><td>{row.performance}%</td><td>{row.downtime} h</td><td><Badge label={row.maintenance} /></td></tr>)}</tbody></table></div>}
    </section>}
  </>;
}
