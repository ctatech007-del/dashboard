// Invite and password-reset emails link here with a one-time token (see README: Auth email
// templates). Verifying it signs the person in, then they choose a password.
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const token_hash = req.nextUrl.searchParams.get('token_hash');
  const type = req.nextUrl.searchParams.get('type') as EmailOtpType | null;

  if (token_hash && (type === 'invite' || type === 'recovery')) {
    const db = await supabase();
    const { error } = await db.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(new URL('/login/set-password', req.url));
  }
  return NextResponse.redirect(new URL('/login?error=link', req.url));
}
