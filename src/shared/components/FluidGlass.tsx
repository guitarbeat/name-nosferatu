/* eslint-disable react/no-unknown-property */

import {
	Image as DreiImage,
	Text as DreiText,
	MeshTransmissionMaterial,
	Preload,
	Scroll,
	ScrollControls,
	useFBO,
	useGLTF,
	useScroll,
} from "@react-three/drei";
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";
import { type CSSProperties, memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const IMAGE_URLS = [
	"https://images.unsplash.com/photo-1783394327207-acf441e37dda?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwcm9maWxlLXBhZ2V8MzR8fHxlbnwwfHx8fHw%3D",
	"https://images.unsplash.com/photo-1782977389500-dd7adad33ebe?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwcm9maWxlLXBhZ2V8MzZ8fHxlbnwwfHx8fHw%3D",
	"https://images.unsplash.com/photo-1782094002386-7d9ae1f49f50?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwcm9maWxlLXBhZ2V8NDB8fHxlbnwwfHx8fHw%3D",
	"https://images.unsplash.com/photo-1781242629922-6f39cc3671cd?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwcm9maWxlLXBhZ2V8NDR8fHxlbnwwfHx8fHw%3D",
	"https://images.unsplash.com/photo-1779684474703-5c0519bcf7e8?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwcm9maWxlLXBhZ2V8NTJ8fHxlbnwwfHx8fHw%3D",
];

export interface FluidGlassNavItem {
	label: string;
	link: string;
}

export interface LensProps {
	scale?: number;
	ior?: number;
	thickness?: number;
	chromaticAberration?: number;
	anisotropy?: number;
	transmission?: number;
	roughness?: number;
	color?: string;
	attenuationColor?: string;
	attenuationDistance?: number;
	[key: string]: unknown;
}

export interface BarProps {
	navItems?: FluidGlassNavItem[];
	scale?: number;
	ior?: number;
	thickness?: number;
	chromaticAberration?: number;
	anisotropy?: number;
	transmission?: number;
	roughness?: number;
	color?: string;
	attenuationColor?: string;
	attenuationDistance?: number;
	[key: string]: unknown;
}

export interface CubeProps {
	scale?: number;
	ior?: number;
	thickness?: number;
	chromaticAberration?: number;
	anisotropy?: number;
	transmission?: number;
	roughness?: number;
	color?: string;
	attenuationColor?: string;
	attenuationDistance?: number;
	[key: string]: unknown;
}

export interface FluidGlassProps {
	mode?: "lens" | "bar" | "cube";
	lensProps?: LensProps;
	barProps?: BarProps;
	cubeProps?: CubeProps;
	backgroundColor?: string;
	textColor?: string;
	className?: string;
	style?: CSSProperties;
}

export function FluidGlass({
	mode = "lens",
	lensProps = {},
	barProps = {},
	cubeProps = {},
	backgroundColor = "#120F17",
	textColor = "#ffffff",
	className = "",
	style = {},
}: FluidGlassProps) {
	const Wrapper = mode === "bar" ? Bar : mode === "cube" ? Cube : Lens;
	const modeProps = mode === "bar" ? barProps : mode === "cube" ? cubeProps : lensProps;
	const navItems =
		mode === "bar" && barProps.navItems
			? barProps.navItems
			: [
					{ label: "Home", link: "" },
					{ label: "About", link: "" },
					{ label: "Contact", link: "" },
				];

	return (
		<div
			className={`fluid-glass-container ${className}`.trim()}
			style={{ width: "100%", height: "100%", position: "relative", ...style }}
		>
			<Canvas
				camera={{ position: [0, 0, 20], fov: 15 }}
				gl={{ alpha: true, toneMapping: THREE.NoToneMapping }}
				style={{ backgroundColor }}
			>
				<Suspense fallback={null}>
					<ScrollControls damping={0.2} pages={3} distance={0.4}>
						{mode === "bar" && <NavItems items={navItems ?? []} textColor={textColor} />}
						<Wrapper modeProps={modeProps} backgroundColor={backgroundColor}>
							<Scroll>
								<Typography textColor={textColor} />
								<Images />
							</Scroll>
							<Scroll html={true} />
							<Preload />
						</Wrapper>
					</ScrollControls>
				</Suspense>
			</Canvas>
		</div>
	);
}

export interface ModeWrapperProps {
	children?: React.ReactNode;
	glb: string;
	geometryKey: string;
	lockToBottom?: boolean;
	followPointer?: boolean;
	modeProps?: Record<string, unknown>;
	backgroundColor?: string;
	[key: string]: unknown;
}

const ModeWrapper = memo(function ModeWrapper({
	children,
	glb,
	geometryKey,
	lockToBottom = false,
	followPointer = true,
	modeProps = {},
	backgroundColor = "#120F17",
	...props
}: ModeWrapperProps) {
	const ref = useRef<THREE.Mesh | null>(null);
	const gltf = useGLTF(glb) as unknown as {
		nodes?: Record<string, { geometry?: THREE.BufferGeometry }>;
	};
	const nodes = gltf?.nodes || {};
	const buffer = useFBO();
	const { viewport: vp } = useThree();
	const [scene] = useState(() => new THREE.Scene());
	const geoWidthRef = useRef(1);

	const fallbackGeometry = useMemo(() => {
		if (geometryKey === "Cylinder") {
			return new THREE.CylinderGeometry(1.2, 1.2, 0.4, 64);
		}
		if (geometryKey === "Cube") {
			return new THREE.BoxGeometry(2.4, 0.8, 0.4);
		}
		return new THREE.BoxGeometry(1.5, 1.5, 1.5);
	}, [geometryKey]);

	useEffect(() => {
		const geo = nodes[geometryKey]?.geometry || fallbackGeometry;
		if (geo) {
			geo.computeBoundingBox();
			if (geo.boundingBox) {
				geoWidthRef.current = geo.boundingBox.max.x - geo.boundingBox.min.x || 1;
			}
		}
		return () => {
			fallbackGeometry.dispose();
		};
	}, [nodes, geometryKey, fallbackGeometry]);

	useFrame((state, delta) => {
		const { gl, viewport, pointer, camera } = state;
		const v = viewport.getCurrentViewport(camera, [0, 0, 15]);

		const destX = followPointer ? (pointer.x * v.width) / 2 : 0;
		const destY = lockToBottom
			? -v.height / 2 + 0.2
			: followPointer
				? (pointer.y * v.height) / 2
				: 0;
		if (ref.current) {
			easing.damp3(ref.current.position, [destX, destY, 15], 0.15, delta);

			if (modeProps.scale == null) {
				const maxWorld = v.width * 0.9;
				const desired = maxWorld / (geoWidthRef.current || 1);
				ref.current.scale.setScalar(Math.min(0.15, Math.max(0.05, desired)));
			}
		}

		gl.setClearColor(0x000000, 0);
		gl.setRenderTarget(buffer);
		gl.render(scene, camera);
		gl.setRenderTarget(null);
		gl.setClearColor(0x000000, 0);
	});

	const { scale, ior, thickness, anisotropy, chromaticAberration, ...extraMat } = modeProps as {
		scale?: number;
		ior?: number;
		thickness?: number;
		anisotropy?: number;
		chromaticAberration?: number;
		[key: string]: unknown;
	};

	const geometry = nodes[geometryKey]?.geometry || fallbackGeometry;

	return (
		<>
			{createPortal(
				<>
					<mesh position={[0, 0, -5]} scale={[vp.width * 2, vp.height * 2, 1]}>
						<planeGeometry />
						<meshBasicMaterial color={backgroundColor} toneMapped={false} />
					</mesh>
					{children}
				</>,
				scene,
			)}
			<mesh scale={[vp.width, vp.height, 1]}>
				<planeGeometry />
				<meshBasicMaterial map={buffer.texture} transparent={true} toneMapped={false} />
			</mesh>
			<mesh
				ref={ref}
				scale={scale ?? 0.15}
				rotation-x={Math.PI / 2}
				geometry={geometry}
				{...(props as any)}
			>
				<MeshTransmissionMaterial
					buffer={buffer.texture}
					ior={ior ?? 1.15}
					thickness={thickness ?? 5}
					anisotropy={anisotropy ?? 0.01}
					chromaticAberration={chromaticAberration ?? 0.1}
					{...(extraMat as any)}
				/>
			</mesh>
		</>
	);
});

function Lens({ modeProps, ...p }: { modeProps: Record<string, unknown>; [key: string]: unknown }) {
	return (
		<ModeWrapper
			glb="/assets/3d/lens.glb"
			geometryKey="Cylinder"
			followPointer={true}
			modeProps={modeProps}
			{...p}
		/>
	);
}

function Cube({ modeProps, ...p }: { modeProps: Record<string, unknown>; [key: string]: unknown }) {
	return (
		<ModeWrapper
			glb="/assets/3d/cube.glb"
			geometryKey="Cube"
			followPointer={true}
			modeProps={modeProps}
			{...p}
		/>
	);
}

function Bar({
	modeProps = {},
	...p
}: {
	modeProps?: Record<string, unknown>;
	[key: string]: unknown;
}) {
	const defaultMat = {
		transmission: 1,
		roughness: 0,
		thickness: 10,
		ior: 1.15,
		color: "#ffffff",
		attenuationColor: "#ffffff",
		attenuationDistance: 0.25,
	};

	return (
		<ModeWrapper
			glb="/assets/3d/bar.glb"
			geometryKey="Cube"
			lockToBottom={true}
			followPointer={false}
			modeProps={{ ...defaultMat, ...modeProps }}
			{...p}
		/>
	);
}

const NAV_DEVICE = {
	mobile: { max: 639, spacing: 0.2, fontSize: 0.035 },
	tablet: { max: 1023, spacing: 0.24, fontSize: 0.035 },
	desktop: { max: Number.POSITIVE_INFINITY, spacing: 0.3, fontSize: 0.035 },
};

function getNavDevice(): "mobile" | "tablet" | "desktop" {
	if (typeof window === "undefined") {
		return "desktop";
	}
	const w = window.innerWidth;
	return w <= NAV_DEVICE.mobile.max ? "mobile" : w <= NAV_DEVICE.tablet.max ? "tablet" : "desktop";
}

function NavItems({ items, textColor }: { items: FluidGlassNavItem[]; textColor: string }) {
	const group = useRef<THREE.Group | null>(null);
	const { viewport, camera } = useThree();

	const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">(getNavDevice);

	useEffect(() => {
		const onResize = () => setDevice(getNavDevice());
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	const { spacing, fontSize } = NAV_DEVICE[device];

	useFrame(() => {
		if (!group.current) {
			return;
		}
		const v = viewport.getCurrentViewport(camera, [0, 0, 15]);
		group.current.position.set(0, -v.height / 2 + 0.2, 15.1);

		group.current.children.forEach((child, i) => {
			child.position.x = (i - (items.length - 1) / 2) * spacing;
		});
	});

	const handleNavigate = (link: string) => {
		if (!link) {
			return;
		}
		if (link.startsWith("#")) {
			window.location.hash = link;
		} else {
			window.location.href = link;
		}
	};

	return (
		<group ref={group} renderOrder={10}>
			{items.map(({ label, link }) => (
				<DreiText
					key={label}
					fontSize={fontSize}
					color={textColor}
					anchorX="center"
					anchorY="middle"
					outlineWidth={0}
					outlineBlur="20%"
					outlineColor="#000"
					outlineOpacity={0.5}
					renderOrder={10}
					onClick={(e: any) => {
						e.stopPropagation();
						handleNavigate(link);
					}}
					onPointerOver={() => {
						if (typeof document !== "undefined") {
							document.body.style.cursor = "pointer";
						}
					}}
					onPointerOut={() => {
						if (typeof document !== "undefined") {
							document.body.style.cursor = "auto";
						}
					}}
				>
					{label}
				</DreiText>
			))}
		</group>
	);
}

function Images() {
	const group = useRef<THREE.Group | null>(null);
	const data = useScroll();
	const { height } = useThree((s) => s.viewport);

	useFrame(() => {
		if (!group.current?.children || group.current.children.length < 5) {
			return;
		}
		const c0 = (group.current.children[0] as any)?.material;
		const c1 = (group.current.children[1] as any)?.material;
		const c2 = (group.current.children[2] as any)?.material;
		const c3 = (group.current.children[3] as any)?.material;
		const c4 = (group.current.children[4] as any)?.material;
		if (c0) {
			c0.zoom = 1 + data.range(0, 1 / 3) / 3;
		}
		if (c1) {
			c1.zoom = 1 + data.range(0, 1 / 3) / 3;
		}
		if (c2) {
			c2.zoom = 1 + data.range(1.15 / 3, 1 / 3) / 2;
		}
		if (c3) {
			c3.zoom = 1 + data.range(1.15 / 3, 1 / 3) / 2;
		}
		if (c4) {
			c4.zoom = 1 + data.range(1.15 / 3, 1 / 3) / 2;
		}
	});

	return (
		<group ref={group}>
			<DreiImage position={[-2, 0, 0]} scale={[3, height / 1.1]} url={IMAGE_URLS[0]} />
			<DreiImage position={[2, 0, 3]} scale={3} url={IMAGE_URLS[1]} />
			<DreiImage position={[-2.05, -height, 6]} scale={[1, 3]} url={IMAGE_URLS[2]} />
			<DreiImage position={[-0.6, -height, 9]} scale={[1, 2]} url={IMAGE_URLS[3]} />
			<DreiImage position={[0.75, -height, 10.5]} scale={1.5} url={IMAGE_URLS[4]} />
		</group>
	);
}

const TYPOGRAPHY_DEVICE = {
	mobile: { fontSize: 0.2 },
	tablet: { fontSize: 0.4 },
	desktop: { fontSize: 0.6 },
};

function getTypographyDevice(): "mobile" | "tablet" | "desktop" {
	if (typeof window === "undefined") {
		return "desktop";
	}
	const w = window.innerWidth;
	return w <= 639 ? "mobile" : w <= 1023 ? "tablet" : "desktop";
}

function Typography({ textColor }: { textColor: string }) {
	const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">(getTypographyDevice);

	useEffect(() => {
		const onResize = () => setDevice(getTypographyDevice());
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	const { fontSize } = TYPOGRAPHY_DEVICE[device];

	return (
		<DreiText
			position={[0, 0, 12]}
			fontSize={fontSize}
			letterSpacing={-0.05}
			outlineWidth={0}
			outlineBlur="20%"
			outlineColor="#000"
			outlineOpacity={0.5}
			color={textColor}
			anchorX="center"
			anchorY="middle"
		>
			Nosferatu
		</DreiText>
	);
}
