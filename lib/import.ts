import type { Equipment, Inspection } from './model';
import { inspectionSchema } from './model';

export const requiredColumns = ['equipment_code', 'date', 'condition', 'performance', 'downtime_hours', 'maintenance_status'] as const;
export const columns = [...requiredColumns, 'notes'];
export const sampleCsv = columns.join(',') + '\nCP-104,2026-09-19,95,97,0.5,Completed,Follow-up inspection\n';
type Preview = { rows: Omit<Inspection, 'id'>[]; errors: string[] };

export function validateImport(matrix: unknown[][], equipment: Equipment[], existing: Inspection[] = []): Preview {
  const [header = [], ...body] = matrix;
  const headers = header.map(value => String(value ?? '').trim().toLowerCase().replace(/^\uFEFF/, ''));
  const missing = requiredColumns.filter(name => !headers.includes(name));
  if (missing.length) return { rows: [], errors: [`Missing columns: ${missing.join(', ')}.`] };
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) {
    return { rows: [], errors: ['Column names must be unique.'] };
  }
  if (body.length > 5000) return { rows: [], errors: ['Import up to 5,000 rows at a time.'] };
  const assets = new Map(equipment.map(asset => [asset.code.toLowerCase(), asset.id]));
  const seen = new Set(existing.map(row => `${row.assetId}/${row.date}`));
  const rows: Preview['rows'] = [];
  const errors: string[] = [];

  body.forEach((cells, index) => {
    const values = cells.map(value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').trim());
    if (!values.some(Boolean)) return;
    const field = (name: string) => values[headers.indexOf(name)] || '';
    const numeric = (name: string) => /^\d+(\.\d+)?$/.test(field(name)) ? Number(field(name)) : NaN;
    const assetId = assets.get(field('equipment_code').toLowerCase());
    const date = field('date');
    const rowLabel = `Row ${index + 2}`;
    if (!assetId) {
      errors.push(`${rowLabel}: unknown equipment code ${field('equipment_code') || '(blank)'}.`);
      return;
    }
    const rawStatus = field('maintenance_status').toLowerCase();
    const parsed = inspectionSchema.safeParse({
      assetId, date, condition: numeric('condition'), performance: numeric('performance'), downtime: numeric('downtime_hours'),
      maintenance: rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1), notes: field('notes'),
    });
    if (!parsed.success) {
      errors.push(`${rowLabel}: check ${parsed.error.issues.map(issue => issue.path.join('.')).join(', ')}.`);
      return;
    }
    const identity = `${assetId}/${date}`;
    if (seen.has(identity)) {
      errors.push(`${rowLabel}: an inspection already exists for this asset and date.`);
      return;
    }
    seen.add(identity);
    rows.push(parsed.data);
  });

  if (!rows.length && !errors.length) errors.push('The file has no inspection rows.');
  return { rows, errors };
}

export async function parseFile(file: File): Promise<unknown[][]> {
  if (file.size > 5 * 1024 * 1024) throw new Error('The file exceeds the 5 MB limit.');
  if (/\.xlsx$/i.test(file.name)) {
    const { default: ExcelJS } = await import('exceljs');
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await file.arrayBuffer());
    const sheet = book.worksheets[0];
    if (!sheet) return [];
    if (sheet.rowCount > 5001 || sheet.columnCount > 64) throw new Error('Use at most 5,000 data rows and 64 columns.');
    return Array.from({ length: sheet.rowCount }, (_, index) => {
      const row = sheet.getRow(index + 1);
      return Array.from({ length: row.cellCount }, (_, column) => {
        const cell = row.getCell(column + 1);
        return cell.value instanceof Date ? cell.value : cell.text;
      });
    });
  }
  if (!/\.csv$/i.test(file.name)) throw new Error('Select a CSV or Excel (.xlsx) file.');
  const { default: Papa } = await import('papaparse');
  const parsed = Papa.parse<string[]>(await file.text(), { delimiter: ',' });
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);
  return parsed.data;
}
