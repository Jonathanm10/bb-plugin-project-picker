import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  experimental_useSidebarThreads,
  useBbContext,
  useBbNavigate,
  useSdk,
} from "@get-bb/plugin-sdk/app";
import { usePortalScopeProps } from "@/lib/portal-scope";
import { cn, formatHomePathForDisplay } from "@/lib/utils";

export const OPEN_EVENT = "project-picker:open";

type PickerProject = {
  id: string;
  name: string;
  path: string | null;
  isPersonal: boolean;
};

function initials(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const letters =
    words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/** Current project first, then personal, then most recent thread activity, then name. */
function sortProjects(
  projects: PickerProject[],
  lastActivity: Map<string, number>,
  currentProjectId: string | null,
): PickerProject[] {
  return [...projects].sort((a, b) => {
    if ((a.id === currentProjectId) !== (b.id === currentProjectId)) {
      return a.id === currentProjectId ? -1 : 1;
    }
    if (a.isPersonal !== b.isPersonal) return a.isPersonal ? -1 : 1;
    const recency = (lastActivity.get(b.id) ?? 0) - (lastActivity.get(a.id) ?? 0);
    return recency !== 0 ? recency : a.name.localeCompare(b.name);
  });
}

function matches(project: PickerProject, query: string): boolean {
  if (query === "") return true;
  return (
    project.name.toLowerCase().includes(query) ||
    (project.path?.toLowerCase().includes(query) ?? false)
  );
}

export function ProjectPickerOverlay() {
  const sdk = useSdk();
  const navigate = useBbNavigate();
  const { projectId: currentProjectId } = useBbContext();
  const { threads } = experimental_useSidebarThreads();
  const scopeProps = usePortalScopeProps();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<PickerProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    const toggle = () => {
      setQuery("");
      setHighlighted(0);
      setOpen((current) => !current);
    };
    window.addEventListener(OPEN_EVENT, toggle);
    return () => window.removeEventListener(OPEN_EVENT, toggle);
  }, []);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement;
    setError(null);
    inputRef.current?.focus();
    const controller = new AbortController();
    sdk.projects
      .list({ includePersonal: true, signal: controller.signal })
      .then((result) => {
        setProjects(
          result.map((project) => ({
            id: project.id,
            name: project.kind === "personal" ? "No project" : project.name,
            path:
              project.kind === "personal"
                ? null
                : ((project.sources.find((source) => source.isDefault) ??
                    project.sources[0])?.path ?? null),
            isPersonal: project.kind === "personal",
          })),
        );
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => controller.abort();
    // Keyed on open alone: one fetch per opening.
  }, [open]);

  const lastActivity = useMemo(() => {
    const byProject = new Map<string, number>();
    for (const thread of threads) {
      if (thread.isHidden) continue;
      const previous = byProject.get(thread.projectId) ?? 0;
      if (thread.updatedAt > previous) byProject.set(thread.projectId, thread.updatedAt);
    }
    return byProject;
  }, [threads]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sortProjects(projects ?? [], lastActivity, currentProjectId).filter(
      (project) => matches(project, needle),
    );
  }, [projects, lastActivity, currentProjectId, query]);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    const target = returnFocusRef.current;
    if (restoreFocus && target instanceof HTMLElement) target.focus();
  };

  const pick = (project: PickerProject | undefined) => {
    if (project === undefined) return;
    close(false);
    navigate.toCompose({ projectId: project.id, focusPrompt: true });
  };

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${highlighted}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  // Capture phase so the picker wins over bb's global shortcuts while open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      const mod = event.metaKey || event.ctrlKey;
      const count = visible.length;
      let handled = true;
      if (event.key === "Escape") close(true);
      else if (mod && event.key.toLowerCase() === "n") close(true);
      else if (event.key === "ArrowDown" && count > 0)
        setHighlighted((index) => (index + 1) % count);
      else if (event.key === "ArrowUp" && count > 0)
        setHighlighted((index) => (index - 1 + count) % count);
      else if (event.key === "Enter") pick(visible[highlighted]);
      else if (mod && /^[1-9]$/.test(event.key)) pick(visible[Number(event.key) - 1]);
      else handled = false;
      if (!handled) return;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  });

  if (!open) return null;

  return createPortal(
    <div
      {...scopeProps}
      role="dialog"
      aria-modal="true"
      aria-label="Pick a project for a new thread"
      data-state="open"
      className="fixed inset-0 z-50"
    >
      <div
        aria-hidden
        onPointerDown={() => close(true)}
        className="absolute inset-0 bg-black/40 animate-in fade-in-0 duration-150"
      />
      <div className="absolute left-1/2 top-[15%] flex max-h-[70vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="border-b border-border px-4 py-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlighted(0);
            }}
            placeholder="Search projects…"
            aria-label="Search projects"
            aria-controls="project-picker-list"
            aria-activedescendant={
              visible[highlighted] ? `project-picker-${visible[highlighted].id}` : undefined
            }
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="px-2 pb-1 pt-1 text-xs font-medium text-muted-foreground">
            Projects
          </div>
          {error !== null ? (
            <p role="alert" className="px-2 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : projects === null ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">No matching projects</p>
          ) : (
            <ul ref={listRef} id="project-picker-list" role="listbox">
              {visible.map((project, index) => (
                <li
                  key={project.id}
                  id={`project-picker-${project.id}`}
                  role="option"
                  aria-selected={index === highlighted}
                  data-index={index}
                  onMouseMove={() => setHighlighted(index)}
                  onClick={() => pick(project)}
                  className={cn(
                    "flex cursor-default items-center gap-3 rounded-lg px-2 py-2",
                    index === highlighted && "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-medium text-muted-foreground">
                    {initials(project.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{project.name}</span>
                    {project.path !== null ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        Local · {formatHomePathForDisplay(project.path)}
                      </span>
                    ) : null}
                  </span>
                  {index < 9 ? (
                    <kbd className="shrink-0 font-sans text-xs text-muted-foreground">
                      ⌘{index + 1}
                    </kbd>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span>↑↓ Navigate</span>
          <span>Enter Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
