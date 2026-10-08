import assert from 'node:assert/strict';
import test from 'node:test';
import { createDemo, demoAsset, demoIssue } from '../lib/demo';
import { compareInspections, currentEquipment, metrics } from '../lib/model';

const demo = createDemo();
const history = demo.inspections.filter(item => item.assetId === demoAsset);
const august = history[4];
const september = history[5];

test('calculates deterioration and post-repair improvement with signed deltas', () => {
  assert.deepEqual(compareInspections(history[2], august), { condition: -26, performance: -24, downtime: 9, maintenanceChanged: true });
  assert.deepEqual(compareInspections(august, september), { condition: 32, performance: 31, downtime: -13, maintenanceChanged: true });
});

test('rounds fractional deltas and handles identical readings', () => {
  const first = { ...august, downtime: 0.1 };
  const second = { ...first, date: september.date, downtime: 0.3 };
  assert.deepEqual(compareInspections(first, second), { condition: 0, performance: 0, downtime: 0.2, maintenanceChanged: false });
});

test('requires different dates in order and the same asset', () => {
  assert.throws(() => compareInspections(september, august), /chronological order/);
  assert.throws(() => compareInspections(august, august), /chronological order/);
  assert.throws(() => compareInspections(august, { ...september, assetId: demo.equipment[1].id }), /same equipment/);
});

test('derives fleet health when a new inspection supersedes the baseline', () => {
  const data = { ...demo, inspections: [...demo.inspections, { ...september, date: '2026-09-19', condition: 55 }] };
  const equipment = currentEquipment(data);
  assert.equal(equipment.find(asset => asset.id === demoAsset)?.status, 'Out of service');
  assert.equal(equipment.find(asset => asset.id === demoAsset)?.health, 55);
  assert.equal(metrics({ ...data, equipment }).offline, metrics(demo).offline + 1);
  assert.ok(!metrics(demo).open.some(issue => issue.id === demoIssue));
});
