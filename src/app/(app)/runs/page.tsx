import { redirect } from 'next/navigation';

// Runs & health moved into Troubleshooting.
export default function Runs() {
  redirect('/troubleshooting');
}
