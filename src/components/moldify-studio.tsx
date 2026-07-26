"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { ViewOptions } from "@/components/mold-viewport";
import { MobileStudioNav } from "@/components/studio/mobile-studio-nav";
import { SettingsPanel } from "@/components/studio/settings-panel";
import { SourcePanel } from "@/components/studio/source-panel";
import { StudioHeader } from "@/components/studio/studio-header";
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
    setActivePanel("export");
    const complete = await session.generate();
    if (!complete) return;
  };

  return (
    <main className="flex h-dvh min-h-[560px] flex-col overflow-hidden bg-background text-foreground">
      <StudioHeader />

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
          {session.status === "unsupported" ? (
            <div
              className="grid h-full place-items-center p-6"
              data-testid="unsupported-browser"
            >
              <div className="max-w-sm text-center">
                <AlertTriangle className="mx-auto size-6 text-primary" />
                <h2 className="mt-3 text-sm font-semibold">
                  This browser cannot run Moldify
                </h2>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Moldify needs WebGL, WebAssembly, Web Workers and browser file
                  downloads. Try the latest Chrome, Edge, Firefox or Safari.
                </p>
              </div>
            </div>
          ) : (
            <MoldViewport
              geometry={session.geometry}
              parameters={session.parameters}
              options={viewOptions}
              cameraCommand={cameraCommand}
            />
          )}
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
