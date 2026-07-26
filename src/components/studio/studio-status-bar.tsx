import { HardDrive, ShieldCheck } from "lucide-react";
import type { MoldSession } from "@/hooks/use-mold-session";

export function StudioStatusBar({ session }: { session: MoldSession }) {
  return (
    <footer className="panel hidden h-9 shrink-0 items-center gap-5 border-t px-4 text-[11px] text-muted-foreground lg:flex">
      <span className="flex items-center gap-2 font-medium text-foreground">
        <span className="size-2 rounded-full bg-[var(--status-safe)]" />
        {session.stage}
      </span>
      <span className="flex items-center gap-1.5">
        <ShieldCheck className="size-3.5" />
        Geometry stays on this device
      </span>
      <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px]">
        <HardDrive className="size-3.5" />
        Session {session.sessionId}
      </span>
    </footer>
  );
}
