import { Layers3 } from "lucide-react";
import { HelpDialog } from "@/components/studio/help-dialog";

export function StudioHeader() {
  return (
    <header className="panel z-20 flex h-14 shrink-0 items-center justify-between border-b px-3 sm:px-4">
      <div className="flex items-center gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg border bg-secondary">
          <Layers3 className="size-4 text-primary" />
        </div>
        <h1 className="text-sm font-semibold tracking-[-0.01em]">Moldify</h1>
      </div>
      <HelpDialog />
    </header>
  );
}
