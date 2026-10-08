import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return <main className="content">
    <section className="panel empty">
      <div className="form-stack"><h1>Page not found</h1><p>Check the address or return to your workspace.</p><Button asChild><Link href="/">Open dashboard</Link></Button></div>
    </section>
  </main>;
}
