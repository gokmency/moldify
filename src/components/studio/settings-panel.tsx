"use client";

import {
  AlertCircle,
  Check,
  Circle,
  Download,
  Info,
  RotateCw,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { GENERATION_STAGES } from "@/lib/geometry-worker-protocol";
import {
  PARAMETER_RANGES,
  type MoldParameters,
} from "@/lib/mold-types";
import type { MoldSession } from "@/hooks/use-mold-session";
import type { SettingsPanelId } from "@/components/studio/studio-types";
import { formatNumber } from "@/components/studio/studio-format";
import { cn } from "@/lib/utils";

type Range = { min: number; max: number; step: number; unit: string };

function ParameterSlider({
  label,
  value,
  range,
  onChange,
}: {
  label: string;
  value: number;
  range: Range;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <label className="text-xs text-muted-foreground">{label}</label>
        <span className="min-w-16 border-b px-1 pb-0.5 text-right font-mono text-[11px] font-medium">
          {value}
          {range.unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={range.min}
        max={range.max}
        step={range.step}
        onValueChange={([next]) => onChange(next)}
        aria-label={label}
      />
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>
          {range.min}
          {range.unit}
        </span>
        <span>
          {range.max}
          {range.unit}
        </span>
      </div>
    </div>
  );
}

function SplitDirection({ session }: { session: MoldSession }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs text-muted-foreground">Split direction</label>
        {session.analysis && (
          <span className="text-[10px] font-medium text-primary">
            Suggested {session.analysis.orientation}
          </span>
        )}
      </div>
      <Select
        value={session.parameters.splitDirection}
        onValueChange={(value) =>
          session.updateParameter(
            "splitDirection",
            value as MoldParameters["splitDirection"],
          )
        }
      >
        <SelectTrigger className="h-10 w-full bg-background text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {["Auto", "X", "Y", "Z"].map((axis) => (
            <SelectItem key={axis} value={axis} className="text-xs">
              {axis === "Auto"
                ? "Auto — lowest demold risk"
                : `${axis} axis`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SuggestedSetup({ session }: { session: MoldSession }) {
  if (!session.analysis) {
    return (
      <div className="space-y-2 border-y py-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }
  const recommendation = session.analysis.recommendations;
  return (
    <section className="border-y py-4" aria-labelledby="suggested-setup">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 id="suggested-setup" className="text-xs font-semibold">
            Suggested setup
          </h3>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            {session.analysis.orientation}-axis scored{" "}
            {session.analysis.orientationScores[session.analysis.orientation]}
            /100 for release. Use {recommendation.wallThickness} mm walls and{" "}
            {recommendation.clearance} mm clearance.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 h-8 text-[11px]"
            onClick={session.applyRecommendations}
          >
            <Settings2 className="size-3.5" />
            Apply suggestion
          </Button>
        </div>
      </div>
    </section>
  );
}

function SetupControls({
  session,
  mobile = false,
}: {
  session: MoldSession;
  mobile?: boolean;
}) {
  const core = (
    <>
      <ParameterSlider
        label="Wall thickness"
        value={session.parameters.wallThickness}
        range={PARAMETER_RANGES.wallThickness}
        onChange={(value) => session.updateParameter("wallThickness", value)}
      />
      <ParameterSlider
        label="Model clearance"
        value={session.parameters.clearance}
        range={PARAMETER_RANGES.clearance}
        onChange={(value) => session.updateParameter("clearance", value)}
      />
      <SplitDirection session={session} />
    </>
  );
  const advanced = (
    <>
      <ParameterSlider
        label="Draft angle"
        value={session.parameters.draftAngle}
        range={PARAMETER_RANGES.draftAngle}
        onChange={(value) => session.updateParameter("draftAngle", value)}
      />
      <ParameterSlider
        label="Shrink compensation"
        value={session.parameters.shrinkCompensation}
        range={PARAMETER_RANGES.shrinkCompensation}
        onChange={(value) =>
          session.updateParameter("shrinkCompensation", value)
        }
      />
    </>
  );

  return (
    <div className="space-y-5">
      <SuggestedSetup session={session} />
      <section>
        <h2 className="section-label mb-4">Core geometry</h2>
        <div className="space-y-5">{core}</div>
      </section>
      {mobile ? (
        <Accordion type="single" collapsible>
          <AccordionItem value="advanced">
            <AccordionTrigger className="text-xs">
              Advanced geometry
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-5 pt-2">{advanced}</div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : (
        <>
          <Separator />
          <section>
            <h2 className="section-label mb-4">Advanced geometry</h2>
            <div className="space-y-5">{advanced}</div>
          </section>
        </>
      )}
    </div>
  );
}

function FeatureSection({
  title,
  description,
  enabled,
  onEnabled,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onEnabled: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b pb-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xs font-semibold">{title}</h3>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            {description}
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onEnabled}
          aria-label={`Enable ${title}`}
        />
      </div>
      <div
        className={cn(
          "mt-5 space-y-5 transition-opacity",
          !enabled && "pointer-events-none opacity-35",
        )}
      >
        {children}
      </div>
    </section>
  );
}

function FeatureControls({ session }: { session: MoldSession }) {
  return (
    <div className="space-y-5">
      <FeatureSection
        title="Alignment pins"
        description="Keeps both mold halves registered during casting."
        enabled={session.parameters.pinsEnabled}
        onEnabled={(value) => session.updateParameter("pinsEnabled", value)}
      >
        <ParameterSlider
          label="Pin count"
          value={session.parameters.pinCount}
          range={PARAMETER_RANGES.pinCount}
          onChange={(value) => session.updateParameter("pinCount", value)}
        />
        <ParameterSlider
          label="Pin diameter"
          value={session.parameters.pinDiameter}
          range={PARAMETER_RANGES.pinDiameter}
          onChange={(value) => session.updateParameter("pinDiameter", value)}
        />
      </FeatureSection>
      <FeatureSection
        title="Pour channel"
        description="Creates the main path for casting material."
        enabled={session.parameters.pourEnabled}
        onEnabled={(value) => session.updateParameter("pourEnabled", value)}
      >
        <ParameterSlider
          label="Pour diameter"
          value={session.parameters.pourDiameter}
          range={PARAMETER_RANGES.pourDiameter}
          onChange={(value) => session.updateParameter("pourDiameter", value)}
        />
      </FeatureSection>
      <FeatureSection
        title="Air vents"
        description="Releases trapped air from the upper mold half."
        enabled={session.parameters.ventsEnabled}
        onEnabled={(value) => session.updateParameter("ventsEnabled", value)}
      >
        <ParameterSlider
          label="Vent diameter"
          value={session.parameters.ventDiameter}
          range={PARAMETER_RANGES.ventDiameter}
          onChange={(value) => session.updateParameter("ventDiameter", value)}
        />
      </FeatureSection>
    </div>
  );
}

function OutputFile({
  name,
  detail,
  disabled,
  onDownload,
}: {
  name: string;
  detail: string;
  disabled: boolean;
  onDownload: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b py-3">
      <div className="grid size-9 place-items-center rounded-lg bg-secondary">
        <Download className="size-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{name}</p>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {detail}
        </p>
      </div>
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        disabled={disabled}
        onClick={onDownload}
        aria-label={`Download ${name}`}
      >
        <Download className="size-4" />
      </Button>
    </div>
  );
}

function ExportControls({ session }: { session: MoldSession }) {
  return (
    <div className="space-y-5">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-label">Generation job</h2>
          <span className="font-mono text-[11px] text-muted-foreground">
            {session.progress}%
          </span>
        </div>
        <Progress value={session.progress} className="h-1.5" />
        <div className="mt-4 space-y-3">
          {GENERATION_STAGES.map((item) => {
            const complete = session.progress >= item.progress;
            const active =
              !complete &&
              session.status === "generating" &&
              session.stage === item.label;
            return (
              <div key={item.id} className="flex items-center gap-2.5 text-xs">
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full border",
                    complete &&
                      "border-[var(--status-safe-border)] bg-[var(--status-safe-bg)] text-[var(--status-safe-foreground)]",
                    active && "border-primary text-primary",
                  )}
                >
                  {complete ? (
                    <Check className="size-3" />
                  ) : active ? (
                    <RotateCw className="size-3 animate-spin" />
                  ) : (
                    <Circle className="size-2 fill-current opacity-30" />
                  )}
                </span>
                <span
                  className={cn(
                    "text-muted-foreground",
                    (complete || active) && "text-foreground",
                  )}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {session.isStale && (
        <div className="flex gap-2 border-l-2 border-[var(--status-warning-border)] pl-3 text-[11px] leading-4 text-muted-foreground">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-[var(--status-warning-foreground)]" />
          Settings changed after the last generation. Regenerate before
          downloading updated files.
        </div>
      )}

      {session.generated ? (
        <section data-testid="downloads">
          <h2 className="section-label mb-1">STL output</h2>
          <OutputFile
            name="Upper Mold.stl"
            detail={`${formatNumber(session.generated.stats.upperTriangles, 0)} triangles`}
            disabled={session.isStale}
            onDownload={() =>
              session.download(session.generated!.upper, "Upper Mold.stl")
            }
          />
          <OutputFile
            name="Lower Mold.stl"
            detail={`${formatNumber(session.generated.stats.lowerTriangles, 0)} triangles`}
            disabled={session.isStale}
            onDownload={() =>
              session.download(session.generated!.lower, "Lower Mold.stl")
            }
          />
          <p className="mt-3 font-mono text-[10px] text-muted-foreground">
            Envelope{" "}
            {session.generated.stats.moldSize
              .map((value) => formatNumber(value))
              .join(" × ")}{" "}
            mm
          </p>
        </section>
      ) : (
        <div className="border-y py-5 text-center">
          <SlidersHorizontal className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-2 text-xs font-medium">No mold generated yet</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Review the setup, then create both STL files locally.
          </p>
        </div>
      )}
    </div>
  );
}

function GenerateAction({
  session,
  onGenerate,
}: {
  session: MoldSession;
  onGenerate: () => Promise<void>;
}) {
  const isGenerating = session.status === "generating";
  return (
    <div className="border-t bg-card p-3">
      {isGenerating ? (
        <Button
          variant="outline"
          className="h-11 w-full text-xs"
          onClick={session.cancelGeneration}
        >
          <X className="size-4" />
          Cancel generation
        </Button>
      ) : (
        <Button
          className="h-11 w-full text-xs font-semibold"
          onClick={() => void onGenerate()}
          disabled={session.status === "analyzing"}
          data-testid="generate-button"
        >
          <RotateCw className="size-4" />
          {session.generated ? "Regenerate mold" : "Generate mold"}
        </Button>
      )}
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        Processed on this device · no cloud upload
      </p>
    </div>
  );
}

export function SettingsPanel({
  session,
  activePanel,
  onActivePanelChange,
  onGenerate,
}: {
  session: MoldSession;
  activePanel: SettingsPanelId;
  onActivePanelChange: (panel: SettingsPanelId) => void;
  onGenerate: () => Promise<void>;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Tabs
        value={activePanel}
        onValueChange={(value) =>
          onActivePanelChange(value as SettingsPanelId)
        }
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="px-3 pt-3">
          <TabsList className="grid h-9 w-full grid-cols-3 bg-background">
            <TabsTrigger value="setup" className="text-[11px]">
              Setup
            </TabsTrigger>
            <TabsTrigger value="features" className="text-[11px]">
              Features
            </TabsTrigger>
            <TabsTrigger value="export" className="text-[11px]">
              Export
            </TabsTrigger>
          </TabsList>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <TabsContent value="setup" className="m-0 p-4">
            <SetupControls session={session} />
          </TabsContent>
          <TabsContent value="features" className="m-0 p-4">
            <FeatureControls session={session} />
          </TabsContent>
          <TabsContent value="export" className="m-0 p-4">
            <ExportControls session={session} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
      <GenerateAction session={session} onGenerate={onGenerate} />
    </div>
  );
}

export function MobileSetupContent({ session }: { session: MoldSession }) {
  return (
    <div className="space-y-5 pb-5">
      <SetupControls session={session} mobile />
      <Accordion type="single" collapsible>
        <AccordionItem value="features">
          <AccordionTrigger className="text-xs">Mold features</AccordionTrigger>
          <AccordionContent>
            <div className="pt-2">
              <FeatureControls session={session} />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export function MobileExportContent({
  session,
  onGenerate,
}: {
  session: MoldSession;
  onGenerate: () => Promise<void>;
}) {
  return (
    <div className="space-y-4 pb-5">
      <ExportControls session={session} />
      <GenerateAction session={session} onGenerate={onGenerate} />
    </div>
  );
}
