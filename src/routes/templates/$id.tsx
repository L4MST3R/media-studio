import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { ChevronLeft, Pencil, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { TemplateDialog } from "@/client/components/TemplateDialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/client/components/ui/alert-dialog";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import type { Template } from "@/server/templates";
import { deleteTemplate, getTemplate } from "@/serverFunctions/templates";
import { categoryLabel, fillTemplate, placeholdersOf } from "@/shared/options";

export const Route = createFileRoute("/templates/$id")({
  loader: ({ params }) => getTemplate({ data: { id: params.id } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.template?.title ?? "Template"} · Media Studio`,
      },
    ],
  }),
  component: TemplatePage,
});

const backLink = (
  <Link
    to="/templates"
    className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
  >
    <ChevronLeft className="size-4" aria-hidden />
    Templates
  </Link>
);

function TemplatePage() {
  const { template, canEdit } = Route.useLoaderData();
  if (!template) {
    return (
      <AppShell nav={<AppNav />}>
        <PageHeader title="Not found" backLink={backLink} />
        <EmptyState kind="error" title="This template doesn't exist" />
      </AppShell>
    );
  }
  return (
    <TemplateView key={template.id} template={template} canEdit={canEdit} />
  );
}

function TemplateView({
  template,
  canEdit,
}: {
  template: Template;
  canEdit: boolean;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const names = placeholdersOf(template.prompt);
  const [values, setValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filled = fillTemplate(template.prompt, values);

  function use() {
    const { aspectRatio, duration } = template.settings;
    if (template.kind === "video") {
      void navigate({
        to: "/video",
        search: { prompt: filled, aspectRatio, duration },
      });
    } else {
      void navigate({ to: "/", search: { prompt: filled, aspectRatio } });
    }
  }

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      await deleteTemplate({ data: { id: template.id } });
      setConfirming(false);
      await navigate({ to: "/templates" });
    } catch {
      setError("It couldn't be deleted. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title={template.title}
        backLink={backLink}
        description={
          <span className="inline-flex items-center gap-2">
            {categoryLabel(template.category)}
            <Badge variant="outline">
              {template.kind === "video" ? "Video" : "Image"}
            </Badge>
          </span>
        }
        actions={
          canEdit ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Pencil data-icon="inline-start" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirming(true)}
              >
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            </>
          ) : null
        }
      />
      <Card>
        <CardContent className="space-y-5">
          {names.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {names.map((name) => (
                <div key={name} className="space-y-1.5">
                  <Label htmlFor={`placeholder-${name}`}>{name}</Label>
                  <Input
                    id={`placeholder-${name}`}
                    data-testid={`placeholder-${name}`}
                    value={values[name] ?? ""}
                    onChange={(event) =>
                      setValues({ ...values, [name]: event.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}
          <p
            data-testid="template-preview"
            className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap"
          >
            {filled}
          </p>
          <Button onClick={use}>
            <Wand2 data-icon="inline-start" />
            Use template
          </Button>
        </CardContent>
      </Card>
      {canEdit ? (
        <>
          <TemplateDialog
            open={editing}
            onOpenChange={setEditing}
            template={template}
            onSaved={() => {
              setEditing(false);
              void router.invalidate();
            }}
          />
          <AlertDialog open={confirming} onOpenChange={setConfirming}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{template.title}”?</AlertDialogTitle>
              </AlertDialogHeader>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  variant="destructive"
                  pending={deleting}
                  onClick={remove}
                >
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </AppShell>
  );
}
