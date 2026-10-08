'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} aria-labelledby={id} className="modal" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="modal-heading"><h2 id={id}>{title}</h2><Button type="button" variant="ghost" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></Button></div>
    <div className="modal-body">{children}</div>
  </dialog>;
}
