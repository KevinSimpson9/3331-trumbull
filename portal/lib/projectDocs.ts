import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PROJECT_DOCS } from "@/lib/docs";
import type { ProjectDocument } from "@/lib/types";

/** A library card plus whether it actually resolves to something openable. */
export type ProjectDocumentVM = ProjectDocument & { available: boolean };

/**
 * Loads the shared document library and flags which cards actually resolve —
 * an external href, or a file that really exists in the private
 * 'project-documents' bucket. Rows can carry a storage_path before the file
 * is uploaded, so the bucket itself is the source of truth; unresolved cards
 * render as "Coming soon" instead of a dead link.
 */
export async function loadProjectDocs(supabase: SupabaseClient): Promise<ProjectDocumentVM[]> {
  const { data } = await supabase
    .from("project_documents")
    .select("*")
    .order("sort", { ascending: true });
  const docs: ProjectDocument[] =
    data && data.length ? data : (DEFAULT_PROJECT_DOCS as ProjectDocument[]);
  const uploaded = await listUploadedPaths(docs);
  return docs.map((d) => ({
    ...d,
    available: Boolean(d.href) || (Boolean(d.storage_path) && uploaded.has(d.storage_path!)),
  }));
}

/** The subset of the docs' storage_paths that exist in the bucket. */
async function listUploadedPaths(docs: ProjectDocument[]): Promise<Set<string>> {
  const paths = docs.map((d) => d.storage_path).filter((p): p is string => Boolean(p));
  const found = new Set<string>();
  if (!paths.length) return found;
  const dirs = Array.from(
    new Set(paths.map((p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "")))
  );
  try {
    const admin = createAdminClient();
    await Promise.all(
      dirs.map(async (dir) => {
        const { data: files } = await admin.storage
          .from("project-documents")
          .list(dir, { limit: 1000 });
        for (const f of files ?? []) found.add(dir ? `${dir}/${f.name}` : f.name);
      })
    );
  } catch {
    // Storage unreachable — leave file-backed cards in their "coming soon" state.
  }
  return found;
}
