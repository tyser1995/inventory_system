import { CategoriesView } from "@/components/views/CategoriesView";

// The (app) layout renders pages only after the client-side session check, so this
// segment is absent from the prerender and cannot be validated for instant navigation.
export const instant = false;

export default function CategoriesPage() {
  return <CategoriesView />;
}
