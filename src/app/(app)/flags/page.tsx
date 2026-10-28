import { redirect } from 'next/navigation';

// Flags became Needs attention (people) and Troubleshooting (profiles we couldn't read).
export default function Flags() {
  redirect('/attention');
}
