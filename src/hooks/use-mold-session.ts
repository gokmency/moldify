"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
} from "three";
import { toast } from "sonner";
import { createDemoBufferGeometry } from "@/lib/demo-geometry";
import type {
  GeometryWorkerRequest,
  GeometryWorkerResponse,
} from "@/lib/geometry-worker-protocol";
import { parseMeshBuffer, validateMeshFile } from "@/lib/mesh-loader";
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
  | "error";

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

function geometryForViewport(geometry: BufferGeometry) {
  const clone = geometry.clone();
  const position = clone.getAttribute("position");
  if (position && !(position instanceof Float32BufferAttribute)) {
    clone.setAttribute(
      "position",
      new Float32BufferAttribute(
        Float32Array.from({ length: position.count * 3 }, (_, index) => {
          const vertex = Math.floor(index / 3);
          const axis = index % 3;
          return axis === 0
            ? position.getX(vertex)
            : axis === 1
              ? position.getY(vertex)
              : position.getZ(vertex);
        }),
        3,
      ),
    );
  }
  return clone;
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
  const [sessionId, setSessionId] = useState("LOCAL");
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
        worker.postMessage(request, [request.positions]);
      }),
    [createWorker],
  );

  const analyzeGeometryInWorker = useCallback(
    async (nextGeometry: BufferGeometry) => {
      setStatus("analyzing");
      setStage("Inspecting geometry");
      setProgress(0);
      const jobId = crypto.randomUUID();
      activeJobId.current = jobId;
      try {
        const message = await requestWorker({
          type: "analyze",
          jobId,
          positions: transferablePositions(nextGeometry),
        });
        if (message.type !== "analysis") {
          throw new Error("Unexpected analysis response.");
        }
        setAnalysis(message.result);
        setParameters((current) => ({
          ...current,
          ...message.result.recommendations,
        }));
        setStatus("ready");
        setStage("Model ready");
        toast.success("Geometry check complete");
      } catch (error) {
        setStatus("error");
        setStage("Analysis needs attention");
        toast.error(error instanceof Error ? error.message : "Analysis failed.");
      } finally {
        activeJobId.current = null;
      }
    },
    [requestWorker],
  );

  useEffect(() => {
    const jobs = pendingJobs.current;
    setSessionId(crypto.randomUUID().slice(0, 6).toUpperCase());
    const saved = localStorage.getItem("moldify-parameters");
    if (saved) {
      try {
        setParameters({ ...DEFAULT_PARAMETERS, ...JSON.parse(saved) });
      } catch {
        localStorage.removeItem("moldify-parameters");
      }
    }
    const demo = createDemoBufferGeometry();
    setGeometry(demo);
    void analyzeGeometryInWorker(demo);
    return () => {
      workerRef.current?.terminate();
      jobs.clear();
    };
  }, [analyzeGeometryInWorker]);

  useEffect(() => {
    localStorage.setItem("moldify-parameters", JSON.stringify(parameters));
  }, [parameters]);

  const loadFile = useCallback(
    async (selected: File) => {
      try {
        validateMeshFile(selected);
        setStatus("analyzing");
        setStage("Opening model");
        const parsed = await parseMeshBuffer(
          selected.name,
          await selected.arrayBuffer(),
        );
        const preview = geometryForViewport(parsed);
        setFile(selected);
        setGeometry(preview);
        setGenerated(null);
        setIsStale(false);
        await analyzeGeometryInWorker(preview);
      } catch (error) {
        setStatus("error");
        setStage("Model could not be opened");
        toast.error(
          error instanceof Error ? error.message : "Unable to open the model.",
        );
      }
    },
    [analyzeGeometryInWorker],
  );

  const useDemo = useCallback(async () => {
    const demo = createDemoBufferGeometry();
    setFile(null);
    setGeometry(demo);
    setGenerated(null);
    setIsStale(false);
    await analyzeGeometryInWorker(demo);
  }, [analyzeGeometryInWorker]);

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
    toast.success("Suggested setup applied");
  }, [analysis, generated]);

  const generate = useCallback(async () => {
    const jobId = crypto.randomUUID();
    activeJobId.current = jobId;
    setStatus("generating");
    setProgress(4);
    setStage("Starting local worker");
    try {
      const message = await requestWorker({
        type: "generate",
        jobId,
        positions: transferablePositions(geometry),
        parameters,
      });
      if (message.type !== "generated") {
        throw new Error("Unexpected generation response.");
      }
      setGenerated({
        upper: new Blob([message.upper], { type: "model/stl" }),
        lower: new Blob([message.lower], { type: "model/stl" }),
        stats: message.stats,
      });
      setIsStale(false);
      setStatus("generated");
      setProgress(100);
      setStage("Ready to download");
      toast.success("Two-part mold generated");
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
      activeJobId.current = null;
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
    toast.message("Generation cancelled");
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
    sessionId,
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
