import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";

const tetrahedronTriangles = [
  [[0, 0, 0], [0, 10, 0], [10, 0, 0]],
  [[0, 0, 0], [10, 0, 0], [0, 0, 10]],
  [[0, 0, 0], [0, 0, 10], [0, 10, 0]],
  [[10, 0, 0], [0, 10, 0], [0, 0, 10]],
] as const;

function asciiStl(scale = 1) {
  const facets = tetrahedronTriangles
    .map(
      (triangle) => `facet normal 0 0 1
outer loop
${triangle
  .map((point) => `vertex ${point.map((value) => value * scale).join(" ")}`)
  .join("\n")}
endloop
endfacet`,
    )
    .join("\n");
  return Buffer.from(`solid tetrahedron\n${facets}\nendsolid tetrahedron`);
}

function objFile() {
  return Buffer.from(`v 0 0 0
v 0 10 0
v 10 0 0
v 0 0 10
f 1 2 3
f 1 3 4
f 1 4 2
f 3 2 4
`);
}

function detailedSphereObj(latitudeSegments = 96, longitudeSegments = 192) {
  const lines = ["v 0 12 0", "v 0 -12 0"];
  for (let latitude = 1; latitude < latitudeSegments; latitude += 1) {
    const phi = (Math.PI * latitude) / latitudeSegments;
    for (let longitude = 0; longitude < longitudeSegments; longitude += 1) {
      const theta = (Math.PI * 2 * longitude) / longitudeSegments;
      lines.push(
        `v ${12 * Math.sin(phi) * Math.cos(theta)} ${12 * Math.cos(phi)} ${12 * Math.sin(phi) * Math.sin(theta)}`,
      );
    }
  }
  const ring = (latitude: number, longitude: number) =>
    3 + latitude * longitudeSegments + (longitude % longitudeSegments);
  for (let longitude = 0; longitude < longitudeSegments; longitude += 1) {
    const next = (longitude + 1) % longitudeSegments;
    lines.push(`f 1 ${ring(0, next)} ${ring(0, longitude)}`);
    for (let latitude = 0; latitude < latitudeSegments - 2; latitude += 1) {
      const a = ring(latitude, longitude);
      const b = ring(latitude, next);
      const c = ring(latitude + 1, longitude);
      const d = ring(latitude + 1, next);
      lines.push(`f ${a} ${b} ${c}`, `f ${b} ${d} ${c}`);
    }
    lines.push(
      `f 2 ${ring(latitudeSegments - 2, longitude)} ${ring(latitudeSegments - 2, next)}`,
    );
  }
  return Buffer.from(lines.join("\n"));
}

function glbFile() {
  const positions = new Float32Array([
    0, 0, 0, 0, 10, 0, 10, 0, 0, 0, 0, 10,
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 0, 3, 1, 2, 1, 3,
  ]);
  const binary = Buffer.alloc(72);
  Buffer.from(positions.buffer).copy(binary, 0);
  Buffer.from(indices.buffer).copy(binary, 48);
  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0 },
            indices: 1,
          },
        ],
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 4,
        type: "VEC3",
        min: [0, 0, 0],
        max: [10, 10, 10],
      },
      {
        bufferView: 1,
        componentType: 5123,
        count: 12,
        type: "SCALAR",
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 48 },
      { buffer: 0, byteOffset: 48, byteLength: 24 },
    ],
    buffers: [{ byteLength: binary.byteLength }],
  };
  const jsonSource = JSON.stringify(json);
  const jsonLength = Math.ceil(Buffer.byteLength(jsonSource) / 4) * 4;
  const jsonChunk = Buffer.alloc(jsonLength, 0x20);
  jsonChunk.write(jsonSource);
  const output = Buffer.alloc(12 + 8 + jsonLength + 8 + binary.byteLength);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.byteLength, 8);
  output.writeUInt32LE(jsonLength, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  jsonChunk.copy(output, 20);
  const binaryHeader = 20 + jsonLength;
  output.writeUInt32LE(binary.byteLength, binaryHeader);
  output.writeUInt32LE(0x004e4942, binaryHeader + 4);
  binary.copy(output, binaryHeader + 8);
  return output;
}

