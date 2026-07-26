"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Bounds,
  Edges,
  GizmoHelper,
  GizmoViewport,
  Grid,
  OrbitControls,
} from "@react-three/drei";
import {
  Box3,
  BufferGeometry,
  Color,
  DoubleSide,
  Vector3,
} from "three";
import type { MoldParameters } from "@/lib/mold-types";
import { createDemoBufferGeometry } from "@/lib/demo-geometry";

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
};

function axisIndex(axis: MoldParameters["splitDirection"]) {
  return axis === "X" ? 0 : axis === "Y" ? 1 : 2;
}

function MoldPreview({ geometry, parameters, options }: Props) {
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
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={preview}>
          <meshStandardMaterial
            color={new Color("#9ba7b4")}
            roughness={0.38}
            metalness={0.35}
            wireframe={options.wireframe}
          />
          <Edges color="#d7e1e8" threshold={28} />
        </mesh>

        {options.mold && (
          <>
            <mesh position={lowerPosition}>
              <boxGeometry args={halfSize} />
              <meshPhysicalMaterial
                color="#16d49b"
                transparent
                opacity={0.18}
                roughness={0.2}
                transmission={0.22}
                depthWrite={false}
                side={DoubleSide}
              />
              <Edges color="#21e6ab" threshold={15} />
            </mesh>
            <mesh position={upperPosition}>
              <boxGeometry args={halfSize} />
              <meshPhysicalMaterial
                color="#45a8ff"
                transparent
                opacity={0.15}
                roughness={0.18}
                transmission={0.25}
                depthWrite={false}
                side={DoubleSide}
              />
              <Edges color="#62b7ff" threshold={15} />
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
              color="#f6b84a"
              transparent
              opacity={0.22}
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
              <meshStandardMaterial color="#f1b64b" metalness={0.25} roughness={0.3} />
            </mesh>
          ))}

        {options.channels && parameters.pourEnabled && (
          <mesh position={[0, 0, size.z * 0.58]}>
            <cylinderGeometry
              args={[parameters.pourDiameter / 2, parameters.pourDiameter / 2, moldSize[2] * 0.8, 32]}
            />
            <meshStandardMaterial color="#fa8b5d" emissive="#6c2414" />
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
              <meshStandardMaterial color="#f9ca66" emissive="#5e4212" />
            </mesh>
          ))}
      </group>
    </Bounds>
  );
}

export function MoldViewport(props: Props) {
  return (
    <div className="h-full min-h-[420px] w-full" data-testid="3d-viewport">
      <Canvas
        camera={{ position: [65, 52, 72], fov: 42, near: 0.1, far: 2000 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#11151a"]} />
        <fog attach="fog" args={["#11151a", 140, 430]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[40, 65, 80]} intensity={2.6} color="#d7ecff" />
        <directionalLight position={[-50, -30, 25]} intensity={1.2} color="#35d5a2" />
        <Suspense fallback={null}>
          <MoldPreview {...props} />
        </Suspense>
        <Grid
          args={[280, 280]}
          position={[0, -32, 0]}
          cellSize={5}
          cellThickness={0.55}
          cellColor="#27313a"
          sectionSize={25}
          sectionThickness={0.9}
          sectionColor="#384754"
          fadeDistance={240}
          fadeStrength={1}
          infiniteGrid
        />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        <GizmoHelper alignment="bottom-right" margin={[72, 62]}>
          <GizmoViewport
            axisColors={["#ef6b6b", "#55ce82", "#599cff"]}
            labelColor="#dfe7ed"
          />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}
