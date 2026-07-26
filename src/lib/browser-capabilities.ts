export type BrowserCapabilitySignals = {
  worker: boolean;
  wasm: boolean;
  webgl: boolean;
  download: boolean;
};

export type BrowserSupport = {
  supported: boolean;
  missing: Array<keyof BrowserCapabilitySignals>;
};

export function browserSupportFromSignals(
  signals: BrowserCapabilitySignals,
): BrowserSupport {
  const missing = (
    Object.entries(signals) as Array<
      [keyof BrowserCapabilitySignals, boolean]
    >
  )
    .filter(([, supported]) => !supported)
    .map(([capability]) => capability);
  return { supported: missing.length === 0, missing };
}

export function detectBrowserSupport(): BrowserSupport {
  const canvas = document.createElement("canvas");
  const webgl = Boolean(
    canvas.getContext("webgl2") || canvas.getContext("webgl"),
  );
  const anchor = document.createElement("a");
  return browserSupportFromSignals({
    worker: typeof Worker !== "undefined",
    wasm: typeof WebAssembly !== "undefined",
    webgl,
    download:
      "download" in anchor &&
      typeof URL !== "undefined" &&
      typeof URL.createObjectURL === "function",
  });
}
