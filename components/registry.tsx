'use client';

import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Boxes, CircleAlert, ClipboardList, FileText, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { Badge } from './dashboard';
import { Button } from './ui/button';
import { Modal } from './ui/modal';
import { formatDate, issueStatuses, maintenanceStatuses, priorities, severities, statuses, type Equipment, type Records } from '@/lib/model';
import type { WorkspaceController } from '@/lib/workspace';

type RegistryKind = 'equipment' | 'maintenance' | 'issues';
type Row = Records[RegistryKind];

const metadata = {
  equipment: { title: 'Equipment', description: 'Manage asset details, service schedules, and fleet condition.', add: 'Add equipment', noun: 'asset', icon: Boxes, filters: statuses },
  maintenance: { title: 'Maintenance Logs', description: 'Track inspections, preventive service, and completed repairs.', add: 'Log maintenance', noun: 'maintenance log', icon: ClipboardList, filters: maintenanceStatuses },
  issues: { title: 'Issues', description: 'Prioritize equipment faults and track corrective actions.', add: 'Report issue', noun: 'issue', icon: CircleAlert, filters: ['active', ...issueStatuses] },
};

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function Registry({ kind, workspace, filter, recordId, displayEquipment }: {
  kind: RegistryKind; workspace: WorkspaceController; filter?: string; recordId?: string; displayEquipment: Equipment[];
}) {
  const config = metadata[kind];
  const Icon = config.icon;
  const rows: Row[] = kind === 'equipment' ? displayEquipment : workspace.data[kind];
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(filter && config.filters.some(value => value === filter) ? filter : '');
  const [location, setLocation] = useState('');
  const [editing, setEditing] = useState<Row | 'new' | null>(() => rows.find(row => row.id === recordId) ?? null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [openedFile, setOpenedFile] = useState<{ name: string; url: string } | null>(null);
  const assetMap = new Map(displayEquipment.map(asset => [asset.id, asset]));
  const visible = rows.filter(row => {
    const asset = 'assetId' in row ? assetMap.get(row.assetId) : row;
    const text = [asset?.name, asset?.code, asset?.location, asset?.technician, 'title' in row ? row.title : row.category].join(' ').toLowerCase();
    return text.includes(search.trim().toLowerCase()) && (!location || asset?.location === location) &&
      (!status || (status === 'active' ? row.status !== 'Resolved' : row.status === status));
  }).sort((first, second) => 'date' in first && 'date' in second ? second.date.localeCompare(first.date) :
    'code' in first && 'code' in second ? first.code.localeCompare(second.code) : 0);

  const record = editing !== 'new' ? editing : null;
  const rawEquipment = record && 'code' in record ? workspace.data.equipment.find(asset => asset.id === record.id) ?? record : null;
  const attachments = record ? workspace.data.evidence.filter(file => file.recordId === record.id) : [];
  const headings = kind === 'equipment' ? ['Equipment', 'Location', 'Technician', 'Status', 'Health', 'Next service'] :
    kind === 'maintenance' ? ['Maintenance activity', 'Equipment', 'Technician', 'Date', 'Status', 'Condition'] :
      ['Issue', 'Equipment', 'Severity', 'Priority', 'Reported', 'Status'];

  function open(row: Row | 'new') {
    setError('');
    setConfirm(false);
    setOpenedFile(null);
    setEditing(row);
  }

  async function perform(operation: () => Promise<void>, close = false) {
    setBusy(true);
    setError('');
    try {
      await operation();
      if (close) setEditing(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The operation failed.');
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '');
    const id = record?.id ?? crypto.randomUUID();
    const edit = Boolean(record);
    void perform(async () => {
      if (kind === 'equipment') {
        await workspace.write('equipment', [{
          id, code: value('code'), name: value('name'), location: value('location'), category: value('category'),
          technician: value('technician'), health: Number(value('health')), status: value('status') as Equipment['status'],
          lastService: value('lastService'), nextService: value('nextService'),
        }], edit);
      } else if (kind === 'maintenance') {
        await workspace.write('maintenance', [{
          id, title: value('title'), assetId: value('assetId'), date: value('date'), technician: value('technician'),
          type: value('type') as Records['maintenance']['type'], status: value('status') as Records['maintenance']['status'],
          condition: Number(value('condition')), notes: value('notes'),
        }], edit);
      } else {
        await workspace.write('issues', [{
          id, title: value('title'), assetId: value('assetId'), date: value('date'),
          severity: value('severity') as Records['issues']['severity'], priority: value('priority') as Records['issues']['priority'],
          status: value('status') as Records['issues']['status'], cause: value('cause'), resolution: value('resolution'),
        }], edit);
      }
    }, true);
  }

  return <>
    <section className="page-head"><div><h1>{config.title}</h1><p className="subtitle">{config.description}</p></div>
      <Button disabled={kind !== 'equipment' && !displayEquipment.length} onClick={() => open('new')}><Plus size={17} /> {config.add}</Button>
    </section>
    <section className="panel registry">
      <div className="toolbar">
        <label className="search"><Search size={17} /><input aria-label={`Search ${config.title.toLowerCase()}`} placeholder={`Search ${config.title.toLowerCase()}…`} value={search} onChange={event => setSearch(event.target.value)} /></label>
        <select aria-label="Filter by status" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{config.filters.map(item => <option key={item} value={item}>{item === 'active' ? 'Active issues' : item}</option>)}</select>
        <select aria-label="Filter by location" value={location} onChange={event => setLocation(event.target.value)}><option value="">All locations</option>{[...new Set(displayEquipment.map(asset => asset.location))].sort().map(item => <option key={item}>{item}</option>)}</select>
      </div>
      {visible.length ? <div className="table-scroll"><table><thead><tr>{headings.map(heading => <th key={heading}>{heading}</th>)}<th><span className="sr-only">Edit</span></th></tr></thead>
        <tbody>{visible.map(row => {
          const asset = 'assetId' in row ? assetMap.get(row.assetId) : row;
          return <tr key={row.id}>
            <td><button className="record-link" onClick={() => open(row)}><span className="metric-icon blue"><Icon size={16} /></span><span><strong>{'title' in row ? row.title : row.name}</strong><small>{'code' in row ? row.code + ' · ' + row.category : 'type' in row ? row.type : workspace.data.evidence.filter(file => file.recordId === row.id).length + ' attachments'}</small></span></button></td>
            {'code' in row ? <>
              <td>{row.location}</td><td>{row.technician}</td><td><Badge label={row.status} /></td>
              <td><div className="health-value"><progress value={row.health} max={100} aria-label="Health" /><strong>{row.health}%</strong></div></td><td>{formatDate(row.nextService)}</td>
            </> : 'type' in row ? <>
              <td>{asset?.code}</td><td>{row.technician}</td><td>{formatDate(row.date)}</td><td><Badge label={row.status} /></td><td>{row.condition}%</td>
            </> : <>
              <td>{asset?.code}</td><td><Badge label={row.severity} /></td><td>{row.priority}</td><td>{formatDate(row.date)}</td><td><Badge label={row.status} /></td>
            </>}
            <td><Button type="button" aria-label={`Edit ${'title' in row ? row.title : row.name}`} variant="ghost" className="icon-button" onClick={() => open(row)}><Pencil size={15} /></Button></td>
          </tr>;
        })}</tbody></table></div> : <div className="empty">{rows.length ? 'No records match these filters.' : kind !== 'equipment' && !displayEquipment.length ? 'Add equipment before creating records.' : 'No records yet.'}</div>}
      <div className="registry-footer">{visible.length} of {rows.length} {kind === 'equipment' ? 'assets' : 'records'}</div>
    </section>

    {editing && <Modal title={record ? `Edit ${config.noun}` : config.add} onClose={() => { if (!busy) setEditing(null); }}>
      <form className="form-stack" onSubmit={save}>
        <div className="form-grid">
          {kind === 'equipment' ? <>
            <Field label="Equipment name" name="name" value={rawEquipment?.name} /><Field label="Equipment code" name="code" value={rawEquipment?.code} />
            <Field label="Category" name="category" value={rawEquipment?.category} /><Field label="Location" name="location" value={rawEquipment?.location} />
            <Field label="Assigned technician" name="technician" value={rawEquipment?.technician} /><Select label="Status" name="status" options={statuses} value={rawEquipment?.status} />
            <Field label="Baseline health (%)" name="health" type="number" value={rawEquipment?.health ?? 100} />
            <Field label="Last service date" name="lastService" type="date" value={rawEquipment?.lastService} optional />
            <Field label="Next service date" name="nextService" type="date" value={rawEquipment?.nextService} optional />
          </> : <>
            <Field label="Title" name="title" value={record && 'title' in record ? record.title : undefined} />
            <label>Equipment<select name="assetId" defaultValue={record && 'assetId' in record ? record.assetId : ''} required><option value="">Select equipment</option>{displayEquipment.map(asset => <option key={asset.id} value={asset.id}>{asset.code} · {asset.name}</option>)}</select></label>
            <Field label={kind === 'issues' ? 'Reported date' : 'Service date'} name="date" type="date" value={record && 'date' in record ? record.date : today()} />
            {kind === 'maintenance' ? <>
              <Select label="Type" name="type" options={['Inspection', 'Preventive', 'Corrective']} value={record && 'type' in record ? record.type : undefined} />
              <Field label="Technician" name="technician" value={record && 'type' in record ? record.technician : undefined} />
              <Select label="Status" name="status" options={maintenanceStatuses} value={record && 'type' in record ? record.status : undefined} />
              <Field label="Condition (%)" name="condition" type="number" value={record && 'condition' in record ? record.condition : 100} />
              <Notes name="notes" label="Technician notes" value={record && 'notes' in record ? record.notes : undefined} />
            </> : <>
              <Select label="Severity" name="severity" options={severities} value={record && 'severity' in record ? record.severity : 'Medium'} />
              <Select label="Priority" name="priority" options={priorities} value={record && 'priority' in record ? record.priority : 'P3'} />
              <Select label="Status" name="status" options={issueStatuses} value={record && 'cause' in record ? record.status : undefined} />
              <Notes name="cause" label="Reported cause" value={record && 'cause' in record ? record.cause : undefined} />
              <Notes name="resolution" label="Resolution notes" value={record && 'resolution' in record ? record.resolution : undefined} />
            </>}
          </>}
        </div>
        {record && kind !== 'equipment' && <section className="attachments">
          <h3>Evidence</h3>
          {attachments.map(file => <div className="attachment-row" key={file.id}><Button variant="ghost" type="button" disabled={busy} onClick={() => void perform(async () => setOpenedFile({ name: file.name, url: await workspace.evidenceUrl(file) }))}><FileText size={16} /> {file.name}</Button><Button variant="ghost" className="icon-button" type="button" aria-label={`Remove ${file.name}`} disabled={busy} onClick={() => void perform(async () => { await workspace.removeEvidence(file); setOpenedFile(null); })}><Trash2 size={15} /></Button></div>)}
          {openedFile && <div className="attachment-preview">{/\.(jpe?g|png|webp)$/i.test(openedFile.name) ? <img src={openedFile.url} alt={openedFile.name} /> : <a className="text-link" href={openedFile.url} download={openedFile.name} target={openedFile.url.startsWith('data:') ? undefined : '_blank'} rel="noreferrer">Download {openedFile.name}</a>}</div>}
          <label className="file-control"><Upload size={15} /> Attach photo or PDF<input type="file" aria-label="Attach photo or PDF" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={event => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void perform(() => workspace.upload(kind, record.id, file));
          }} /></label>
        </section>}
        {editing === 'new' && kind !== 'equipment' && <p className="muted">Save the record, then reopen it to attach evidence.</p>}
        {error && <div className="notice error" role="alert">{error}</div>}
        {confirm && <div className="notice error" role="alert">Permanently delete this {config.noun}? <Button type="button" variant="danger" disabled={busy} onClick={() => record && void perform(() => workspace.remove(kind, record.id), true)}>Confirm delete</Button></div>}
        <div className="modal-actions">
          {record && <Button type="button" variant="ghost" className="delete-button" disabled={busy} onClick={() => setConfirm(!confirm)}><Trash2 size={16} /> Delete</Button>}
          {rawEquipment && <Button asChild variant="ghost"><Link href={`/comparison?asset=${rawEquipment.id}`}>Inspection history</Link></Button>}
          <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
          <Button disabled={busy}>{busy ? 'Working…' : 'Save record'}</Button>
        </div>
      </form>
    </Modal>}
  </>;
}

function Field({ label, name, value, type = 'text', optional = false }: { label: string; name: string; value?: string | number; type?: string; optional?: boolean }) {
  return <label>{label}<input name={name} type={type} defaultValue={value} required={!optional} maxLength={type === 'text' ? 160 : undefined} min={type === 'number' ? 0 : undefined} max={type === 'number' ? 100 : undefined} step={type === 'number' ? 'any' : undefined} /></label>;
}

function Select({ label, name, options, value }: { label: string; name: string; options: readonly string[]; value?: string }) {
  return <label>{label}<select name={name} defaultValue={value ?? options[0]}>{options.map(option => <option key={option}>{option}</option>)}</select></label>;
}

function Notes({ name, label, value }: { name: string; label: ReactNode; value?: string }) {
  return <label className="full-field">{label}<textarea rows={3} name={name} defaultValue={value} maxLength={5000} /></label>;
}
