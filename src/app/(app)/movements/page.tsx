import { MovementsView } from "@/components/views/MovementsView";

// The (app) layout renders pages only after the client-side session check, so this
// segment is absent from the prerender and cannot be validated for instant navigation.
export const instant = false;

export default function MovementsPage() {
  return <MovementsView />;
}
