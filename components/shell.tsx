'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Activity, Bell, Boxes, ChartNoAxesCombined, ChevronsUpDown, ClipboardList, FileBarChart, FlaskConical, LayoutDashboard, LogIn, LogOut, Menu, ShieldAlert, UploadCloud, X } from 'lucide-react';
import { useWorkspace, supabase } from '@/lib/workspace';
import { currentEquipment } from '@/lib/model';
import { Dashboard } from './dashboard';
import { Registry } from './registry';
import { ImportPanel } from './import-panel';
import { Comparison } from './comparison';
import { Reports } from './reports';
import { Button } from './ui/button';
import { Modal } from './ui/modal';

const links = [
  ['dashboard', 'Dashboard', LayoutDashboard], ['equipment', 'Equipment', Boxes], ['import', 'Data Import', UploadCloud],
  ['comparison', 'Performance Comparison', ChartNoAxesCombined], ['maintenance', 'Maintenance Logs', ClipboardList],
  ['issues', 'Issues', ShieldAlert], ['reports', 'Reports', FileBarChart],
] as const;

export function Shell({ section, params }: { section: string; params: { filter?: string; asset?: string; record?: string } }) {
  const workspace = useWorkspace();
  const [mobile, setMobile] = useState(false);
  const [auth, setAuth] = useState(false);
  const [register, setRegister] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const demo = !workspace.session;
  const label = links.find(([slug]) => slug === section)?.[1];
  const displayData = { ...workspace.data, equipment: currentEquipment(workspace.data) };

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setMessage('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const credentials = { email: String(form.get('email')), password: String(form.get('password')) };
    try {
      const result = register ? await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: window.location.origin } }) :
        await supabase.auth.signInWithPassword(credentials);
      if (result.error) throw new Error(result.error.message);
      if (result.data.session) setAuth(false);
      else setMessage('Check your email to confirm your account.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      setAuth(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sign-out failed.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="shell">
    {mobile && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobile(false)} />}
    <aside className={`sidebar ${mobile ? 'sidebar-open' : ''}`}>
      <Link className="brand" href="/" onClick={() => setMobile(false)}><span className="brand-mark"><Activity size={24} strokeWidth={2.4} /></span><div><strong>OpsTrack</strong><small>Equipment Operations</small></div></Link>
      <div className="workspace-label"><span className="workspace-icon"><Boxes size={17} /></span><div><strong>{demo ? 'Demo workspace' : 'My workspace'}</strong><small>{demo ? 'Sample fleet' : 'Private fleet'}</small></div></div>
      <nav aria-label="Primary navigation">
        <p>WORKSPACE</p>
        {links.map(([slug, name, Icon]) => <Link key={slug} href={slug === 'dashboard' ? '/' : '/' + slug} className={section === slug ? 'nav-active' : ''} aria-current={section === slug ? 'page' : undefined} onClick={() => setMobile(false)}><Icon size={18} strokeWidth={1.75} /><span>{name}</span></Link>)}
      </nav>
      <div className="sidebar-bottom">
        {demo && <div className="demo-note"><FlaskConical size={17} /><div><strong>Demo mode</strong><small>Changes stay in this browser.</small></div></div>}
        <button className="profile" onClick={() => { setMessage(''); setAuth(true); }}><span className="avatar">{demo ? 'OP' : (workspace.session?.user.email?.slice(0, 2).toUpperCase() ?? 'OP')}</span><span><strong>{demo ? 'Demo Operator' : workspace.session?.user.email}</strong><small>{demo ? 'Local workspace' : 'Supabase account'}</small></span><ChevronsUpDown size={15} /></button>
      </div>
    </aside>
    <div className="main-column">
      <header className="topbar">
        <div className="breadcrumbs"><Button className="menu-toggle" variant="ghost" aria-label={mobile ? 'Close navigation' : 'Open navigation'} onClick={() => setMobile(!mobile)}>{mobile ? <X size={20} /> : <Menu size={20} />}</Button><span className="crumb-root">Workspace</span><span className="crumb-slash">/</span><strong>{label}</strong></div>
        <div className="top-actions">{demo && <span className="demo-pill"><FlaskConical size={13} /> Demo mode</span>}<Link href="/issues?filter=active" className="top-icon" aria-label="View active issues"><Bell size={19} />{workspace.data.issues.some(issue => issue.status !== 'Resolved') && <i />}</Link><button className="avatar top-avatar" aria-label="Account" onClick={() => { setMessage(''); setAuth(true); }}>{demo ? 'OP' : (workspace.session?.user.email?.slice(0, 2).toUpperCase() ?? 'OP')}</button></div>
      </header>
      <main className="content" id="main" key={workspace.session?.user.id ?? 'demo'}>
        {workspace.error && <div className="notice error" role="alert">{workspace.error} <Button variant="outline" onClick={workspace.retry}>Retry</Button></div>}
        {!workspace.ready ? <div className="panel empty" role="status">{workspace.error ? 'Workspace unavailable' : 'Loading workspace…'}</div> :
          section === 'dashboard' ? <Dashboard data={displayData} demo={demo} /> :
          section === 'import' ? <ImportPanel workspace={workspace} /> :
          section === 'comparison' ? <Comparison key={params.asset} data={displayData} initialAsset={params.asset} /> :
          section === 'reports' ? <Reports data={displayData} /> :
          <Registry key={section + ':' + (params.filter ?? '') + ':' + (params.record ?? '')} kind={section as 'equipment' | 'maintenance' | 'issues'} workspace={workspace} filter={params.filter} recordId={params.record} displayEquipment={displayData.equipment} />}
        <footer className="footer"><span>OpsTrack · Equipment Maintenance & Operations</span>{demo && <span>Sample data</span>}</footer>
      </main>
    </div>
    {auth && <Modal title={demo ? (register ? 'Create an account' : 'Workspace sign-in') : 'Your account'} onClose={() => setAuth(false)}>
      {!demo ? <div className="form-stack"><p>{workspace.session?.user.email}</p>{message && <p role="alert">{message}</p>}<Button disabled={busy} onClick={signOut}><LogOut size={16} /> {busy ? 'Signing out…' : 'Sign out to demo'}</Button></div> :
        supabase ? <form onSubmit={authenticate} className="form-stack">
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : undefined} required /></label>
          {message && <div className="notice" role="status">{message}</div>}
          <Button disabled={busy}><LogIn size={16} />{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</Button>
          <Button type="button" variant="ghost" onClick={() => { setRegister(!register); setMessage(''); }}>{register ? 'Already have an account? Sign in' : 'Create an account'}</Button>
        </form> : <div className="form-stack"><p>This instance is running the local demo. Configure Supabase to enable private accounts and cloud storage.</p><Button asChild variant="outline"><a href="https://supabase.com/docs/guides/auth" target="_blank" rel="noreferrer">Supabase setup</a></Button></div>}
    </Modal>}
  </div>;
}
