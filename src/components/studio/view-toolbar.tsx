"use client";

import {
  Box,
  CircleGauge,
  Crosshair,
  Eye,
  Layers3,
  RotateCcw,
  ScanLine,
  Square,
  Wind,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ViewOptions } from "@/components/mold-viewport";
import type {
  CameraCommandType,
} from "@/components/studio/studio-types";
import { cn } from "@/lib/utils";

const layers = [
  { id: "wireframe", label: "Wire", icon: ScanLine },
  { id: "mold", label: "Mold", icon: Box },
  { id: "splitPlane", label: "Split", icon: Layers3 },
  { id: "pins", label: "Pins", icon: CircleGauge },
  { id: "channels", label: "Flow", icon: Wind },
  { id: "section", label: "Section", icon: Square },
] as const;

const cameraActions: Array<{
  id: CameraCommandType;
  label: string;
  icon: typeof Crosshair;
}> = [
  { id: "fit", label: "Fit model (F)", icon: Crosshair },
  { id: "iso", label: "Isometric view (1)", icon: Eye },
  { id: "top", label: "Top view (2)", icon: Square },
  { id: "reset", label: "Reset view (R)", icon: RotateCcw },
];

export function ViewToolbar({
  options,
  onOptionsChange,
  onCameraCommand,
  mobile = false,
}: {
  options: ViewOptions;
  onOptionsChange: (options: ViewOptions) => void;
  onCameraCommand: (command: CameraCommandType) => void;
  mobile?: boolean;
}) {
  if (mobile) {
    return (
      <div className="space-y-6 pb-6">
        <section>
          <h2 className="section-label mb-3">Visible layers</h2>
          <div className="grid grid-cols-2 gap-2">
            {layers.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant={options[id] ? "secondary" : "outline"}
                className="h-11 justify-start text-xs"
                onClick={() =>
                  onOptionsChange({ ...options, [id]: !options[id] })
                }
                aria-label={`${label} layer`}
                aria-pressed={options[id]}
              >
                <Icon className={cn("size-4", options[id] && "text-primary")} />
                {label}
              </Button>
            ))}
          </div>
        </section>
        <section>
          <h2 className="section-label mb-3">Camera</h2>
          <div className="grid grid-cols-2 gap-2">
            {cameraActions.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant="outline"
                className="h-11 justify-start text-xs"
                onClick={() => onCameraCommand(id)}
              >
                <Icon className="size-4" />
                {label.replace(/\s\(.+\)/, "")}
              </Button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-xl border bg-card p-1 shadow-sm">
        {layers.map(({ id, label, icon: Icon }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 gap-1.5 rounded-lg px-2.5 text-xs",
                  options[id] && "bg-secondary text-foreground",
                )}
                onClick={() =>
                  onOptionsChange({ ...options, [id]: !options[id] })
                }
                aria-label={`${label} layer`}
                aria-pressed={options[id]}
                data-testid={`toggle-${id}`}
              >
                <Icon className={cn("size-3.5", options[id] && "text-primary")} />
                <span className="hidden 2xl:inline">{label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label} layer</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="flex items-center rounded-xl border bg-card p-1 shadow-sm">
        {cameraActions.map(({ id, label, icon: Icon }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg"
                onClick={() => onCameraCommand(id)}
                aria-label={label}
              >
                <Icon className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
