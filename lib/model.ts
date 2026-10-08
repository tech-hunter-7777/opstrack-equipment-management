import { z } from 'zod';

export const statuses = ['Operational', 'Needs attention', 'Out of service'] as const;
export const severities = ['Low', 'Medium', 'High', 'Critical'] as const;
export const priorities = ['P1', 'P2', 'P3', 'P4'] as const;
export const issueStatuses = ['Open', 'In progress', 'Resolved'] as const;
export const maintenanceStatuses = ['Scheduled', 'Completed'] as const;

const shortText = z.string().trim().min(1).max(160);
const notes = z.string().trim().max(5000);
const score = z.number().min(0).max(100);
const nullableDate = z.union([z.iso.date(), z.literal('')]);
const id = z.uuid();
export const equipmentSchema = z.object({
  code: shortText, name: shortText, category: shortText, location: shortText, technician: shortText,
  status: z.enum(statuses), health: score, lastService: nullableDate, nextService: nullableDate,
});
export const inspectionSchema = z.object({
  assetId: id, date: z.iso.date(), condition: score, performance: score,
  downtime: z.number().min(0).max(8760), maintenance: z.enum(maintenanceStatuses), notes,
});
export const maintenanceSchema = z.object({
  assetId: id, date: z.iso.date(), title: shortText, technician: shortText,
  type: z.enum(['Inspection', 'Preventive', 'Corrective']), status: z.enum(maintenanceStatuses),
  condition: score, notes,
});
export const issueSchema = z.object({
  assetId: id, date: z.iso.date(), title: shortText, severity: z.enum(severities),
  priority: z.enum(priorities), status: z.enum(issueStatuses), cause: notes, resolution: notes,
});
export const schemas = { equipment: equipmentSchema, inspections: inspectionSchema, maintenance: maintenanceSchema, issues: issueSchema };
export type Records = { [K in keyof typeof schemas]: z.infer<(typeof schemas)[K]> & { id: string } };
export type Kind = keyof Records;
export type Equipment = Records['equipment'];
export type Inspection = Records['inspections'];
export type Maintenance = Records['maintenance'];
export type Issue = Records['issues'];
export type Evidence = { id: string; recordId: string; name: string; path: string };
export type Workspace = { [K in Kind]: Records[K][] } & { evidence: Evidence[] };
export const emptyWorkspace: Workspace = { equipment: [], inspections: [], maintenance: [], issues: [], evidence: [] };

export function compareInspections(before: Inspection, after: Inspection) {
  if (before.assetId !== after.assetId || before.date >= after.date) {
    throw new Error('Select two dates in chronological order for the same equipment.');
  }
  const delta = (first: number, second: number) => Math.round((second - first) * 100) / 100;
  return {
    condition: delta(before.condition, after.condition),
    performance: delta(before.performance, after.performance),
    downtime: delta(before.downtime, after.downtime),
    maintenanceChanged: before.maintenance !== after.maintenance,
  };
}

export function metrics(data: Workspace) {
  const total = data.equipment.length;
  const healthy = data.equipment.filter(asset => asset.status === 'Operational').length;
  const attention = data.equipment.filter(asset => asset.status === 'Needs attention').length;
  const offline = total - healthy - attention;
  const completed = data.maintenance.filter(log => log.status === 'Completed').length;
  const open = data.issues.filter(issue => issue.status !== 'Resolved');
  return {
    total, healthy, attention, offline, completed, open,
    health: total ? Math.round(data.equipment.reduce((sum, asset) => sum + asset.health, 0) / total) : 0,
    completion: data.maintenance.length ? Math.round(completed / data.maintenance.length * 100) : 0,
    highRisk: open.filter(issue => issue.severity === 'Critical' || issue.severity === 'High'),
  };
}

export function formatDate(date: string, options?: Intl.DateTimeFormatOptions) {
  return date ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...options, timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z')) : '—';
}

export function currentEquipment(data: Workspace): Equipment[] {
  const latest = new Map<string, { date: string; health: number }>();
  const observations = [
    ...data.maintenance.filter(log => log.status === 'Completed').map(log => ({ ...log, health: log.condition })),
    ...data.inspections.map(inspection => ({ ...inspection, health: inspection.condition })),
  ];
  for (const observation of observations) {
    const previous = latest.get(observation.assetId);
    if (!previous || previous.date <= observation.date) latest.set(observation.assetId, observation);
  }
  return data.equipment.map(asset => {
    const observation = latest.get(asset.id);
    if (!observation || observation.date <= asset.lastService || observation.health === asset.health) return asset;
    const health = observation.health;
    return { ...asset, health, status: health < 60 ? 'Out of service' : health < 85 ? 'Needs attention' : 'Operational' };
  });
}
