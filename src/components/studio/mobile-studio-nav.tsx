"use client";

import { useEffect, useState } from "react";
import { Box, Download, Eye, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SourcePanel } from "@/components/studio/source-panel";
import { ViewToolbar } from "@/components/studio/view-toolbar";
import {
  MobileExportContent,
  MobileSetupContent,
} from "@/components/studio/settings-panel";
import type { MobilePanelId } from "@/components/studio/studio-types";
import type { CameraCommandType } from "@/components/studio/studio-types";
import type { ViewOptions } from "@/components/mold-viewport";
import type { MoldSession } from "@/hooks/use-mold-session";
import { cn } from "@/lib/utils";

const items = [
  { id: "model", label: "Model", icon: Box },
  { id: "view", label: "View", icon: Eye },
  { id: "setup", label: "Setup", icon: SlidersHorizontal },
  { id: "export", label: "Export", icon: Download },
] as const;

const copy = {
  model: {
    title: "Model",
    description: "Source geometry and manufacturability checks.",
  },
  view: {
    title: "View",
    description: "Visible layers and camera position.",
  },
  setup: {
    title: "Mold setup",
    description: "Suggested geometry and mold features.",
  },
  export: {
    title: "Export",
    description: "Local generation progress and STL downloads.",
  },
};

export function MobileStudioNav({
  session,
  viewOptions,
  onViewOptionsChange,
  onCameraCommand,
  onGenerate,
}: {
  session: MoldSession;
  viewOptions: ViewOptions;
  onViewOptionsChange: (options: ViewOptions) => void;
  onCameraCommand: (command: CameraCommandType) => void;
  onGenerate: () => Promise<void>;
}) {
  const [panel, setPanel] = useState<MobilePanelId>("model");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (session.status !== "generated") return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    setPanel("export");
    setOpen(true);
  }, [session.status]);

  return (
    <>
      <nav
        className="panel fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-4 border-t px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Studio panels"
      >
        {items.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant="ghost"
            className={cn(
              "h-full min-h-11 flex-col gap-1 rounded-none text-[10px] text-muted-foreground",
              panel === id && open && "text-primary",
            )}
            onClick={() => {
              setPanel(id);
              setOpen(true);
            }}
          >
            <Icon className="size-4" />
            {label}
          </Button>
        ))}
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[82dvh] rounded-t-2xl px-0 pb-0"
        >
          <SheetHeader className="border-b px-5 pb-4 text-left">
            <SheetTitle>{copy[panel].title}</SheetTitle>
            <SheetDescription>{copy[panel].description}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="max-h-[calc(82dvh-5.5rem)]">
            <div className="px-5 pt-5">
              {panel === "model" && <SourcePanel session={session} mobile />}
              {panel === "view" && (
                <ViewToolbar
                  options={viewOptions}
                  onOptionsChange={onViewOptionsChange}
                  onCameraCommand={onCameraCommand}
                  mobile
                />
              )}
              {panel === "setup" && (
                <MobileSetupContent session={session} />
              )}
              {panel === "export" && (
                <MobileExportContent
                  session={session}
                  onGenerate={onGenerate}
                />
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
