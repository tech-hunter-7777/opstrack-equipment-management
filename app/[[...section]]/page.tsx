import { notFound } from 'next/navigation';
import { Shell } from '@/components/shell';

const sections = ['dashboard', 'equipment', 'import', 'comparison', 'maintenance', 'issues', 'reports'];
export function generateStaticParams() {
  return [[], ...sections.slice(1).map(section => [section])].map(section => ({ section }));
}

export default async function Page({ params, searchParams }: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ filter?: string; asset?: string; record?: string }>;
}) {
  const parts = (await params).section ?? [];
  const section = parts[0] ?? 'dashboard';
  if (parts.length > 1 || !sections.includes(section)) notFound();
  const query = await searchParams;
  const single = (value?: string) => typeof value === 'string' ? value : undefined;
  return <Shell section={section} params={{ filter: single(query.filter), asset: single(query.asset), record: single(query.record) }} />;
}
