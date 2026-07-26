"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Bounds,
  Edges,
  GizmoHelper,
  GizmoViewport,
  Grid,
  OrbitControls,
  useBounds,
} from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import {
  Box3,
  BufferGeometry,
  Color,
  DoubleSide,
  Vector3,
} from "three";
import type { MoldParameters } from "@/lib/mold-types";
import { createDemoBufferGeometry } from "@/lib/demo-geometry";
import type { CameraCommand } from "@/components/studio/studio-types";

export type ViewOptions = {
  wireframe: boolean;
  mold: boolean;
  splitPlane: boolean;
  pins: boolean;
  channels: boolean;
  section: boolean;
};

type Props = {
  geometry: BufferGeometry | null;
  parameters: MoldParameters;
  options: ViewOptions;
  cameraCommand: CameraCommand;
};

type CameraPose = {
  position: [number, number, number];
  target: [number, number, number];
  up?: [number, number, number];
};

function axisIndex(axis: MoldParameters["splitDirection"]) {
  return axis === "X" ? 0 : axis === "Y" ? 1 : 2;
}

function CameraRig({
  command,
  onApplied,
}: {
  command: CameraCommand;
  onApplied: (command: CameraCommand, pose: CameraPose | null) => void;
}) {
  const bounds = useBounds();
  const { camera, controls, invalidate } = useThree();

  useEffect(() => {
    const refreshedBounds = bounds.refresh().clip();
    if (command.type === "fit") {
      refreshedBounds.fit();
      onApplied(command, null);
      return;
    }

    const { center, distance } = refreshedBounds.getSize();
    const target = center.toArray() as [number, number, number];
    const viewDistance = Math.max(distance, 1);
    const poses: Record<Exclude<CameraCommand["type"], "fit">, CameraPose> = {
      reset: {
        position: [
          center.x + viewDistance * 0.62,
          center.y + viewDistance * 0.5,
          center.z + viewDistance * 0.7,
        ],
        target,
      },
      iso: {
        position: [
          center.x + viewDistance * 0.62,
          center.y + viewDistance * 0.5,
          center.z + viewDistance * 0.7,
        ],
        target,
      },
      top: {
        position: [center.x, center.y + viewDistance, center.z],
        target,
        up: [0, 0, -1],
      },
      front: {
        position: [center.x, center.y, center.z + viewDistance],
        target,
      },
    };
    const pose = poses[command.type];
    camera.up.set(...(pose.up ?? [0, 1, 0]));
    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const orbit = controls as
      | { target?: Vector3; update?: () => void }
      | undefined;
    orbit?.target?.set(...pose.target);
    orbit?.update?.();
    invalidate();
    onApplied(command, pose);
  }, [bounds, camera, command, controls, invalidate, onApplied]);

  return null;
}

