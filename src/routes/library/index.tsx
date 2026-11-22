import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AudioLines, Clapperboard, ImageIcon } from "lucide-react";
import { z } from "zod";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ChoiceSelect } from "@/client/components/ChoiceSelect";
import { EmptyState } from "@/client/components/EmptyState";
import { OptionToggle } from "@/client/components/OptionToggle";
import { PageHeader } from "@/client/components/PageHeader";
import { STATUS_LABELS, StatusBadge } from "@/client/components/StatusBadge";
import { Button, buttonVariants } from "@/client/components/ui/button";
import { formatDate } from "@/client/lib/format";
import type { Generation } from "@/server/generations";
import { listLibrary } from "@/serverFunctions/library";
import { KINDS, STATUSES } from "@/shared/options";

const search = z.object({
  kind: z.enum(KINDS).optional(),
  status: z.enum(STATUSES).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

export const Route = createFileRoute("/library/")({
  validateSearch: search,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    listLibrary({
      data: { kind: deps.kind, status: deps.status, page: deps.page ?? 1 },
    }),
  head: () => ({ meta: [{ title: "Library · Media Studio" }] }),
  component: LibraryPage,
});

const KIND_ITEMS = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Speech" },
] as const;

const STATUS_ITEMS = [
  { value: "any", label: "Any status" },
  ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
];

const KIND_ICONS = {
  image: ImageIcon,
  video: Clapperboard,
  audio: AudioLines,
};

function LibraryPage() {
  const { items, total, page, pageCount } = Route.useLoaderData();
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: "/library/" });
  const filtered = Boolean(filters.kind || filters.status);

  function setFilters(change: Partial<z.infer<typeof search>>) {
    void navigate({
      search: (prev) => ({ ...prev, page: undefined, ...change }),
    });
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="Library"
        description={total === 1 ? "1 generation" : `${total} generations`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <OptionToggle
          label="Kind"
          value={filters.kind ?? "all"}
          onChange={(kind) =>
            setFilters({ kind: kind === "all" ? undefined : kind })
          }
          items={KIND_ITEMS}
        />
        <ChoiceSelect
          label="Status"
          testId="status-filter"
          className="w-40"
          value={filters.status ?? "any"}
          onChange={(status) =>
            setFilters({
              status:
                status === "any"
                  ? undefined
                  : (status as (typeof STATUSES)[number]),
            })
          }
          items={STATUS_ITEMS}
        />
      </div>
      {items.length === 0 ? (
        filtered ? (
          <EmptyState kind="filtered" title="Nothing matches these filters" />
        ) : (
          <EmptyState
            title="Nothing here yet"
            description="Images, videos and speech you generate appear here."
            action={
              <Link to="/" className={buttonVariants()}>
                Make an image
              </Link>
            }
          />
        )
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <LibraryItem key={item.id} item={item} />
          ))}
        </ul>
      )}
      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() =>
              void navigate({ search: (prev) => ({ ...prev, page: page - 1 }) })
            }
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() =>
              void navigate({ search: (prev) => ({ ...prev, page: page + 1 }) })
            }
          >
            Next
          </Button>
        </div>
      ) : null}
    </AppShell>
  );
}

function LibraryItem({ item }: { item: Generation }) {
  const Icon = KIND_ICONS[item.kind];
  const thumb = item.kind === "image" ? item.assets[0] : undefined;
  return (
    <li>
      <Link
        to="/library/$id"
        params={{ id: item.id }}
        data-testid="library-item"
        className="flex gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted"
      >
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
          {thumb ? (
            <img src={thumb} alt="" className="size-full object-cover" />
          ) : (
            <Icon className="size-6" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="line-clamp-2 text-sm">{item.prompt}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge status={item.status} />
            <span suppressHydrationWarning>{formatDate(item.createdAt)}</span>
          </div>
        </div>
      </Link>
    </li>
  );
}
