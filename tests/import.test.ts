import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { createDemo } from '../lib/demo';
import { columns, parseFile, sampleCsv, validateImport } from '../lib/import';

const demo = createDemo();
const valid = ['CP-104', '2026-09-19', '95', '97', '0.5', 'completed', 'Checked vibration'];

test('maps normalized spreadsheet headers and resolves equipment codes', () => {
  const header = columns.map(value => ' ' + value.toUpperCase() + ' ');
  const result = validateImport([header, ['cp-104', ...valid.slice(1)]], demo.equipment);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].assetId, demo.equipment[0].id);
  assert.equal(result.rows[0].downtime, 0.5);
  assert.equal(result.rows[0].maintenance, 'Completed');
});

test('rejects missing and duplicate headers', () => {
  assert.match(validateImport([['date']], demo.equipment).errors[0], /Missing columns/);
  assert.match(validateImport([[...columns, 'date']], demo.equipment).errors[0], /unique/);
});

test('reports row numbers and rejects unknown assets, malformed dates, blank numbers, and out-of-range scores', () => {
  const result = validateImport([columns, ['MISSING', ...valid.slice(1)], ['CP-104', '2026-02-30', '101', '', '-2', 'Paused'], valid], demo.equipment);
  assert.equal(result.rows.length, 1);
  assert.match(result.errors[0], /^Row 2: unknown equipment/);
  assert.match(result.errors[1], /^Row 3: check date, condition, performance, downtime, maintenance/);
});

test('rejects existing and repeated asset and date pairs', () => {
  const result = validateImport([columns, ['CP-104', '2026-09-16', ...valid.slice(2)], valid, valid], demo.equipment, demo.inspections);
  assert.equal(result.rows.length, 1);
  assert.deepEqual(result.errors.map(message => message.slice(0, 5)), ['Row 2', 'Row 4']);
});

test('parses the downloadable CSV template and handles quoted cells', async () => {
  const content = sampleCsv.replace('Follow-up inspection', '"Follow-up, no leak"');
  const matrix = await parseFile(new File([content], 'template.csv'));
  const result = validateImport(matrix, demo.equipment);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].notes, 'Follow-up, no leak');
});

test('reads numeric cells and native Excel dates from the first worksheet', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Inspections');
  sheet.addRow(columns);
  sheet.addRow(['CP-104', new Date('2026-09-19T00:00:00Z'), 95, 97, 0.5, 'Completed', '']);
  const stored = await workbook.xlsx.writeBuffer();
  const matrix = await parseFile(new File([new Uint8Array(stored)], 'inspection.xlsx'));
  const result = validateImport(matrix, demo.equipment);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].date, '2026-09-19');
});
