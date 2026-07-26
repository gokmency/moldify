"use client";

import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Box,
  Check,
  CircleGauge,
  Code2,
  Download,
  FileBox,
  Layers3,
  LoaderCircle,
  Maximize2,
  ScanLine,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BufferGeometry } from "three";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { createDemoBufferGeometry } from "@/lib/demo-geometry";
import { generateMold } from "@/lib/manifold-engine";
import { analyzeGeometry } from "@/lib/mesh-analysis";
import { parseMeshBuffer, validateMeshFile } from "@/lib/mesh-loader";
import {
  DEFAULT_PARAMETERS,
  PARAMETER_RANGES,
  type AnalysisResult,
  type MoldParameters,
} from "@/lib/mold-types";
import type { ViewOptions } from "@/components/mold-viewport";

const MoldViewport = dynamic(
  () => import("@/components/mold-viewport").then((mod) => mod.MoldViewport),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full min-h-[420px] place-items-center text-sm text-muted-foreground">
        <LoaderCircle className="mr-2 size-4 animate-spin" />
        Preparing 3D viewport
      </div>
    ),
  },
);

type GeneratedFiles = {
  upper: Blob;
  lower: Blob;
  stats: { upperTriangles: number; lowerTriangles: number; moldSize: number[] };
};

const pipeline = [
  "Normalize mesh",
  "Analyze demold",
  "Build mold box",
  "Boolean cavities",
  "Add channels",
  "Validate STL",
];

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, 1)} KB`;
  return `${formatNumber(bytes / 1024 / 1024, 2)} MB`;
}

function riskLabel(value: number) {
  if (value < 0.3) return { label: "Low", className: "text-[#64734d]" };
  if (value < 0.6) return { label: "Medium", className: "text-[#9a6a32]" };
  return { label: "High", className: "text-destructive" };
}

export function MoldifyStudio() {
  const [file, setFile] = useState<File | null>(null);
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [parameters, setParameters] =
    useState<MoldParameters>(DEFAULT_PARAMETERS);
  const [viewOptions, setViewOptions] = useState<ViewOptions>({
    wireframe: false,
    mold: true,
    splitPlane: true,
    pins: true,
    channels: true,
    section: false,
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Ready");
  const [generated, setGenerated] = useState<GeneratedFiles | null>(null);
  const [sessionId, setSessionId] = useState("LOCAL");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSessionId(crypto.randomUUID().slice(0, 6).toUpperCase());
    const saved = localStorage.getItem("moldify-parameters");
    if (!saved) return;
    try {
      setParameters({ ...DEFAULT_PARAMETERS, ...JSON.parse(saved) });
    } catch {
      localStorage.removeItem("moldify-parameters");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("moldify-parameters", JSON.stringify(parameters));
  }, [parameters]);

  const analyze = useCallback(async (nextGeometry: BufferGeometry | null) => {
    setIsAnalyzing(true);
    setGenerated(null);
    setStage("Analyzing geometry");
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      const result = analyzeGeometry(nextGeometry ?? createDemoBufferGeometry());
      setAnalysis(result);
      setParameters((current) => ({
        ...current,
        ...result.recommendations,
      }));
      setStage("Analysis complete");
      toast.success("Geometry analysis complete");
    } catch (error) {
      setStage("Analysis failed");
      toast.error(error instanceof Error ? error.message : "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  useEffect(() => {
    analyze(null);
  }, [analyze]);

  const onFile = async (selected: File) => {
    try {
      validateMeshFile(selected);
      const parsed = await parseMeshBuffer(selected.name, await selected.arrayBuffer());
      setFile(selected);
      setGeometry(parsed);
      await analyze(parsed);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open the model.");
    }
  };

  const useDemo = async () => {
    setFile(null);
    setGeometry(null);
    await analyze(null);
  };

  const updateParameter = <K extends keyof MoldParameters>(
    key: K,
    value: MoldParameters[K],
  ) => setParameters((current) => ({ ...current, [key]: value }));

  const applyRecommendations = () => {
    if (!analysis) return;
    setParameters((current) => ({
      ...current,
      ...analysis.recommendations,
    }));
    toast.success("Recommended settings applied");
  };

  const generate = async () => {
    setIsGenerating(true);
    setGenerated(null);
    setProgress(7);
    setStage(pipeline[0]);
    let tick = 0;
    const timer = window.setInterval(() => {
      tick += 1;
      const next = Math.min(88, 7 + tick * 6);
      setProgress(next);
      setStage(pipeline[Math.min(pipeline.length - 1, Math.floor(next / 17))]);
    }, 520);
    try {
      const result = await generateMold(geometry, parameters);
      const upper = new Blob([result.upper.slice().buffer], { type: "model/stl" });
      const lower = new Blob([result.lower.slice().buffer], { type: "model/stl" });
      setGenerated({ upper, lower, stats: result.stats });
      setProgress(100);
      setStage("Ready to download");
      toast.success("Two-part mold generated");
    } catch (error) {
      setProgress(0);
      setStage("Generation failed");
      toast.error(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      window.clearInterval(timer);
      setIsGenerating(false);
    }
  };

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const modelName = file?.name ?? "Moldify demo part";
  const fileSize = file ? formatFileSize(file.size) : "Procedural";
  const undercut = analysis ? riskLabel(analysis.undercutRisk) : null;
  const tabs = useMemo(
    () => [
      { id: "wireframe" as const, label: "Wire", icon: ScanLine },
      { id: "mold" as const, label: "Mold", icon: Box },
      { id: "splitPlane" as const, label: "Split", icon: Layers3 },
      { id: "pins" as const, label: "Pins", icon: CircleGauge },
      { id: "channels" as const, label: "Flow", icon: Sparkles },
      { id: "section" as const, label: "Section", icon: Maximize2 },
    ],
    [],
  );

  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground lg:h-dvh lg:overflow-hidden">
      <header className="panel z-20 flex h-14 shrink-0 items-center justify-between border-b px-3 lg:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-md border border-primary/25 bg-primary/8">
            <Layers3 className="size-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight">Moldify</h1>
              <Badge variant="outline" className="h-4 border-primary/25 bg-primary/5 px-1.5 text-[9px] text-primary">
                LOCAL MVP
              </Badge>
            </div>
            <p className="truncate text-[10px] text-muted-foreground">
              Two-part mold studio · units: millimeters
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden gap-1.5 border-border/80 font-mono text-[10px] sm:flex">
            <span className="size-1.5 rounded-full bg-[#71805a]" />
            Engine ready
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="ghost" size="icon" className="size-8">
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
            <TooltipContent>Open Moldify on GitHub</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[280px_minmax(420px,1fr)_320px]">
        <aside className="panel order-2 border-b lg:order-1 lg:flex lg:min-h-0 lg:flex-col lg:border-r lg:border-b-0">
          <ScrollArea className="max-h-[560px] lg:min-h-0 lg:max-h-none lg:flex-1">
            <div className="space-y-4 p-3">
              <div>
                <p className="mono-label mb-2">01 · Source model</p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const dropped = event.dataTransfer.files[0];
                    if (dropped) onFile(dropped);
                  }}
                  className="group flex w-full flex-col items-center rounded-lg border border-dashed border-border bg-background/45 px-4 py-5 text-center transition hover:border-primary/50 hover:bg-primary/[0.035]"
                  data-testid="upload-dropzone"
                >
                  <span className="mb-3 grid size-10 place-items-center rounded-lg border bg-card shadow-sm transition group-hover:border-primary/30">
                    <Upload className="size-4 text-primary" />
                  </span>
                  <span className="text-xs font-medium">Drop a 3D model</span>
                  <span className="mt-1 text-[10px] text-muted-foreground">
                    STL, OBJ, GLB or 3MF · max 50 MB
                  </span>
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept=".stl,.obj,.glb,.3mf"
                  onChange={(event) => {
                    const selected = event.target.files?.[0];
                    if (selected) onFile(selected);
                  }}
                  data-testid="file-input"
                />
                <Button variant="secondary" size="sm" className="mt-2 w-full text-xs" onClick={useDemo}>
                  <FileBox className="size-3.5" />
                  Load demo part
                </Button>
              </div>

              <Separator />

              <section aria-labelledby="model-details">
                <div className="mb-2 flex items-center justify-between">
                  <p className="mono-label" id="model-details">Model details</p>
                  {isAnalyzing && <LoaderCircle className="size-3 animate-spin text-primary" />}
                </div>
                <div className="rounded-lg border bg-background/30 p-3">
                  <div className="flex items-start gap-2.5">
                    <FileBox className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium" title={modelName}>{modelName}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{fileSize}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 px-1.5 text-[9px]",
                        analysis?.watertight
                          ? "border-[#71805a]/30 bg-[#71805a]/8 text-[#64734d]"
                          : "border-[#a97845]/30 bg-[#a97845]/8 text-[#8d6034]",
                      )}
                    >
                      {analysis?.watertight ? "SOLID" : "CHECK"}
                    </Badge>
                  </div>
                  {analysis && (
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 text-[10px]">
                      <div>
                        <dt className="text-muted-foreground">Dimensions</dt>
                        <dd className="mt-0.5 font-mono text-[9px]">
                          {analysis.bounds.size.map((v) => formatNumber(v)).join(" × ")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Triangles</dt>
                        <dd className="mt-0.5 font-mono">{formatNumber(analysis.triangleCount, 0)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Manifold</dt>
                        <dd className="mt-0.5 font-mono">{Math.round(analysis.manifoldScore * 100)}%</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Best split</dt>
                        <dd className="mt-0.5 font-mono text-primary">{analysis.orientation} axis</dd>
                      </div>
                    </dl>
                  )}
                </div>
              </section>

              {analysis && (
                <section>
                  <p className="mono-label mb-2">Manufacturing check</p>
                  <div className="space-y-2 rounded-lg border bg-background/30 p-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Undercut risk</span>
                      <span className={cn("font-mono", undercut?.className)}>{undercut?.label}</span>
                    </div>
                    <Progress value={analysis.undercutRisk * 100} className="h-1" />
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Trapped regions</span>
                      <span className={cn("font-mono", riskLabel(analysis.trappedRegionRisk).className)}>
                        {riskLabel(analysis.trappedRegionRisk).label}
                      </span>
                    </div>
                    <Progress value={analysis.trappedRegionRisk * 100} className="h-1" />
                  </div>
                </section>
              )}

              {!!analysis?.warnings.length && (
                <div className="space-y-2">
                  {analysis.warnings.map((warning) => (
                    <div key={warning} className="flex gap-2 rounded-md border border-[#b18450]/25 bg-[#c9a46c]/10 p-2.5 text-[10px] leading-4 text-[#705033]">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0 text-[#9a6a32]" />
                      {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </aside>

        <section className="relative order-1 min-h-[500px] overflow-hidden border-b bg-[#e9dfd2] lg:order-2 lg:min-h-0 lg:border-b-0">
          <div className="absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-1 rounded-lg border bg-background/75 p-1 shadow-xl backdrop-blur-lg">
              {tabs.map(({ id, label, icon: Icon }) => (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewOptions[id] ? "secondary" : "ghost"}
                      size="sm"
                      className={cn(
                        "h-7 gap-1.5 px-2 text-[10px]",
                        viewOptions[id] && "bg-white/[0.09] text-foreground",
                      )}
                      onClick={() =>
                        setViewOptions((current) => ({ ...current, [id]: !current[id] }))
                      }
                      aria-pressed={viewOptions[id]}
                      data-testid={`toggle-${id}`}
                    >
                      <Icon className={cn("size-3", viewOptions[id] && "text-primary")} />
                      <span className="hidden xl:inline">{label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{label} preview</TooltipContent>
                </Tooltip>
              ))}
            </div>
            <div className="hidden rounded-md border bg-background/70 px-2 py-1.5 font-mono text-[9px] text-muted-foreground backdrop-blur md:block">
              LMB orbit · RMB pan · scroll zoom
            </div>
          </div>
          <MoldViewport geometry={geometry} parameters={parameters} options={viewOptions} />
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border bg-background/70 px-2.5 py-2 backdrop-blur">
            <p className="mono-label">Active object</p>
            <p className="mt-0.5 max-w-[220px] truncate text-[11px] font-medium">{modelName}</p>
          </div>
        </section>

        <aside className="panel order-3 border-t lg:flex lg:min-h-0 lg:flex-col lg:border-t-0 lg:border-l">
          <ScrollArea className="max-h-[720px] lg:min-h-0 lg:max-h-none lg:flex-1">
            <div className="p-3">
              <Tabs defaultValue="mold">
                <TabsList className="grid h-8 w-full grid-cols-2 bg-background/50">
                  <TabsTrigger value="mold" className="text-[10px]">Mold setup</TabsTrigger>
                  <TabsTrigger value="output" className="text-[10px]">Output</TabsTrigger>
                </TabsList>
                <TabsContent value="mold" className="mt-4 space-y-5">
                  <section>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="mono-label">Core geometry</p>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] text-primary" onClick={applyRecommendations}>
                        <WandSparkles className="size-3" />
                        Apply auto
                      </Button>
                    </div>
                    <div className="space-y-4">
                      <ParameterSlider
                        label="Wall thickness"
                        value={parameters.wallThickness}
                        range={PARAMETER_RANGES.wallThickness}
                        onChange={(value) => updateParameter("wallThickness", value)}
                      />
                      <ParameterSlider
                        label="Model clearance"
                        value={parameters.clearance}
                        range={PARAMETER_RANGES.clearance}
                        onChange={(value) => updateParameter("clearance", value)}
                      />
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <label className="text-[11px] text-muted-foreground">Split direction</label>
                          {analysis && (
                            <Badge variant="outline" className="h-4 border-primary/25 bg-primary/5 px-1 text-[8px] text-primary">
                              AUTO: {analysis.orientation}
                            </Badge>
                          )}
                        </div>
                        <Select
                          value={parameters.splitDirection}
                          onValueChange={(value) =>
                            updateParameter(
                              "splitDirection",
                              value as MoldParameters["splitDirection"],
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-full bg-background/35 text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["Auto", "X", "Y", "Z"].map((axis) => (
                              <SelectItem key={axis} value={axis} className="text-xs">
                                {axis === "Auto" ? "Auto — lowest demold risk" : `${axis} axis`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <ParameterSlider
                        label="Draft angle"
                        value={parameters.draftAngle}
                        range={PARAMETER_RANGES.draftAngle}
                        onChange={(value) => updateParameter("draftAngle", value)}
                      />
                      <ParameterSlider
                        label="Shrink compensation"
                        value={parameters.shrinkCompensation}
                        range={PARAMETER_RANGES.shrinkCompensation}
                        onChange={(value) => updateParameter("shrinkCompensation", value)}
                      />
                    </div>
                  </section>

                  <Separator />

                  <FeatureGroup
                    title="Alignment pins"
                    enabled={parameters.pinsEnabled}
                    onEnabled={(value) => updateParameter("pinsEnabled", value)}
                  >
                    <ParameterSlider
                      label="Pin count"
                      value={parameters.pinCount}
                      range={PARAMETER_RANGES.pinCount}
                      onChange={(value) => updateParameter("pinCount", value)}
                    />
                    <ParameterSlider
                      label="Pin diameter"
                      value={parameters.pinDiameter}
                      range={PARAMETER_RANGES.pinDiameter}
                      onChange={(value) => updateParameter("pinDiameter", value)}
                    />
                  </FeatureGroup>

                  <Separator />

                  <FeatureGroup
                    title="Pour channel"
                    enabled={parameters.pourEnabled}
                    onEnabled={(value) => updateParameter("pourEnabled", value)}
                  >
                    <ParameterSlider
                      label="Pour diameter"
                      value={parameters.pourDiameter}
                      range={PARAMETER_RANGES.pourDiameter}
                      onChange={(value) => updateParameter("pourDiameter", value)}
                    />
                  </FeatureGroup>

                  <FeatureGroup
                    title="Air vents"
                    enabled={parameters.ventsEnabled}
                    onEnabled={(value) => updateParameter("ventsEnabled", value)}
                  >
                    <ParameterSlider
                      label="Vent diameter"
                      value={parameters.ventDiameter}
                      range={PARAMETER_RANGES.ventDiameter}
                      onChange={(value) => updateParameter("ventDiameter", value)}
                    />
                  </FeatureGroup>

                  <div className="rounded-lg border border-primary/15 bg-primary/[0.035] p-3">
                    <div className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <div>
                        <p className="text-[11px] font-medium">Geometry recommendation</p>
                        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                          {analysis
                            ? `${analysis.orientation}-axis split scores ${analysis.orientationScores[analysis.orientation]}/100. Estimated generation: ${analysis.estimatedGenerationSeconds}s.`
                            : "Analyze a model to calculate deterministic mold settings."}
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="output" className="mt-4 space-y-4">
                  <div>
                    <p className="mono-label mb-3">Generation job</p>
                    <div className="rounded-lg border bg-background/30 p-3">
                      <div className="flex items-center justify-between text-[11px]">
                        <span>{stage}</span>
                        <span className="font-mono text-muted-foreground">{progress}%</span>
                      </div>
                      <Progress value={progress} className="mt-2 h-1.5" />
                      <div className="mt-3 space-y-2">
                        {pipeline.map((item, index) => {
                          const complete = progress >= (index + 1) * 16;
                          return (
                            <div key={item} className="flex items-center gap-2 text-[10px]">
                              <span className={cn("grid size-4 place-items-center rounded-full border", complete ? "border-primary/35 bg-primary/8 text-primary" : "text-muted-foreground")}>
                                {complete ? <Check className="size-2.5" /> : index + 1}
                              </span>
                              <span className={complete ? "text-foreground" : "text-muted-foreground"}>{item}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {generated && (
                    <div className="space-y-2" data-testid="downloads">
                      <OutputFile
                        name="Upper Mold.stl"
                        detail={`${formatNumber(generated.stats.upperTriangles, 0)} triangles`}
                        onDownload={() => download(generated.upper, "Upper Mold.stl")}
                      />
                      <OutputFile
                        name="Lower Mold.stl"
                        detail={`${formatNumber(generated.stats.lowerTriangles, 0)} triangles`}
                        onDownload={() => download(generated.lower, "Lower Mold.stl")}
                      />
                      <p className="px-1 font-mono text-[9px] text-muted-foreground">
                        Mold envelope: {generated.stats.moldSize.map((v) => formatNumber(v)).join(" × ")} mm
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
          <div className="border-t p-3">
            <Button
              className="h-10 w-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              onClick={generate}
              disabled={isGenerating || isAnalyzing}
              data-testid="generate-button"
            >
              {isGenerating ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <WandSparkles className="size-4" />
              )}
              {isGenerating ? "Generating mold…" : "Generate two-part mold"}
            </Button>
            <p className="mt-2 text-center text-[9px] text-muted-foreground">
              Processed in session · no cloud storage
            </p>
          </div>
        </aside>
      </div>

      <footer className="panel order-4 flex min-h-8 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-1.5 font-mono text-[9px] text-muted-foreground lg:px-4">
        <span className="flex items-center gap-1.5 text-primary">
          <span className="size-1.5 rounded-full bg-[#71805a]" />
          {stage}
        </span>
        <span>CSG: manifold-3d / WASM</span>
        <span>Raycast: three-mesh-bvh</span>
        <span className="ml-auto hidden md:inline">
          Session {sessionId}
        </span>
      </footer>
    </main>
  );
}

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
      <div className="mb-2 flex items-center justify-between">
        <label className="text-[11px] text-muted-foreground">{label}</label>
        <span className="min-w-14 rounded border bg-background/40 px-1.5 py-0.5 text-right font-mono text-[10px]">
          {value}{range.unit}
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
      <div className="mt-1 flex justify-between font-mono text-[8px] text-muted-foreground/60">
        <span>{range.min}{range.unit}</span>
        <span>{range.max}{range.unit}</span>
      </div>
    </div>
  );
}

function FeatureGroup({
  title,
  enabled,
  onEnabled,
  children,
}: {
  title: string;
  enabled: boolean;
  onEnabled: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <p className="mono-label">{title}</p>
        <Switch checked={enabled} onCheckedChange={onEnabled} aria-label={`Enable ${title}`} />
      </div>
      <div className={cn("space-y-4 transition-opacity", !enabled && "pointer-events-none opacity-35")}>
        {children}
      </div>
    </section>
  );
}

function OutputFile({
  name,
  detail,
  onDownload,
}: {
  name: string;
  detail: string;
  onDownload: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background/30 p-2.5">
      <div className="grid size-8 place-items-center rounded-md border bg-card">
        <Box className="size-3.5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium">{name}</p>
        <p className="font-mono text-[9px] text-muted-foreground">{detail}</p>
      </div>
      <Button variant="outline" size="icon" className="size-8" onClick={onDownload} aria-label={`Download ${name}`}>
        <Download className="size-3.5" />
      </Button>
    </div>
  );
}
