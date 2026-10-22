'use client';

import { useActionState } from 'react';
import type { FormState } from '@/app/actions';

type Action = (state: FormState, form: FormData) => Promise<FormState>;

/** A form wired to a server action, with its result shown underneath. */
export function ActionForm({
  action, children, submit, className = '', resetOnSuccess = false,
}: {
  action: Action; children?: React.ReactNode; submit: string; className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form
      action={run}
      className={className}
      key={resetOnSuccess && state?.message ? state.message : undefined}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <button className="btn" disabled={pending}>{pending ? 'Working…' : submit}</button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function Result({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-sm ${state.error ? 'text-flag' : 'text-ok'}`}>
      {state.error ?? state.message}
    </p>
  );
}

export function RerunButton({ action }: { action: () => Promise<FormState> }) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className="flex items-center gap-3">
      <Result state={state} />
      <button className="btn btn-quiet" disabled={pending}>
        {pending ? 'Starting…' : 'Re-run scrape'}
      </button>
    </form>
  );
}
