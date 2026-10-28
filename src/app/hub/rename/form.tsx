'use client';

import { useActionState } from 'react';
import { requestRename } from '../actions';

export function RenameForm() {
  const [state, run, pending] = useActionState(requestRename, undefined);
  return (
    <form action={run} className="space-y-3">
      <label className="block text-sm">
        <span className="block font-bold mb-1">Old handle</span>
        <input name="old" required autoCapitalize="none" spellCheck={false} placeholder="@old_handle" className="field" />
      </label>
      <label className="block text-sm">
        <span className="block font-bold mb-1">New handle</span>
        <input name="new" required autoCapitalize="none" spellCheck={false} placeholder="@new_handle" className="field" />
      </label>
      <button className="btn w-full" disabled={pending}>{pending ? 'Sending…' : 'Update my handle'}</button>
      {state?.error && <p role="alert" className="text-sm font-bold text-bad">{state.error}</p>}
    </form>
  );
}
