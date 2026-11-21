import { HubHome } from './home';

// Cached and refreshed every 5 minutes: the data changes once a day (06:00 IST), so visitors get the
// page straight from the CDN instead of waiting for a server to start.
export const revalidate = 300;

export default function Hub() {
  return <HubHome />;
}
