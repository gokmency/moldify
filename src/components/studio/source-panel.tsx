"use client";

import { useRef } from "react";
import {
  AlertTriangle,
  Box,
  FileBox,
  LoaderCircle,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { MoldSession } from "@/hooks/use-mold-session";
import { cn } from "@/lib/utils";
import {
  formatFileSize,
  formatNumber,
  riskLevel,
} from "@/components/studio/studio-format";

function RiskRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const risk = riskLevel(value);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={cn(
            "font-medium",
            risk.tone === "safe" && "text-[var(--status-safe-foreground)]",
            risk.tone === "warning" && "text-[var(--status-warning-foreground)]",
            risk.tone === "danger" && "text-destructive",
          )}
        >
          {risk.label}
        </span>
      </div>
      <Progress value={value * 100} className="h-1.5" />
    </div>
  );
}

export function SourcePanel({
  session,
  mobile = false,
}: {
  session: MoldSession;
  mobile?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isAnalyzing = session.status === "analyzing";
  const modelName = session.file?.name ?? "Moldify demo part";
  const fileSize = session.file
    ? formatFileSize(session.file.size)
    : "Procedural sample";

  const openFile = () => inputRef.current?.click();
  const acceptDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const selected = event.dataTransfer.files[0];
    if (selected) void session.loadFile(selected);
  };

  return (
    <div className={cn("space-y-5", mobile ? "pb-6" : "p-4")}>
      <section aria-labelledby={mobile ? "mobile-source-heading" : "source-heading"}>
        <div className="mb-3 flex items-center justify-between">
          <h2
            id={mobile ? "mobile-source-heading" : "source-heading"}
            className="section-label"
          >
            Source model
          </h2>
          {isAnalyzing && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <LoaderCircle className="size-3.5 animate-spin" />
              Checking
            </span>
          )}
        </div>

        {session.file ? (
          <Button
            variant="outline"
            className="h-11 w-full justify-between bg-card px-3 text-xs"
            onClick={openFile}
          >
            <span className="flex min-w-0 items-center gap-2">
              <FileBox className="size-4 shrink-0 text-primary" />
              <span className="truncate">{session.file.name}</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <RefreshCw className="size-3.5" />
              Replace
            </span>
          </Button>
        ) : (
          <button
            type="button"
            onClick={openFile}
            onDragOver={(event) => event.preventDefault()}
            onDrop={acceptDrop}
            className="group flex min-h-36 w-full flex-col items-center justify-center rounded-xl border border-dashed bg-background px-4 text-center transition-colors hover:border-primary/55 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="upload-dropzone"
          >
            <span className="mb-3 grid size-10 place-items-center rounded-lg border bg-card">
              <Upload className="size-4 text-primary" />
            </span>
            <span className="text-xs font-medium">Drop a 3D model</span>
            <span className="mt-1 text-[11px] text-muted-foreground">
              STL, OBJ, GLB or 3MF · up to 50 MB
            </span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".stl,.obj,.glb,.3mf"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) void session.loadFile(selected);
            event.currentTarget.value = "";
          }}
          data-testid="file-input"
        />
        <Button
          variant="secondary"
          className="mt-2 h-10 w-full text-xs"
          onClick={() => void session.useDemo()}
        >
          <Box className="size-3.5" />
          Use demo part
        </Button>
      </section>

      <Separator />

      <section aria-labelledby={mobile ? "mobile-model-heading" : "model-heading"}>
        <h2
          id={mobile ? "mobile-model-heading" : "model-heading"}
          className="section-label mb-3"
        >
          Model summary
        </h2>
        <div className="border-y py-3">
          <div className="flex items-start gap-3">
            <FileBox className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium" title={modelName}>
                {modelName}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{fileSize}</p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "h-6 rounded-md px-2 text-[10px]",
                session.analysis?.watertight
                  ? "border-[var(--status-safe-border)] bg-[var(--status-safe-bg)] text-[var(--status-safe-foreground)]"
                  : "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-foreground)]",
              )}
            >
              {session.analysis?.watertight ? "Solid" : "Review"}
            </Badge>
          </div>
          {session.analysis && (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div>
                <dt className="text-[11px] text-muted-foreground">Dimensions</dt>
                <dd className="mt-0.5 font-mono text-[10px]">
                  {session.analysis.bounds.size
                    .map((value) => formatNumber(value))
                    .join(" × ")}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Triangles</dt>
                <dd className="mt-0.5 font-mono text-[11px]">
                  {formatNumber(session.analysis.triangleCount, 0)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Mesh quality</dt>
                <dd className="mt-0.5 font-mono text-[11px]">
                  {Math.round(session.analysis.manifoldScore * 100)}%
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Best split</dt>
                <dd className="mt-0.5 font-medium text-primary">
                  {session.analysis.orientation} axis
                </dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      {session.analysis && (
        <section aria-labelledby={mobile ? "mobile-check-heading" : "check-heading"}>
          <h2
            id={mobile ? "mobile-check-heading" : "check-heading"}
            className="section-label mb-3"
          >
            Manufacturability
          </h2>
          <div className="space-y-4">
            <RiskRow label="Undercut risk" value={session.analysis.undercutRisk} />
            <RiskRow
              label="Trapped regions"
              value={session.analysis.trappedRegionRisk}
            />
          </div>
          {!!session.analysis.warnings.length && (
            <div className="mt-4 space-y-2">
              {session.analysis.warnings.map((warning) => (
                <div
                  key={warning}
                  className="flex gap-2 border-l-2 border-[var(--status-warning-border)] pl-3 text-[11px] leading-4 text-muted-foreground"
                >
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--status-warning-foreground)]" />
                  {warning}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