async function threeMfFile() {
  const zip = new JSZip();
  zip.file(
    "3D/3dmodel.model",
    `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/>
          <vertex x="0" y="10" z="0"/>
          <vertex x="10" y="0" z="0"/>
          <vertex x="0" y="0" z="10"/>
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2"/>
          <triangle v1="0" v2="2" v3="3"/>
          <triangle v1="0" v2="3" v3="1"/>
          <triangle v1="2" v2="1" v3="3"/>
        </triangles>
      </mesh>
    </object>
  </resources>
  <build><item objectid="1"/></build>
</model>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

async function expectStudioReady(page: Page) {
  await expect(page.locator('[data-testid="3d-viewport"]')).toBeVisible();
  await expect(
    page.locator('[data-testid="generate-button"]:visible'),
  ).toBeEnabled({ timeout: 60_000 });
}

test("generates and downloads a local two-part mold", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const apiRequests: string[] = [];
  const consoleErrors: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) {
      apiRequests.push(request.url());
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Moldify", exact: true }),
  ).toBeVisible();
  if (await page.locator('[data-testid="unsupported-browser"]').isVisible()) {
    test.skip(
      true,
      `${testInfo.project.name} does not expose the required WebGL context on this runner.`,
    );
  }

  const mobile = testInfo.project.name === "mobile-safari";
  if (!mobile) {
    await expectStudioReady(page);
  }
  if (mobile) {
    await page.getByRole("button", { name: "Setup", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Mold setup" })).toBeVisible();
  }

  await expect(
    page.getByRole("heading", { name: "Recommended" }).last(),
  ).toBeVisible({ timeout: 60_000 });
  await page
    .getByRole("button", { name: "Apply", exact: true })
    .filter({ visible: true })
    .click();

  if (mobile) {
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Export", exact: true }).click();
  }

  const generate = page.locator('[data-testid="generate-button"]:visible');
  await expect(generate).toBeEnabled();
  await generate.click();
  await expect(page.getByText("Ready to download", { exact: true }).last()).toBeVisible({
    timeout: 60_000,
  });

  const upperDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Upper Mold.stl" }).click();
  const upperDownload = await upperDownloadPromise;
  expect(upperDownload.suggestedFilename()).toBe("Upper Mold.stl");

  const lowerDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Lower Mold.stl" }).click();
  const lowerDownload = await lowerDownloadPromise;
  expect(lowerDownload.suggestedFilename()).toBe("Lower Mold.stl");

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter(({ impact }) =>
      impact === "critical" || impact === "serious",
    ),
  ).toEqual([]);
  expect(apiRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("loads STL, OBJ, GLB and 3MF files in the worker", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium");
  test.setTimeout(240_000);
  await page.goto("/");
  await expectStudioReady(page);
  const input = page.locator('[data-testid="file-input"]');
  const files = [
    { name: "part.stl", mimeType: "model/stl", buffer: asciiStl() },
    { name: "part.obj", mimeType: "text/plain", buffer: objFile() },
    {
      name: "part.glb",
      mimeType: "model/gltf-binary",
      buffer: glbFile(),
    },
    {
      name: "part.3mf",
      mimeType: "model/3mf",
      buffer: await threeMfFile(),
    },
  ];

  for (const file of files) {
    await input.setInputFiles(file);
    await expect(page.getByText(file.name, { exact: true }).first()).toBeVisible();
    await expectStudioReady(page);
  }
});

test("marks generated files stale after a setup change", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium");
  await page.goto("/");
  await expectStudioReady(page);
  await page.locator('[data-testid="generate-button"]:visible').click();
  await expect(page.getByText("Ready to download", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("tab", { name: "Setup" }).click();
  await page.getByRole("slider", { name: "Wall thickness" }).press("ArrowRight");
  await page.getByRole("tab", { name: "Export" }).click();
  await expect(
    page.getByText(/Settings changed after the last generation/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download Upper Mold.stl" }),
  ).toBeDisabled();
});

test("recovers from an invalid upload without a page reload", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium");
  await page.goto("/");
  const input = page.locator('[data-testid="file-input"]');
  await input.setInputFiles({
    name: "broken.stl",
    mimeType: "model/stl",
    buffer: Buffer.from("not an stl"),
  });
  await expect(page.getByText(/triangle|STL|mesh/i).last()).toBeVisible();
  await input.setInputFiles({
    name: "recovered.stl",
    mimeType: "model/stl",
    buffer: asciiStl(),
  });
  await expect(page.getByText("recovered.stl", { exact: true }).first()).toBeVisible();
  await expectStudioReady(page);
});

test("stays responsive while the worker analyzes a detailed model", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium");
  test.setTimeout(150_000);
  await page.goto("/");
  await expectStudioReady(page);
  await page.locator('[data-testid="file-input"]').setInputFiles({
    name: "detailed-sphere.obj",
    mimeType: "text/plain",
    buffer: detailedSphereObj(),
  });

  await page.getByRole("button", { name: "Help" }).click();
  await expect(
    page.getByRole("heading", { name: "Using Moldify" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(
    page.getByText("detailed-sphere.obj", { exact: true }).first(),
  ).toBeVisible();
  await expectStudioReady(page);
});

test("cancels a generation job and retries with a fresh worker", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium");
  test.setTimeout(150_000);
  await page.goto("/");
  await expectStudioReady(page);
  const generate = page.locator('[data-testid="generate-button"]:visible');
  await generate.evaluate(async (button) => {
    (button as HTMLButtonElement).click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const cancel = [...document.querySelectorAll("button")].find((candidate) =>
      candidate.textContent?.includes("Cancel generation"),
    );
    if (!(cancel instanceof HTMLButtonElement)) {
      throw new Error("Cancel generation control did not render.");
    }
    cancel.click();
  });

  await expect(generate).toBeEnabled();
  await generate.click();
  await expect(page.getByText("Ready to download", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
});

test("updates viewport layers and accepts camera controls", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expectStudioReady(page);
  await page.locator('[data-testid="file-input"]').setInputFiles({
    name: "Opel_Mokka_Becher_Ablage_2_Fächer.stl",
    mimeType: "model/stl",
    buffer: asciiStl(40),
  });
  await expectStudioReady(page);

  const sourcePanel = page.locator('[data-testid="source-panel-scroll"]');
  const sourceName = page.locator('[data-testid="source-file-name"]');
  const summaryName = page.locator('[data-testid="summary-file-name"]');
  const replaceLabel = page.locator('[data-testid="replace-label"]');
  await expect(sourcePanel).toHaveCSS("overflow-x", "hidden");
  await expect(sourceName).toBeVisible();
  await expect(summaryName).toBeVisible();
  await expect(replaceLabel).toBeVisible();
  expect(
    await sourcePanel.evaluate(
      (panel) => panel.getBoundingClientRect().width <= 289,
    ),
  ).toBe(true);
  expect(
    await sourcePanel.evaluate((panel) => {
      const panelBounds = panel.getBoundingClientRect();
      const targets = panel.querySelectorAll(
        '[data-testid="source-file-name"], [data-testid="summary-file-name"], [data-testid="replace-label"]',
      );
      return [...targets].every((target) => {
        const bounds = target.getBoundingClientRect();
        return (
          bounds.left >= panelBounds.left &&
          bounds.right <= panelBounds.right
        );
      });
    }),
  ).toBe(true);
  expect(
    await sourceName.evaluate(
      (name) => name.scrollWidth > name.clientWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);

  const wireframe = page.locator('[data-testid="toggle-wireframe"]');
  const viewport = page.locator('[data-testid="3d-viewport"]');
  await expect(viewport).toHaveAttribute("data-depth-fog", "disabled");
  await expect(wireframe).toHaveAttribute("aria-pressed", "false");
  await wireframe.click();
  await expect(wireframe).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Isometric view (1)" }).click();
  await expect(viewport).toHaveAttribute("data-camera-command", "iso");
  const isoPosition = await viewport.getAttribute("data-camera-position");
  expect(isoPosition).toBeTruthy();

  await page.getByRole("button", { name: "Top view (2)" }).click();
  await expect(viewport).toHaveAttribute("data-camera-command", "top");
  const topPosition = await viewport.getAttribute("data-camera-position");
  expect(topPosition).toBeTruthy();
  expect(topPosition).not.toBe(isoPosition);

  await page.getByRole("button", { name: "Fit model (F)" }).click();
  await expect(viewport).toHaveAttribute("data-camera-command", "fit");
  await expect(viewport).not.toHaveAttribute("data-camera-position");

  await page.getByRole("button", { name: "Reset view (R)" }).click();
  await expect(viewport).toHaveAttribute("data-camera-command", "reset");
  await expect(viewport).toHaveAttribute("data-camera-position", /.+/);
  expect(errors).toEqual([]);
});

test("shows a clear message when required browser capabilities are missing", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium");
  await page.addInitScript(() => {
    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto("/");
  await expect(page.locator('[data-testid="unsupported-browser"]')).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "This browser cannot run Moldify" }),
  ).toBeVisible();
});
