import { Color, Mesh, Program, Renderer, Triangle } from "ogl";
import type React from "react";
import { type CSSProperties, useEffect, useRef } from "react";

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uColor;
uniform vec3 uResolution;
uniform vec2 uMouse;
uniform float uAmplitude;
uniform float uSpeed;

varying vec2 vUv;

void main() {
  float mr = min(uResolution.x, uResolution.y);
  vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;

  uv += (uMouse - vec2(0.5)) * uAmplitude;

  float d = -uTime * 0.5 * uSpeed;
  float a = 0.0;
  for (float i = 0.0; i < 8.0; ++i) {
    a += cos(i - d - a * uv.x);
    d += sin(uv.y * i + a);
  }
  d += uTime * 0.5 * uSpeed;
  vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
  col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;
  gl_FragColor = vec4(col, 1.0);
}
`;

export interface IridescenceProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "color"> {
	color?: number[];
	speed?: number;
	amplitude?: number;
	mouseReact?: boolean;
	className?: string;
	style?: CSSProperties;
}

export function Iridescence({
	color = [1, 1, 1],
	speed = 1.0,
	amplitude = 0.1,
	mouseReact = true,
	className = "",
	style,
	...rest
}: IridescenceProps) {
	const ctnDom = useRef<HTMLDivElement>(null);
	const mousePos = useRef({ x: 0.5, y: 0.5 });

	useEffect(() => {
		if (!ctnDom.current) {
			return;
		}
		const ctn = ctnDom.current;

		let renderer: Renderer | null = null;
		try {
			renderer = new Renderer({
				alpha: true,
				premultipliedAlpha: false,
			});
		} catch {
			// WebGL might not be supported in test environments or old browsers
			return;
		}

		const gl = renderer.gl;
		if (!gl) {
			return;
		}

		gl.clearColor(0, 0, 0, 0);

		let program: Program | null = null;

		function resize() {
			if (!ctn || !renderer || !gl) {
				return;
			}
			const scale = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2);
			const width = ctn.offsetWidth || window.innerWidth || 800;
			const height = ctn.offsetHeight || window.innerHeight || 600;
			renderer.setSize(width * scale, height * scale);
			if (gl.canvas) {
				gl.canvas.style.width = "100%";
				gl.canvas.style.height = "100%";
				gl.canvas.style.position = "absolute";
				gl.canvas.style.inset = "0";
				gl.canvas.style.display = "block";
			}
			if (program) {
				program.uniforms.uResolution.value = new Color(
					width * scale,
					height * scale,
					(width * scale) / (height * scale || 1),
				);
			}
		}
		window.addEventListener("resize", resize, false);
		const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
		ro?.observe(ctn);
		resize();

		const geometry = new Triangle(gl);
		const baseColor =
			color.length >= 3 ? new Color(color[0], color[1], color[2]) : new Color(1, 1, 1);

		program = new Program(gl, {
			vertex: vertexShader,
			fragment: fragmentShader,
			uniforms: {
				uTime: { value: 0 },
				uColor: { value: baseColor },
				uResolution: {
					value: new Color(
						gl.canvas.width,
						gl.canvas.height,
						gl.canvas.width / (gl.canvas.height || 1),
					),
				},
				uMouse: { value: new Float32Array([mousePos.current.x, mousePos.current.y]) },
				uAmplitude: { value: amplitude },
				uSpeed: { value: speed },
			},
		});

		const mesh = new Mesh(gl, { geometry, program });
		let animateId: number;

		function update(t: number) {
			animateId = requestAnimationFrame(update);
			if (program && renderer) {
				program.uniforms.uTime.value = t * 0.001;
				renderer.render({ scene: mesh });
			}
		}
		animateId = requestAnimationFrame(update);

		if (gl.canvas) {
			gl.canvas.style.width = "100%";
			gl.canvas.style.height = "100%";
			gl.canvas.style.position = "absolute";
			gl.canvas.style.inset = "0";
			gl.canvas.style.display = "block";
			ctn.appendChild(gl.canvas);
		}

		function handleMouseMove(e: MouseEvent) {
			if (!program) {
				return;
			}
			const rect = ctn?.getBoundingClientRect();
			const width = rect && rect.width > 0 ? rect.width : window.innerWidth;
			const height = rect && rect.height > 0 ? rect.height : window.innerHeight;
			const left = rect ? rect.left : 0;
			const top = rect ? rect.top : 0;

			const x = (e.clientX - left) / width;
			const y = 1.0 - (e.clientY - top) / height;
			mousePos.current = { x, y };
			if (program.uniforms.uMouse.value) {
				program.uniforms.uMouse.value[0] = x;
				program.uniforms.uMouse.value[1] = y;
			}
		}

		if (mouseReact) {
			window.addEventListener("mousemove", handleMouseMove, { passive: true });
		}

		return () => {
			cancelAnimationFrame(animateId);
			window.removeEventListener("resize", resize);
			ro?.disconnect();
			if (mouseReact) {
				window.removeEventListener("mousemove", handleMouseMove);
			}
			if (gl.canvas && ctn.contains(gl.canvas)) {
				ctn.removeChild(gl.canvas);
			}
			gl.getExtension("WEBGL_lose_context")?.loseContext();
		};
	}, [color, speed, amplitude, mouseReact]);

	const rootClass = ["iridescence-container", className].filter(Boolean).join(" ");

	return <div ref={ctnDom} className={rootClass} style={style} {...rest} />;
}
