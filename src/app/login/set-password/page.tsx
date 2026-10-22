import { redirect } from 'next/navigation';
import { setPassword } from '@/app/actions';
import { ActionForm } from '@/components/forms';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function SetPassword() {
  const db = await supabase();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect('/login?error=link');

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="wide text-3xl font-bold">Choose a password</h1>
        <p className="text-ink-soft mt-1 mb-8">For {data.user.email}. At least 8 characters.</p>
        <ActionForm action={setPassword} submit="Save password">
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="block text-ink-soft mb-1">New password</span>
              <input name="password" type="password" required minLength={8} autoComplete="new-password" className="field" />
            </label>
            <label className="block text-sm">
              <span className="block text-ink-soft mb-1">Repeat it</span>
              <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="field" />
            </label>
          </div>
        </ActionForm>
      </div>
    </main>
  );
}
