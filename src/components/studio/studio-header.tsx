import { Code2, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MoldSession } from "@/hooks/use-mold-session";

export function StudioHeader({ session }: { session: MoldSession }) {
  const isBusy =
    session.status === "analyzing" || session.status === "generating";
  return (
    <header className="panel z-20 flex h-14 shrink-0 items-center justify-between border-b px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg border bg-secondary">
          <Layers3 className="size-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h1 className="text-sm font-semibold tracking-[-0.01em]">Moldify</h1>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Workshop
            </span>
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {session.file?.name ?? "Demo part"} · millimeters
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex">
          <span
            className="size-2 rounded-full bg-[var(--status-safe)]"
            aria-hidden="true"
          />
          {isBusy ? session.stage : "Local engine ready"}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon" className="size-9">
              <a
                href="https://github.com/gokmency/moldify"
                target="_blank"
                rel="noreferrer"
                aria-label="Open Moldify on GitHub"
              >
                <Code2 className="size-4" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>View source on GitHub</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
