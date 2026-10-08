'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import { createDemo } from './demo';
import { emptyWorkspace, schemas, type Evidence, type Kind, type Records, type Workspace } from './model';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && publishableKey ? createClient(url, publishableKey) : null;
const demoKey = 'opstrack-demo-v1';
const mimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

async function loadWorkspace(owner: string): Promise<Workspace> {
  if (!supabase) return emptyWorkspace;
  const client = supabase;
  const tables = ['equipment', 'inspections', 'maintenance', 'issues', 'evidence'] as const;
  const results = await Promise.all(tables.map(async table => {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.from(table).select('*').eq('user_id', owner).order('id').range(offset, offset + 499);
      if (error) throw new Error(error.message);
      rows.push(...data);
      if (data.length < 500) return rows;
    }
  }));
  const [equipment, inspections, maintenance, issues, files] = results;
  return {
    equipment: equipment.map(asset => ({ ...asset, lastService: asset.lastService ?? '', nextService: asset.nextService ?? '' })) as Workspace['equipment'],
    inspections: inspections as Workspace['inspections'],
    maintenance: maintenance as Workspace['maintenance'],
    issues: issues as Workspace['issues'],
    evidence: files.map(file => ({ id: file.id, recordId: file.issue_id ?? file.maintenance_id, name: file.name, path: file.path })),
  };
}

export function useWorkspace() {
  const [demo, setDemo] = useState(createDemo);
  const demoState = useRef(demo);
  const [cloud, setCloud] = useState<{ owner: string; data: Workspace } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(!supabase);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const owner = session?.user.id;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(demoKey);
      if (raw) {
        demoState.current = JSON.parse(raw) as Workspace;
        setDemo(demoState.current);
      }
    } catch {
      setError('Local demo data could not be loaded.');
    }
    const listener = supabase?.auth.onAuthStateChange((_event, current) => {
      setSession(current);
      if (!current) setCloud(null);
      setInitialized(true);
    });
    return () => listener?.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!owner) return;
    let active = true;
    loadWorkspace(owner).then(data => {
      if (active) setCloud({ owner, data });
    }).catch(reason => {
      if (active) setError(reason.message);
    });
    return () => { active = false; };
  }, [owner, attempt]);

  const data = owner ? cloud?.owner === owner ? cloud.data : emptyWorkspace : demo;
  const ready = initialized && (!owner || cloud?.owner === owner);

  function persist(change: (current: Workspace) => Workspace) {
    if (owner) {
      setCloud(current => current?.owner === owner ? { owner, data: change(current.data) } : current);
    } else {
      const next = change(demoState.current);
      localStorage.setItem(demoKey, JSON.stringify(next));
      demoState.current = next;
      setDemo(next);
    }
  }

  async function write<K extends Kind>(kind: K, records: Records[K][], edit = false) {
    if (!ready) throw new Error('Wait for the workspace to finish loading.');
    const validated = records.map(record => ({ ...schemas[kind].parse(record), id: record.id })) as Records[K][];
    if (kind === 'equipment') {
      const asset = validated[0] as Records['equipment'];
      if (data.equipment.some(other => other.id !== asset.id && other.code.toLowerCase() === asset.code.toLowerCase())) {
        throw new Error('An asset already uses this equipment code.');
      }
    }
    if (owner && supabase) {
      const payload = validated.map(row => {
        const values = { ...row, user_id: owner };
        if (kind !== 'equipment') return values;
        const asset = row as Records['equipment'];
        return { ...values, lastService: asset.lastService || null, nextService: asset.nextService || null };
      });
      const query = edit ? supabase.from(kind).update(payload[0]).eq('id', validated[0].id).eq('user_id', owner) :
        supabase.from(kind).insert(payload);
      const result = edit ? await query.select('id').single() : await query;
      if (result.error) throw new Error(result.error.message);
    }
    const incoming = new Map(validated.map(row => [row.id, row]));
    persist(current => ({
      ...current, [kind]: [...current[kind].filter(row => !incoming.has(row.id)), ...validated],
    }));
  }

  async function remove(kind: Kind, id: string) {
    if (kind === 'equipment' && [...data.inspections, ...data.issues, ...data.maintenance].some(row => row.assetId === id)) {
      throw new Error('This asset has inspection, maintenance, or issue history and cannot be deleted.');
    }
    if (data.evidence.some(file => file.recordId === id)) throw new Error('Remove the attached evidence before deleting this record.');
    if (owner && supabase) {
      const { error } = await supabase.from(kind).delete().eq('id', id).eq('user_id', owner).select('id').single();
      if (error) throw new Error(error.message);
    }
    persist(current => ({ ...current, [kind]: current[kind].filter(row => row.id !== id) }));
  }

  async function upload(kind: 'issues' | 'maintenance', recordId: string, file: File) {
    if (!mimeTypes.includes(file.type) || file.size > 10 * 1024 * 1024 || !file.size) {
      throw new Error('Choose a JPG, PNG, WebP, or PDF up to 10 MB.');
    }
    const id = crypto.randomUUID();
    const name = file.name.slice(0, 255);
    let path: string;
    if (owner && supabase) {
      path = `${owner}/${recordId}/${id}`;
      const storage = supabase.storage.from('evidence');
      const sent = await storage.upload(path, file, { contentType: file.type });
      if (sent.error) throw new Error(sent.error.message);
      const saved = await supabase.from('evidence').insert({
        id, path, name, user_id: owner, [kind === 'issues' ? 'issue_id' : 'maintenance_id']: recordId,
      });
      if (saved.error) {
        await storage.remove([path]);
        throw new Error(saved.error.message);
      }
    } else {
      if (file.size > 2 * 1024 * 1024) throw new Error('Demo attachments are limited to 2 MB per file.');
      path = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('The file could not be read.'));
        reader.readAsDataURL(file);
      });
    }
    persist(current => ({ ...current, evidence: [...current.evidence, { id, name, recordId, path }] }));
  }

  async function removeEvidence(file: Evidence) {
    if (owner && supabase) {
      const result = await supabase.storage.from('evidence').remove([file.path]);
      if (result.error) throw new Error(result.error.message);
      const removed = await supabase.from('evidence').delete().eq('id', file.id).eq('user_id', owner).select('id').single();
      if (removed.error) throw new Error(removed.error.message);
    }
    persist(current => ({ ...current, evidence: current.evidence.filter(item => item.id !== file.id) }));
  }

  async function evidenceUrl(file: Evidence) {
    if (!owner) return file.path;
    if (!supabase) throw new Error('Supabase is unavailable.');
    const { data, error } = await supabase.storage.from('evidence').createSignedUrl(file.path, 120);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  }

  function retry() {
    setError('');
    setAttempt(value => value + 1);
  }

  return { data, session, ready, error, retry, write, remove, upload, removeEvidence, evidenceUrl };
}

export type WorkspaceController = ReturnType<typeof useWorkspace>;
