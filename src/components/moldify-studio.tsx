"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Box, LoaderCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { ViewOptions } from "@/components/mold-viewport";
import { MobileStudioNav } from "@/components/studio/mobile-studio-nav";
import { SettingsPanel } from "@/components/studio/settings-panel";
import { SourcePanel } from "@/components/studio/source-panel";
import { StudioHeader } from "@/components/studio/studio-header";
import { StudioStatusBar } from "@/components/studio/studio-status-bar";
import type {
  CameraCommand,
  CameraCommandType,
  SettingsPanelId,
} from "@/components/studio/studio-types";
import { ViewToolbar } from "@/components/studio/view-toolbar";
import { useMoldSession } from "@/hooks/use-mold-session";

const MoldViewport = dynamic(
  () => import("@/components/mold-viewport").then((mod) => mod.MoldViewport),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full min-h-[320px] place-items-center bg-[var(--viewport)]">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="size-16 rounded-xl" />
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Preparing 3D workspace
          </span>
        </div>
      </div>
    ),
  },
);

const defaultViewOptions: ViewOptions = {
  wireframe: false,
  mold: true,
  splitPlane: true,
  pins: true,
  channels: true,
  section: false,
};

export function MoldifyStudio() {
  const session = useMoldSession();
  const [viewOptions, setViewOptions] =
    useState<ViewOptions>(defaultViewOptions);
  const [activePanel, setActivePanel] = useState<SettingsPanelId>("setup");
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>({
    type: "fit",
    id: 0,
  });

  const issueCameraCommand = (type: CameraCommandType) =>
    setCameraCommand((current) => ({ type, id: current.id + 1 }));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches(
          "input, textarea, select, button, [contenteditable='true']",
        )
      ) {
        return;
      }
      const shortcuts: Record<string, CameraCommandType> = {
        f: "fit",
        r: "reset",
        "1": "iso",
        "2": "top",
      };
      const command = shortcuts[event.key.toLowerCase()];
      if (command) issueCameraCommand(command);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleGenerate = async () => {
    const complete = await session.generate();
    if (complete) setActivePanel("export");
  };

  return (
    <main className="flex h-dvh min-h-[560px] flex-col overflow-hidden bg-background text-foreground">
      <StudioHeader session={session} />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[288px_minmax(420px,1fr)_352px]">
        <aside className="panel hidden min-h-0 flex-col border-r lg:flex">
          <ScrollArea className="min-h-0 flex-1">
            <SourcePanel session={session} />
          </ScrollArea>
        </aside>

        <section className="relative min-h-0 overflow-hidden bg-[var(--viewport)]">
          <div className="absolute left-3 top-3 z-10 hidden xl:block">
            <ViewToolbar
              options={viewOptions}
              onOptionsChange={setViewOptions}
              onCameraCommand={issueCameraCommand}
            />
          </div>
          <div className="absolute right-3 top-3 z-10 hidden rounded-lg border bg-card px-2.5 py-1.5 text-[10px] text-muted-foreground lg:block">
            F fit · R reset · 1 iso · 2 top
          </div>

          <MoldViewport
            geometry={session.geometry}
            parameters={session.parameters}
            options={viewOptions}
            cameraCommand={cameraCommand}
          />

          <div className="pointer-events-none absolute bottom-4 left-4 z-10 hidden items-center gap-2 rounded-lg border bg-card px-3 py-2 text-[11px] shadow-sm sm:flex">
            <Box className="size-3.5 text-primary" />
            <span className="max-w-56 truncate font-medium">
              {session.file?.name ?? "Moldify demo part"}
            </span>
          </div>
          <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-lg border bg-card px-3 py-2 text-[10px] text-muted-foreground lg:hidden">
            Drag to orbit · pinch to zoom
          </div>
        </section>

        <aside className="panel hidden min-h-0 flex-col border-l lg:flex">
          <SettingsPanel
            session={session}
            activePanel={activePanel}
            onActivePanelChange={setActivePanel}
            onGenerate={handleGenerate}
          />
        </aside>
      </div>

      <StudioStatusBar session={session} />
      <MobileStudioNav
        session={session}
        viewOptions={viewOptions}
        onViewOptionsChange={setViewOptions}
        onCameraCommand={issueCameraCommand}
        onGenerate={handleGenerate}
      />
    </main>
  );
}
