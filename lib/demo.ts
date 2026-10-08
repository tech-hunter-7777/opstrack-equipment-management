import type { Equipment, Workspace } from './model';

const key = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const demoAsset = key(1);
export const demoIssue = key(501);
const groups = [
  ['Centrifugal Pump', 'Pumps', 'CP', 'North Plant'],
  ['Air Compressor', 'Compressors', 'AC', 'Utility Bay'],
  ['Cooling Tower', 'Cooling', 'CT', 'East Facility'],
  ['Conveyor Drive', 'Material handling', 'CV', 'Assembly Hall'],
  ['Backup Generator', 'Power', 'GN', 'South Plant'],
  ['Hydraulic Press', 'Production', 'HP', 'Assembly Hall'],
];

export function createDemo(): Workspace {
  const equipment: Equipment[] = Array.from({ length: 36 }, (_, index) => {
    const [name, category, prefix, location] = groups[index % groups.length];
    const code = prefix + '-' + (104 + index);
    const offline = [8, 19, 25].includes(index);
    const flagged = [1, 6, 11, 18, 29, 34].includes(index);
    return {
      id: key(index + 1), code, name: name + ' ' + (104 + index), category, location,
      technician: ['Maya Chen', 'Jordan Ellis', 'Luis Rivera', 'Sam Patel'][index % 4],
      status: offline ? 'Out of service' : flagged ? 'Needs attention' : 'Operational',
      health: index === 0 ? 94 : offline ? 46 + index % 6 : flagged ? 70 + index % 12 : 89 + index % 11,
      lastService: index === 0 ? '2026-09-14' : `2026-09-${String(1 + index % 15).padStart(2, '0')}`,
      nextService: `2026-10-${String(4 + index % 24).padStart(2, '0')}`,
    };
  });
  const dates = ['2026-04-16', '2026-05-16', '2026-06-16', '2026-07-16', '2026-08-16', '2026-09-16'];
  const inspections: Workspace['inspections'] = equipment.flatMap((asset, index) =>
    dates.map((date, period) => {
      const condition = index === 0 ? [96, 93, 88, 74, 62, 94][period] : Math.min(100, asset.health + (5 - period) * ((index % 5) - 1));
      return {
        id: key(1000 + index * dates.length + period), assetId: asset.id, date, condition,
        performance: index === 0 ? [97, 94, 89, 77, 65, 96][period] : Math.min(100, condition + index % 6),
        downtime: index === 0 ? [1, 3, 5, 9, 14, 1][period] : Math.round(((index * 7 + period * 3) % 13) * [.18, .26, .20, .32, .31, .14][period] * 10) / 10,
        maintenance: (index === 0 && [3, 4].includes(period)) || (period === 5 && asset.status !== 'Operational') ? 'Scheduled' : 'Completed',
        notes: index === 0 && period === 4 ? 'Bearing seal leak and elevated vibration. Corrective work scheduled.' :
          index === 0 && period === 5 ? 'Post-repair inspection. Vibration back within operating limits.' : '',
      };
    }),
  );
  const maintenance: Workspace['maintenance'] = equipment.slice(0, 25).map((asset, index) => ({
    id: key(300 + index), assetId: asset.id, date: index === 0 ? '2026-09-14' : index < 23 ? asset.lastService : asset.nextService,
    title: index === 0 ? 'Bearing and seal replacement' : index % 2 ? 'Routine service and lubrication' : 'Monthly condition inspection',
    technician: asset.technician, type: index === 0 ? 'Corrective' : index % 2 ? 'Preventive' : 'Inspection',
    status: index < 23 ? 'Completed' : 'Scheduled', condition: asset.health,
    notes: index === 0 ? 'Replaced worn drive-end bearing and damaged seal. Verified alignment under load and returned the pump to service.' :
      index < 23 ? 'Checked mounting hardware, measured vibration, and recorded service readings.' : 'Confirm equipment isolation before service.',
  }));
  const issueSeeds = [
    [8, 'Cooling tower fan vibration', 'Critical', 'P1', 'In progress', 'Fan imbalance and bearing noise.'],
    [19, 'Compressor pressure loss', 'High', 'P1', 'Open', 'Discharge pressure dropped below minimum.'],
    [25, 'Motor temperature above limit', 'High', 'P2', 'Open', 'Temperature exceeded the shutdown threshold.'],
    [11, 'Hydraulic pressure fluctuation', 'Medium', 'P2', 'In progress', 'Intermittent pressure variation under load.'],
    [1, 'Air filter restriction', 'Medium', 'P3', 'Open', 'Filter differential pressure is above target.'],
    [34, 'Intermittent controller warning', 'Low', 'P4', 'Open', 'Warning observed during weekly test.'],
    [0, 'Drive-end bearing leak', 'High', 'P2', 'Resolved', 'A damaged seal allowed oil to leak from the bearing housing.'],
  ] as const;
  const issues: Workspace['issues'] = issueSeeds.map(([index, title, severity, priority, status, cause], offset) => ({
    id: index === 0 ? demoIssue : key(510 + offset), assetId: equipment[index].id,
    date: index === 0 ? '2026-08-16' : `2026-09-${17 - offset}`, title, severity, priority, status, cause,
    resolution: index === 0 ? 'Bearing and seal replaced on Sep 14. Post-repair inspection restored condition from 62% to 94%.' : '',
  }));
  return {
    equipment, inspections, maintenance, issues,
    evidence: [{ id: key(601), name: 'CP-104 bearing seal.jpg', recordId: demoIssue, path: '/bearing-seal.jpg' }],
  };
}
