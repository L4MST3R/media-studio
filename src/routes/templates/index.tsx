import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { OptionToggle } from "@/client/components/OptionToggle";
import { PageHeader } from "@/client/components/PageHeader";
import { TemplateDialog } from "@/client/components/TemplateDialog";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { listTemplates } from "@/serverFunctions/templates";
import { categoryLabel, TEMPLATE_CATEGORIES } from "@/shared/options";

const search = z.object({ category: z.string().optional() });

export const Route = createFileRoute("/templates/")({
  validateSearch: search,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listTemplates({ data: { category: deps.category } }),
  head: () => ({ meta: [{ title: "Templates · Media Studio" }] }),
  component: TemplatesPage,
});

const CATEGORY_ITEMS = [
  { value: "all", label: "All" },
  ...TEMPLATE_CATEGORIES.map((c) => ({ value: c.id, label: c.label })),
];

function TemplatesPage() {
  const { templates, canEdit } = Route.useLoaderData();
  const { category } = Route.useSearch();
  const navigate = useNavigate({ from: "/templates/" });
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="Templates"
        actions={
          canEdit ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus data-icon="inline-start" />
              New template
            </Button>
          ) : null
        }
      />
      <OptionToggle
        label="Category"
        value={category ?? "all"}
        onChange={(next) =>
          void navigate({
            search: { category: next === "all" ? undefined : next },
          })
        }
        items={CATEGORY_ITEMS}
      />
      {templates.length === 0 ? (
        <EmptyState
          kind={category ? "filtered" : "no-data"}
          title={
            category ? "No templates in this category" : "No templates yet"
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {templates.map((template) => (
            <li key={template.id}>
              <Link
                to="/templates/$id"
                params={{ id: template.id }}
                data-testid="template-card"
                className="flex h-full flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{template.title}</span>
                  <Badge variant="outline">
                    {template.kind === "video" ? "Video" : "Image"}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {template.prompt}
                </p>
                <span className="text-xs text-muted-foreground">
                  {categoryLabel(template.category)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <TemplateDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={() => {
          setCreating(false);
          void router.invalidate();
        }}
      />
    </AppShell>
  );
}
