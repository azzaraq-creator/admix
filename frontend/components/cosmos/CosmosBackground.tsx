"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  hue: string | null;
  layer: number;
}

interface Props {
  density?: number;
}

export function CosmosBackground({ density = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let stars: Star[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let mouseX = 0;
    let mouseY = 0;
    let curX = 0;
    let curY = 0;

    const seed = () => {
      const count = Math.floor(((w * h) / 6000) * density);
      stars = [];
      for (let i = 0; i < count; i++) {
        const layer = Math.random();
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r:
            layer < 0.75
              ? Math.random() * 0.55 + 0.25
              : Math.random() * 1.0 + 0.7,
          a: Math.random() * 0.35 + 0.35,
          hue:
            Math.random() < 0.92
              ? null
              : Math.random() < 0.5
                ? "#c7d2fe"
                : "#fef3c7",
          layer: layer < 0.75 ? 0.15 : 0.4,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        ctx.globalAlpha = s.a;
        ctx.fillStyle = s.hue || "#ffffff";
        const px = s.x - curX * s.layer;
        const py = s.y - curY * s.layer;
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.r > 0.85) {
          ctx.globalAlpha = s.a * 0.18;
          ctx.beginPath();
          ctx.arc(px, py, s.r * 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      draw();
    };

    const tick = () => {
      const nx = curX + (mouseX - curX) * 0.04;
      const ny = curY + (mouseY - curY) * 0.04;
      if (Math.abs(nx - curX) > 0.02 || Math.abs(ny - curY) > 0.02) {
        curX = nx;
        curY = ny;
        draw();
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 4;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 4;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("resize", resize);
    resize();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", resize);
    };
  }, [density]);

  return (
    <div className="cosmos-bg">
      <canvas ref={canvasRef} className="cosmos-stars" />
      <div className="cosmos-grid" />
      <div className="cosmos-vignette" />
    </div>
  );
}
