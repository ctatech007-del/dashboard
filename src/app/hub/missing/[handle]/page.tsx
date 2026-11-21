import { HubHome } from '../../home';

// A search that found nothing: the Hub with the "couldn't find that handle" message and suggestions.
export default async function Missing({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return <HubHome notfound={decodeURIComponent(handle)} />;
}