function MoldPreview({
  geometry,
  parameters,
  options,
  cameraCommand,
  onCameraApplied,
}: Props & {
  onCameraApplied: (command: CameraCommand, pose: CameraPose | null) => void;
}) {
  const preview = useMemo(
    () => (geometry ? geometry.clone() : createDemoBufferGeometry()),
    [geometry],
  );
  const modelBounds = useMemo(() => {
    preview.computeBoundingBox();
    return preview.boundingBox ?? new Box3().setFromObject({} as never);
  }, [preview]);
  const size = useMemo(() => modelBounds.getSize(new Vector3()), [modelBounds]);
  const maxDimension = Math.max(size.x, size.y, size.z, 1);
  const moldSize = [
    size.x + parameters.wallThickness * 2,
    size.y + parameters.wallThickness * 2,
    size.z + parameters.wallThickness * 2,
  ] as [number, number, number];
  const splitAxis =
    parameters.splitDirection === "Auto" ? "Z" : parameters.splitDirection;
  const splitIndex = axisIndex(splitAxis);
  const halfSize = [...moldSize] as [number, number, number];
  halfSize[splitIndex] /= 2;
  const lowerPosition: [number, number, number] = [0, 0, 0];
  const upperPosition: [number, number, number] = [0, 0, 0];
  lowerPosition[splitIndex] = -halfSize[splitIndex] * 0.52;
  upperPosition[splitIndex] = halfSize[splitIndex] * (options.section ? 0.88 : 0.52);

  const pinPositions = [
    [-moldSize[0] * 0.35, -moldSize[1] * 0.35],
    [moldSize[0] * 0.35, -moldSize[1] * 0.35],
    [moldSize[0] * 0.35, moldSize[1] * 0.35],
    [-moldSize[0] * 0.35, moldSize[1] * 0.35],
  ].slice(0, parameters.pinCount);

  return (
    <Bounds fit clip observe margin={1.35}>
      <CameraRig command={cameraCommand} onApplied={onCameraApplied} />
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={preview}>
          <meshStandardMaterial
            color={new Color("#a9785c")}
            roughness={0.55}
            metalness={0.12}
            wireframe={options.wireframe}
          />
          <Edges color="#684b3b" threshold={28} />
        </mesh>

        {options.mold && (
          <>
            <mesh position={lowerPosition}>
              <boxGeometry args={halfSize} />
              <meshPhysicalMaterial
                color="#b98a68"
                transparent
                opacity={0.24}
                roughness={0.35}
                transmission={0.12}
                depthWrite={false}
                side={DoubleSide}
              />
              <Edges color="#8f6248" threshold={15} />
            </mesh>
            <mesh position={upperPosition}>
              <boxGeometry args={halfSize} />
              <meshPhysicalMaterial
                color="#d7b997"
                transparent
                opacity={0.27}
                roughness={0.34}
                transmission={0.1}
                depthWrite={false}
                side={DoubleSide}
              />
              <Edges color="#a88260" threshold={15} />
            </mesh>
          </>
        )}

        {options.splitPlane && (
          <mesh
            rotation={
              splitAxis === "X"
                ? [0, Math.PI / 2, 0]
                : splitAxis === "Y"
                  ? [Math.PI / 2, 0, 0]
                  : [0, 0, 0]
            }
          >
            <planeGeometry args={[maxDimension * 1.6, maxDimension * 1.6]} />
            <meshBasicMaterial
              color="#b8955d"
              transparent
              opacity={0.18}
              side={DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )}

        {options.pins &&
          parameters.pinsEnabled &&
          pinPositions.map(([x, y], index) => (
            <mesh key={index} position={[x, y, 0]}>
              <cylinderGeometry
                args={[parameters.pinDiameter / 2, parameters.pinDiameter / 2, 6, 24]}
              />
              <meshStandardMaterial color="#8a674d" metalness={0.12} roughness={0.48} />
            </mesh>
          ))}

        {options.channels && parameters.pourEnabled && (
          <mesh position={[0, 0, size.z * 0.58]}>
            <cylinderGeometry
              args={[parameters.pourDiameter / 2, parameters.pourDiameter / 2, moldSize[2] * 0.8, 32]}
            />
            <meshStandardMaterial color="#b36f52" emissive="#5d2f20" emissiveIntensity={0.12} />
          </mesh>
        )}
        {options.channels &&
          parameters.ventsEnabled &&
          [-1, 1].map((sign) => (
            <mesh key={sign} position={[sign * size.x * 0.34, 0, size.z * 0.58]}>
              <cylinderGeometry
                args={[
                  parameters.ventDiameter / 2,
                  parameters.ventDiameter / 2,
                  moldSize[2] * 0.8,
                  18,
                ]}
              />
              <meshStandardMaterial color="#a78654" emissive="#5a4527" emissiveIntensity={0.1} />
            </mesh>
          ))}
      </group>
    </Bounds>
  );
}

export function MoldViewport(props: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const handleCameraApplied = useCallback(
    (command: CameraCommand, pose: CameraPose | null) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      viewport.dataset.cameraCommand = command.type;
      viewport.dataset.cameraCommandId = String(command.id);
      if (pose) {
        viewport.dataset.cameraPosition = pose.position.join(",");
      } else {
        delete viewport.dataset.cameraPosition;
      }
    },
    [],
  );

  return (
    <div
      ref={viewportRef}
      className="h-full min-h-[320px] w-full"
      data-testid="3d-viewport"
      data-depth-fog="disabled"
    >
      <Canvas
        camera={{ position: [65, 52, 72], fov: 42, near: 0.1, far: 2000 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#eee6da"]} />
        <ambientLight intensity={1.35} />
        <directionalLight position={[40, 65, 80]} intensity={2.2} color="#fff5e8" />
        <directionalLight position={[-50, -30, 25]} intensity={0.9} color="#d2b99f" />
        <Suspense fallback={null}>
          <MoldPreview {...props} onCameraApplied={handleCameraApplied} />
        </Suspense>
        <Grid
          args={[280, 280]}
          position={[0, -32, 0]}
          cellSize={5}
          cellThickness={0.55}
          cellColor="#d2c4b3"
          sectionSize={25}
          sectionThickness={0.9}
          sectionColor="#b9a58f"
          fadeDistance={240}
          fadeStrength={1}
          infiniteGrid
        />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        <GizmoHelper alignment="bottom-right" margin={[72, 62]}>
          <GizmoViewport
            axisColors={["#b86d5f", "#73835f", "#6f8097"]}
            labelColor="#f8f1e8"
          />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}
