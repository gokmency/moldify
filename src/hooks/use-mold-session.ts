"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
} from "three";
import { toast } from "sonner";
import { detectBrowserSupport } from "@/lib/browser-capabilities";
import { createDemoBufferGeometry } from "@/lib/demo-geometry";
import type {
  GeometryWorkerRequest,
  GeometryWorkerResponse,
} from "@/lib/geometry-worker-protocol";
import { validateMeshFile } from "@/lib/mesh-loader";
import {
  DEFAULT_PARAMETERS,
  type AnalysisResult,
  type MoldParameters,
} from "@/lib/mold-types";

export type SessionStatus =
  | "idle"
  | "analyzing"
  | "ready"
  | "generating"
  | "generated"
  | "error"
  | "unsupported";

export type GeneratedFiles = {
  upper: Blob;
  lower: Blob;
  stats: {
    axis: "X" | "Y" | "Z";
    upperTriangles: number;
    lowerTriangles: number;
    watertight: boolean;
    moldSize: number[];
  };
};

type PendingJob = {
  resolve: (message: GeometryWorkerResponse) => void;
  reject: (error: Error) => void;
};

function transferablePositions(geometry: BufferGeometry) {
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = nonIndexed.getAttribute("position");
  if (!position) throw new Error("Mesh has no vertex positions.");
  const positions = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    positions[index * 3] = position.getX(index);
    positions[index * 3 + 1] = position.getY(index);
    positions[index * 3 + 2] = position.getZ(index);
  }
  return positions.buffer;
}

function geometryFromPositions(positions: ArrayBuffer) {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
  return geometry;
}

