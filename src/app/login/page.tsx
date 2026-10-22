import Link from 'next/link';
import { signIn } from '@/app/actions';
import { ActionForm } from '@/components/forms';
import { Star } from '@/components/star';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen grid place-items-center px-6 py-10 overflow-hidden">
      <div className="w-full max-w-sm relative">
        <Star className="size-56 text-pink -ml-6 mb-2" rays={12} />
        <Star className="absolute size-28 text-ink/80 top-6 right-0" rays={8} />
        <h1 className="wide text-4xl font-bold uppercase leading-[0.95]">Track every post in one place</h1>
        <p className="text-ink-soft mt-3 mb-8">CTA Post Tracker · team sign-in. Ask an admin for an invite if you don’t have an account.</p>
        {error === 'link' && (
          <p role="alert" className="text-sm text-flag bg-flag-soft rounded-md px-3 py-2 mb-6">
            That link has expired or was already used. Ask for a new invite, or reset your password below.
          </p>
        )}
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
        <Link href="/login/forgot" className="inline-block mt-6 text-sm underline underline-offset-4 text-ink-soft hover:text-ink">
          Forgot password?
        </Link>
      </div>
    </main>
  );
}
