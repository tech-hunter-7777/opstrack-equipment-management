import type { Workspace } from './model';

export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function maintenancePdf(data: Workspace, label: string) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(22);
  doc.setTextColor(11, 79, 69);
  doc.text('OpsTrack | Maintenance summary', 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(70, 84, 100);
  doc.text(label, 14, 27);
  doc.text(`${data.maintenance.length} records | ${data.maintenance.filter(log => log.status === 'Completed').length} completed`, 14, 34);
  const assets = new Map(data.equipment.map(asset => [asset.id, asset.code]));
  autoTable(doc, {
    startY: 42,
    head: [['Date', 'Asset', 'Work performed', 'Technician', 'Status', 'Condition', 'Notes']],
    body: data.maintenance.map(log => [log.date, assets.get(log.assetId) ?? '', log.title, log.technician, log.status, log.condition + '%', log.notes]),
    headStyles: { fillColor: [11, 115, 96] },
    styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    columnStyles: { 6: { cellWidth: 85 } },
  });
  doc.save('opstrack-maintenance-summary.pdf');
}

export async function workspaceCsv(data: Workspace, kind: 'equipment' | 'maintenance' | 'issues' | 'inspections') {
  const { default: Papa } = await import('papaparse');
  const assets = new Map(data.equipment.map(asset => [asset.id, asset.code]));
  const fields = {
    equipment: ['code', 'name', 'category', 'location', 'technician', 'status', 'health', 'lastService', 'nextService'],
    maintenance: ['equipment_code', 'date', 'title', 'technician', 'type', 'status', 'condition', 'notes'],
    issues: ['equipment_code', 'date', 'title', 'severity', 'priority', 'status', 'cause', 'resolution'],
    inspections: ['equipment_code', 'date', 'condition', 'performance', 'downtime_hours', 'maintenance_status', 'notes'],
  }[kind];
  const rows = data[kind].map(record => {
    const row: Record<string, unknown> = { ...record };
    if ('assetId' in record) row.equipment_code = assets.get(record.assetId) ?? '';
    if ('downtime' in record) {
      row.downtime_hours = record.downtime;
      row.maintenance_status = record.maintenance;
    }
    return fields.map(field => row[field]);
  });
  downloadText(`opstrack-${kind}.csv`, Papa.unparse({ fields, data: rows }, { escapeFormulae: true }));
}