export function useMoldSession() {
  const [file, setFile] = useState<File | null>(null);
  const [geometry, setGeometry] = useState<BufferGeometry>(() =>
    createDemoBufferGeometry(),
  );
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [parameters, setParameters] =
    useState<MoldParameters>(DEFAULT_PARAMETERS);
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Preparing studio");
  const [generated, setGenerated] = useState<GeneratedFiles | null>(null);
  const [isStale, setIsStale] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const pendingJobs = useRef(new Map<string, PendingJob>());
  const activeJobId = useRef<string | null>(null);

  const createWorker = useCallback(() => {
    const nextWorker = new Worker(
      new URL("../workers/geometry-worker.ts", import.meta.url),
      { type: "module" },
    );
    nextWorker.onmessage = (event: MessageEvent<GeometryWorkerResponse>) => {
      const message = event.data;
      if (message.type === "progress") {
        if (message.jobId !== activeJobId.current) return;
        setProgress(message.progress);
        setStage(message.label);
        return;
      }
      const pending = pendingJobs.current.get(message.jobId);
      if (!pending) return;
      pendingJobs.current.delete(message.jobId);
      if (message.type === "error") {
        pending.reject(new Error(message.message));
      } else {
        pending.resolve(message);
      }
    };
    nextWorker.onerror = () => {
      for (const pending of pendingJobs.current.values()) {
        pending.reject(new Error("The local geometry worker stopped unexpectedly."));
      }
      pendingJobs.current.clear();
      workerRef.current = null;
    };
    workerRef.current = nextWorker;
    return nextWorker;
  }, []);

  const requestWorker = useCallback(
    (request: GeometryWorkerRequest) =>
      new Promise<GeometryWorkerResponse>((resolve, reject) => {
        const worker = workerRef.current ?? createWorker();
        pendingJobs.current.set(request.jobId, { resolve, reject });
        const transfer =
          request.type === "generate"
            ? [request.positions]
            : request.source.kind === "file"
              ? [request.source.buffer]
              : [request.source.positions];
        worker.postMessage(request, transfer);
      }),
    [createWorker],
  );

  const analyzeSourceInWorker = useCallback(
    async (
      source: Extract<GeometryWorkerRequest, { type: "analyze" }>["source"],
      nextFile: File | null,
    ) => {
      setStatus("analyzing");
      setStage("Inspecting geometry");
      setProgress(0);
      const jobId = crypto.randomUUID();
      activeJobId.current = jobId;
      try {
        const message = await requestWorker({
          type: "analyze",
          jobId,
          source,
        });
        if (message.type !== "analysis") {
          throw new Error("Unexpected analysis response.");
        }
        if (activeJobId.current !== jobId) return false;
        setGeometry((current) => {
          current.dispose();
          return geometryFromPositions(message.positions);
        });
        setFile(nextFile);
        setAnalysis(message.result);
        setParameters((current) => ({
          ...current,
          ...message.result.recommendations,
        }));
        setStatus("ready");
        setStage("Model ready");
        return true;
      } catch (error) {
        if (activeJobId.current !== jobId) return false;
        setStatus("error");
        setStage("Analysis needs attention");
        toast.error(error instanceof Error ? error.message : "Analysis failed.");
        return false;
      } finally {
        if (activeJobId.current === jobId) activeJobId.current = null;
      }
    },
    [requestWorker],
  );

  useEffect(() => {
    const jobs = pendingJobs.current;
    const saved = localStorage.getItem("moldify-parameters");
    if (saved) {
      try {
        setParameters({ ...DEFAULT_PARAMETERS, ...JSON.parse(saved) });
      } catch {
        localStorage.removeItem("moldify-parameters");
      }
    }
    if (!detectBrowserSupport().supported) {
      setStatus("unsupported");
      setStage("Browser not supported");
      return () => jobs.clear();
    }
    const demo = createDemoBufferGeometry();
    setGeometry((current) => {
      current.dispose();
      return demo;
    });
    void analyzeSourceInWorker(
      { kind: "positions", positions: transferablePositions(demo) },
      null,
    );
    return () => {
      workerRef.current?.terminate();
      jobs.clear();
    };
  }, [analyzeSourceInWorker]);

  useEffect(() => {
    localStorage.setItem("moldify-parameters", JSON.stringify(parameters));
  }, [parameters]);

  const loadFile = useCallback(
    async (selected: File) => {
      try {
        validateMeshFile(selected);
        setStatus("analyzing");
        setStage("Opening model");
        const buffer = await selected.arrayBuffer();
        setGenerated(null);
        setIsStale(false);
        await analyzeSourceInWorker(
          { kind: "file", name: selected.name, buffer },
          selected,
        );
      } catch (error) {
        setStatus("error");
        setStage("Model could not be opened");
        toast.error(
          error instanceof Error ? error.message : "Unable to open the model.",
        );
      }
    },
    [analyzeSourceInWorker],
  );

  const useDemo = useCallback(async () => {
    const demo = createDemoBufferGeometry();
    setGeometry((current) => {
      current.dispose();
      return demo;
    });
    setGenerated(null);
    setIsStale(false);
    await analyzeSourceInWorker(
      { kind: "positions", positions: transferablePositions(demo) },
      null,
    );
  }, [analyzeSourceInWorker]);

  const updateParameter = useCallback(
    <K extends keyof MoldParameters>(key: K, value: MoldParameters[K]) => {
      setParameters((current) => ({ ...current, [key]: value }));
      if (generated) setIsStale(true);
    },
    [generated],
  );

  const applyRecommendations = useCallback(() => {
    if (!analysis) return;
    setParameters((current) => ({
      ...current,
      ...analysis.recommendations,
    }));
    if (generated) setIsStale(true);
  }, [analysis, generated]);

  const generate = useCallback(async () => {
    const jobId = crypto.randomUUID();
    activeJobId.current = jobId;
    setStatus("generating");
    setProgress(4);
    setStage("Starting local worker");
    try {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      });
      if (activeJobId.current !== jobId) return false;
      const message = await requestWorker({
        type: "generate",
        jobId,
        positions: transferablePositions(geometry),
        parameters,
      });
      if (message.type !== "generated") {
        throw new Error("Unexpected generation response.");
      }
      if (activeJobId.current !== jobId) return false;
      setGenerated({
        upper: new Blob([message.upper], { type: "model/stl" }),
        lower: new Blob([message.lower], { type: "model/stl" }),
        stats: message.stats,
      });
      setIsStale(false);
      setStatus("generated");
      setProgress(100);
      setStage("Ready to download");
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return false;
      }
      setStatus("error");
      setProgress(0);
      setStage("Generation needs attention");
      toast.error(
        error instanceof Error ? error.message : "Generation failed.",
      );
      return false;
    } finally {
      if (activeJobId.current === jobId) activeJobId.current = null;
    }
  }, [geometry, parameters, requestWorker]);

  const cancelGeneration = useCallback(() => {
    const jobId = activeJobId.current;
    if (jobId) {
      pendingJobs.current
        .get(jobId)
        ?.reject(new DOMException("Generation cancelled.", "AbortError"));
      pendingJobs.current.delete(jobId);
    }
    workerRef.current?.terminate();
    workerRef.current = null;
    activeJobId.current = null;
    setStatus(analysis ? "ready" : "idle");
    setProgress(0);
    setStage("Generation cancelled");
  }, [analysis]);

  const download = useCallback((blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  return {
    file,
    geometry,
    analysis,
    parameters,
    status,
    progress,
    stage,
    generated,
    isStale,
    loadFile,
    useDemo,
    updateParameter,
    applyRecommendations,
    generate,
    cancelGeneration,
    download,
  };
}

export type MoldSession = ReturnType<typeof useMoldSession>;
