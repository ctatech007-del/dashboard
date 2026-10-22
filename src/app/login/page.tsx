import { signIn } from '@/app/actions';
import { ActionForm } from '@/components/forms';

export default function Login() {
  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="wide text-3xl font-bold">CTA Post Tracker</h1>
        <p className="text-ink-soft mt-1 mb-8">Team sign-in. Ask an admin for an invite if you don’t have an account.</p>
        <ActionForm action={signIn} submit="Sign in">
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="block text-ink-soft mb-1">Email</span>
              <input name="email" type="email" required autoComplete="email" className="field" />
            </label>
            <label className="block text-sm">
              <span className="block text-ink-soft mb-1">Password</span>
              <input name="password" type="password" required autoComplete="current-password" className="field" />
            </label>
          </div>
        </ActionForm>
      </div>
    </main>
  );
}
