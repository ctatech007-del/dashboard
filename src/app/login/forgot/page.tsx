import Link from 'next/link';
import { requestPasswordReset } from '@/app/actions';
import { ActionForm } from '@/components/forms';
import { Star } from '@/components/star';

export default function Forgot() {
  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <Star className="size-16 text-pink mb-6" />
        <h1 className="wide text-3xl font-bold uppercase">Reset password</h1>
        <p className="text-ink-soft mt-1 mb-8">We’ll email you a link to choose a new password.</p>
        <ActionForm action={requestPasswordReset} submit="Send reset link">
          <label className="block text-sm">
            <span className="block text-ink-soft mb-1">Email</span>
            <input name="email" type="email" required autoComplete="email" className="field" />
          </label>
        </ActionForm>
        <Link href="/login" className="inline-block mt-6 text-sm underline underline-offset-4 text-ink-soft hover:text-ink">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
