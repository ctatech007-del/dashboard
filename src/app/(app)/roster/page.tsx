import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { day } from '@/lib/format';
import { addStudent, updateStudent, uploadCsv } from '@/app/actions';
import { ActionForm } from '@/components/forms';

export default async function Roster({
  searchParams,
}: { searchParams: Promise<{ edit?: string; show?: string }> }) {
  const { db } = await teamClient();
  const { edit, show } = await searchParams;

  const [{ data: students }, { data: batches }] = await Promise.all([
    db.from('students').select('id, name, ig_handle, start_date, status, batches(name)')
      .order('created_at', { ascending: false }),
    db.from('batches').select('name').order('created_at', { ascending: false }),
  ]);
  const list = (students ?? []).filter((s) => show === 'all' || s.status !== 'removed');
  const editing = students?.find((s) => s.id === edit);
  const batchName = (s: { batches: unknown }) => (s.batches as { name: string } | null)?.name ?? '';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  return (
    <>
      <h1 className="wide text-3xl font-bold mb-6">Roster</h1>

      <datalist id="batch-names">
        {batches?.map((b) => <option key={b.name} value={b.name} />)}
      </datalist>

      {editing && (
        <section className="bg-surface border-2 border-ink rounded-lg p-5 mb-8">
          <div className="flex justify-between items-baseline">
            <h2 className="wide text-lg font-bold">Edit {editing.name}</h2>
            <Link href="/roster" className="text-sm text-ink-soft hover:text-ink">Close</Link>
          </div>
          <p className="text-sm text-ink-soft mt-1 mb-4">
            Changing the handle keeps all of this student’s history. Use it when they rename their account.
          </p>
          <ActionForm action={updateStudent} submit="Save changes">
            <input type="hidden" name="id" value={editing.id} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Field label="Name"><input name="name" required defaultValue={editing.name} className="field" /></Field>
              <Field label="Instagram handle"><input name="handle" required defaultValue={editing.ig_handle} className="field" /></Field>
              <Field label="Batch"><input name="batch" required list="batch-names" defaultValue={batchName(editing)} className="field" /></Field>
              <Field label="Start date"><input name="start_date" type="date" required defaultValue={editing.start_date} className="field" /></Field>
              <Field label="Status">
                <select name="status" defaultValue={editing.status} className="field">
                  <option value="active">Active: scraped and ranked</option>
                  <option value="paused">Paused: not scraped</option>
                  <option value="removed">Removed: hidden</option>
                </select>
              </Field>
            </div>
          </ActionForm>
        </section>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-10">
        <section className="bg-surface border border-rule rounded-lg p-5">
          <h2 className="wide text-lg font-bold mb-4">Add a student</h2>
          <ActionForm action={addStudent} submit="Add student" resetOnSuccess>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Name"><input name="name" required className="field" /></Field>
              <Field label="Instagram handle"><input name="handle" required placeholder="@handle or profile link" className="field" /></Field>
              <Field label="Batch"><input name="batch" required list="batch-names" placeholder="e.g. Nov 2026" className="field" /></Field>
              <Field label="Start date"><input name="start_date" type="date" required defaultValue={today} className="field" /></Field>
            </div>
          </ActionForm>
        </section>

        <section className="bg-surface border border-rule rounded-lg p-5">
          <h2 className="wide text-lg font-bold">Upload a batch</h2>
          <p className="text-sm text-ink-soft mt-1 mb-4">
            CSV with the columns <code>name, handle, batch, start_date</code>. Dates as YYYY-MM-DD.
            Handles already on the roster are skipped.
          </p>
          <ActionForm action={uploadCsv} submit="Upload CSV">
            <input type="file" name="file" accept=".csv,text/csv" required className="field" />
          </ActionForm>
        </section>
      </div>

      <div className="flex justify-between items-baseline mb-3">
        <h2 className="wide text-lg font-bold">Students ({list.length})</h2>
        <Link href={show === 'all' ? '/roster' : '/roster?show=all'} className="text-sm underline underline-offset-4">
          {show === 'all' ? 'Hide removed' : 'Show removed'}
        </Link>
      </div>
      <div className="bg-surface border border-rule rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-ink-soft border-b border-rule">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Handle</th>
              <th className="px-4 py-3 font-medium">Batch</th>
              <th className="px-4 py-3 font-medium">Started</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className="border-b border-rule last:border-0">
                <td className="px-4 py-2.5 font-semibold">{s.name}</td>
                <td className="px-4 py-2.5">@{s.ig_handle}</td>
                <td className="px-4 py-2.5">{batchName(s)}</td>
                <td className="px-4 py-2.5 text-ink-soft">{day(s.start_date)}</td>
                <td className="px-4 py-2.5">
                  <span className={s.status === 'active' ? 'text-ok' : 'text-ink-soft'}>{s.status}</span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/roster?edit=${s.id}`} className="underline underline-offset-4">Edit</Link>
                </td>
              </tr>
            ))}
            {!list.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-soft">No students yet. Add one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block text-ink-soft mb-1">{label}</span>
      {children}
    </label>
  );
}
