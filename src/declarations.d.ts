// ── Image files ───────────────────────────────────────────────────────────────
declare module "*.png"  { const src: string; export default src; }
declare module "*.jpg"  { const src: string; export default src; }
declare module "*.jpeg" { const src: string; export default src; }
declare module "*.gif"  { const src: string; export default src; }
declare module "*.webp" { const src: string; export default src; }
declare module "*.ico"  { const src: string; export default src; }
declare module "*.bmp"  { const src: string; export default src; }

// ── SVG — default src string + named ReactComponent (for CRA / Vite) ─────────
declare module "*.svg" {
  import React from "react";
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

// ── Font files ────────────────────────────────────────────────────────────────
declare module "*.woff"  { const src: string; export default src; }
declare module "*.woff2" { const src: string; export default src; }
declare module "*.ttf"   { const src: string; export default src; }
declare module "*.eot"   { const src: string; export default src; }
declare module "*.otf"   { const src: string; export default src; }

// ── Audio / Video files ───────────────────────────────────────────────────────
declare module "*.mp4"  { const src: string; export default src; }
declare module "*.webm" { const src: string; export default src; }
declare module "*.ogg"  { const src: string; export default src; }
declare module "*.mp3"  { const src: string; export default src; }
declare module "*.wav"  { const src: string; export default src; }
declare module "*.aac"  { const src: string; export default src; }

// ── Document / Data files ─────────────────────────────────────────────────────
declare module "*.pdf" { const src: string; export default src; }
declare module "*.csv" { const src: string; export default src; }
declare module "*.json" { const content: any; export default content; }