/**
 * Visual effects engine. Shader backgrounds run on WebGL with a CSS-gradient
 * fallback; particle systems run on canvas 2D. Every effect pauses in hidden
 * tabs, caps its resolution for low-end devices and renders one still frame
 * under prefers-reduced-motion.
 */

export interface EffectOpts {
  colors: string[];
  speed: number;      // 0.1–4
  intensity: number;  // 0–100
  density: number;    // 0–100
  size?: number;
}

type Stop = () => void;

const hexToRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
export const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function loop(draw: (t: number, dt: number) => void, still: boolean): Stop {
  let raf = 0, last = performance.now(), t = 0, stopped = false;
  const frame = (now: number) => {
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!document.hidden) { t += dt; draw(t, dt); }
    raf = requestAnimationFrame(frame);
  };
  if (still) draw(3.7, 0.016); else raf = requestAnimationFrame(frame);
  return () => { stopped = true; cancelAnimationFrame(raf); };
}

function fit(canvas: HTMLCanvasElement, maxDpr: number, scale = 1) {
  const dpr = Math.min(maxDpr, window.devicePixelRatio || 1) * scale;
  const w = Math.max(1, Math.floor(canvas.clientWidth * dpr)), h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  return { w, h, dpr };
}

// ------------------------------------------------------------------ shaders

const HEADER = `precision mediump float;
uniform vec2 r; uniform float t; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform float inten; uniform float dens; uniform vec2 m;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
`;

const SHADERS: Record<string, string> = {
  aurora: `void main(){ vec2 uv=gl_FragCoord.xy/r; float y=uv.y;
    float w1=sin(uv.x*3.+t*.6+fbm(uv*2.+t*.1)*3.)*.12+.62, w2=sin(uv.x*2.2-t*.4+fbm(uv*3.-t*.08)*2.)*.14+.5;
    float b1=exp(-pow((y-w1)*7.,2.)), b2=exp(-pow((y-w2)*6.,2.));
    float streak=fbm(vec2(uv.x*18.,t*.3))*.6+.4;
    vec3 col=c1*b1*streak+c2*b2*streak+c3*b1*b2*1.5;
    col*= .55+inten*.012; col+=vec3(.01,.02,.06)*(1.-y);
    gl_FragColor=vec4(col,1.); }`,
  galaxy: `void main(){ vec2 uv=(gl_FragCoord.xy-.5*r)/r.y; float a=atan(uv.y,uv.x), d=length(uv);
    float arms=sin(a*2.-log(d+.02)*4.+t*.25)*.5+.5; float neb=fbm(vec2(a*1.5,d*6.)-t*.05)*arms;
    vec3 col=mix(c1,c2,neb)*neb*1.4*exp(-d*1.6)+c3*exp(-d*9.)*.9;
    vec2 g=floor(gl_FragCoord.xy/2.); float s=hash(g); float tw=step(1.-.0025*(.4+dens*.02),s)*(.5+.5*sin(t*3.+s*90.));
    col+=vec3(tw); col*=.5+inten*.01; gl_FragColor=vec4(col,1.); }`,
  liquid: `void main(){ vec2 uv=gl_FragCoord.xy/r.y; vec2 q=vec2(fbm(uv*2.+t*.1),fbm(uv*2.+vec2(5.2,1.3)-t*.12));
    vec2 w=vec2(fbm(uv*2.+q*3.+t*.08),fbm(uv*2.+q*3.+vec2(1.7,9.2)));
    float f=fbm(uv*2.+w*2.5); vec3 col=mix(c1,c2,clamp(f*f*2.,0.,1.)); col=mix(col,c3,clamp(length(q)*.8,0.,1.)*.6);
    gl_FragColor=vec4(col*(.35+inten*.009),1.); }`,
  silk: `void main(){ vec2 uv=gl_FragCoord.xy/r; float v=0.;
    for(int i=1;i<5;i++){ float fi=float(i); v+=sin(uv.x*fi*3.+t*.4*fi+sin(uv.y*fi*4.+t*.3))*.5/fi; }
    float sh=pow(abs(v),.6); vec3 col=mix(c1,c2,uv.y)*.35+c3*sh*.55; gl_FragColor=vec4(col*(.6+inten*.008),1.); }`,
  clouds: `void main(){ vec2 uv=gl_FragCoord.xy/r.y; float f=fbm(uv*1.6+vec2(t*.03,0.)); f+=fbm(uv*3.5-vec2(t*.05,t*.01))*.5;
    float c=smoothstep(.45-dens*.003,1.1,f); vec3 sky=mix(c1*.25,c2*.45,gl_FragCoord.y/r.y); gl_FragColor=vec4(mix(sky,c3,c*(.4+inten*.006)),1.); }`,
  plasma: `void main(){ vec2 uv=gl_FragCoord.xy/r.y*3.; float v=sin(uv.x+t)+sin((uv.y+t)*.8)+sin((uv.x+uv.y+t)*.6)+sin(length(uv-vec2(1.5))*2.-t);
    vec3 col=.5+.5*cos(v+vec3(0.,2.,4.)); col=col.r*c1+col.g*c2+col.b*c3; gl_FragColor=vec4(col*(.3+inten*.007),1.); }`,
  iridescence: `void main(){ vec2 uv=gl_FragCoord.xy/r; float f=fbm(uv*3.+t*.15)+uv.y*.6;
    vec3 rb=.5+.5*cos(6.283*(f+vec3(0.,.33,.67))+t*.2); vec3 col=mix(c1,rb,.35+inten*.004)*mix(.6,1.,fbm(uv*8.));
    gl_FragColor=vec4(col*.75,1.); }`,
  crt: `void main(){ vec2 uv=gl_FragCoord.xy/r; vec2 c=uv-.5; float vig=1.-dot(c,c)*1.4;
    float scan=.75+.25*sin(gl_FragCoord.y*1.6+t*12.); float roll=smoothstep(.0,.02,abs(fract(uv.y-t*.12)-.5));
    float n=hash(gl_FragCoord.xy+t)*.12; vec3 base=mix(c1,c2,fbm(uv*4.+t*.2))*.5;
    gl_FragColor=vec4((base*scan*vig+n*c3)*(.5+inten*.008)*(.8+.2*roll),1.); }`,
  dither: `float bayer(vec2 p){ int x=int(mod(p.x,4.)), y=int(mod(p.y,4.)); int i=x+y*4;
    float b=0.; if(i==0)b=0.;else if(i==1)b=8.;else if(i==2)b=2.;else if(i==3)b=10.;else if(i==4)b=12.;else if(i==5)b=4.;else if(i==6)b=14.;else if(i==7)b=6.;
    else if(i==8)b=3.;else if(i==9)b=11.;else if(i==10)b=1.;else if(i==11)b=9.;else if(i==12)b=15.;else if(i==13)b=7.;else if(i==14)b=13.;else b=5.; return b/16.; }
    void main(){ vec2 px=floor(gl_FragCoord.xy/3.); vec2 uv=gl_FragCoord.xy/r; float f=fbm(uv*2.5+vec2(t*.07,-t*.05))*(.6+inten*.008);
    float on=step(bayer(px),f); gl_FragColor=vec4(mix(c1*.15,mix(c2,c3,uv.y),on),1.); }`,
  lightRays: `void main(){ vec2 uv=gl_FragCoord.xy/r; vec2 o=vec2(.5+sin(t*.2)*.15,1.15); vec2 d=uv-o; float a=atan(d.x,-d.y);
    float rays=pow(.5+.5*sin(a*14.+t*.6)*sin(a*7.-t*.4),3.)+pow(.5+.5*sin(a*23.-t*.3),6.)*.6;
    float fall=exp(-length(d)*1.3); vec3 col=c1*.12+(c2*rays+c3*.25)*fall*(.5+inten*.012); gl_FragColor=vec4(col,1.); }`,
  gradientFlow: `void main(){ vec2 uv=gl_FragCoord.xy/r; float a=t*.15; vec2 p1=vec2(.5+.4*cos(a),.5+.4*sin(a*1.3)), p2=vec2(.5+.4*cos(a*.7+2.),.5+.4*sin(a+1.)), p3=vec2(.5+.35*sin(a*.9),.5+.35*cos(a*1.1+3.));
    float w1=1./(.02+distance(uv,p1)), w2=1./(.02+distance(uv,p2)), w3=1./(.02+distance(uv,p3)); vec3 col=(c1*w1+c2*w2+c3*w3)/(w1+w2+w3);
    gl_FragColor=vec4(col*(.45+inten*.007),1.); }`,
  lightning: `void main(){ vec2 uv=gl_FragCoord.xy/r; float seg=floor(t*1.3); float fl=step(.55,hash(vec2(seg,1.)))*exp(-fract(t*1.3)*7.);
    float x=.5+(hash(vec2(seg,2.))-.5)*.6; float path=x+ (fbm(vec2(uv.y*6.,seg))-.5)*.25;
    float bolt=exp(-abs(uv.x-path)*180.)*step(1.-hash(vec2(seg,3.))*.7,uv.y+.0*0.)*1.+exp(-abs(uv.x-path)*25.)*.25;
    vec3 sky=mix(c1*.15,c2*.25,uv.y)+fbm(uv*3.+t*.05)*c1*.15; gl_FragColor=vec4(sky+c3*bolt*fl*(1.+inten*.02)+c2*fl*.12,1.); }`,
};

function webgl(canvas: HTMLCanvasElement, name: string, o: EffectOpts, still: boolean): Stop | null {
  const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, powerPreference: "low-power" });
  if (!gl) return null;
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, "attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }");
  const fs = sh(gl.FRAGMENT_SHADER, HEADER + SHADERS[name]);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const cols = [0, 1, 2].map((i) => hexToRgb(o.colors[i] ?? o.colors[o.colors.length - 1] ?? "#3b82f6"));
  gl.uniform3fv(u("c1"), cols[0]); gl.uniform3fv(u("c2"), cols[1]); gl.uniform3fv(u("c3"), cols[2]);
  gl.uniform1f(u("inten"), o.intensity); gl.uniform1f(u("dens"), o.density);
  // Heavy shaders render at reduced resolution and are upscaled by CSS.
  const lowEnd = (navigator as any).hardwareConcurrency <= 4;
  const scale = name === "crt" || name === "dither" ? 1 : lowEnd ? 0.45 : 0.65;
  const uT = u("t"), uR = u("r");
  return loop((t) => {
    const { w, h } = fit(canvas, 1.5, scale);
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uR, w, h);
    gl.uniform1f(uT, t * o.speed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }, still);
}

// ------------------------------------------------------------------ particle systems (canvas 2D)

interface P { x: number; y: number; vx: number; vy: number; s: number; a: number; life: number; hue?: number; rot?: number; vr?: number; c?: string }

function particles(canvas: HTMLCanvasElement, kind: string, o: EffectOpts, still: boolean, transparent: boolean): Stop {
  const ctx = canvas.getContext("2d")!;
  const col = o.colors[0] ?? "#e0f2fe";
  const pool: P[] = [];
  const target = () => Math.round((kind === "rain" ? 60 : kind === "fireworks" ? 0 : 30) + o.density * (kind === "rain" ? 3 : kind === "stars" ? 4 : 1.6));
  const size = o.size ?? 1;
  const spawn = (w: number, h: number, init = false): P => {
    const r = Math.random;
    switch (kind) {
      case "snow": return { x: r() * w, y: init ? r() * h : -10, vx: (r() - .5) * 20, vy: 20 + r() * 40, s: (1 + r() * 2.6) * size, a: .4 + r() * .6, life: 0 };
      case "rain": return { x: r() * w * 1.2, y: init ? r() * h : -20, vx: -60, vy: 600 + r() * 400, s: (8 + r() * 14) * size, a: .15 + r() * .35, life: 0 };
      case "stars": return { x: r() * w, y: r() * h, vx: 0, vy: 0, s: (r() * 1.4 + .3) * size, a: r(), life: r() * 10 };
      case "petals": return { x: r() * w, y: init ? r() * h : -20, vx: 20 + r() * 30, vy: 25 + r() * 35, s: (5 + r() * 5) * size, a: .6 + r() * .4, life: 0, rot: r() * 6, vr: (r() - .5) * 2 };
      case "floating": return { x: r() * w, y: init ? r() * h : h + 20, vx: (r() - .5) * 8, vy: -(8 + r() * 18), s: (2 + r() * 6) * size, a: .08 + r() * .25, life: 0 };
      default: return { x: r() * w, y: r() * h, vx: (r() - .5) * 18, vy: (r() - .5) * 18, s: (1 + r() * 1.8) * size, a: .3 + r() * .5, life: 0 };
    }
  };
  let bursts: P[] = [];
  return loop((t, dt) => {
    const { w, h, dpr } = fit(canvas, 1.5);
    dt *= o.speed;
    const W = w / dpr, H = h / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (transparent) ctx.clearRect(0, 0, W, H);
    else { ctx.fillStyle = o.colors[1] ? shade(o.colors[1], .12) : "#020617"; ctx.fillRect(0, 0, W, H); }
    if (kind === "fireworks") {
      if (Math.random() < dt * (0.6 + o.density / 40)) {
        const cx = W * (.15 + Math.random() * .7), cy = H * (.15 + Math.random() * .45), n = 40 + Math.floor(o.intensity / 2);
        const c = o.colors[Math.floor(Math.random() * o.colors.length)] ?? col;
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, sp = 60 + Math.random() * 120; bursts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: 1.6 * size, a: 1, life: 0, c }); }
      }
      bursts = bursts.filter((p) => p.a > 0.02);
      for (const p of bursts) {
        p.vy += 70 * dt; p.vx *= 1 - dt * .8; p.vy *= 1 - dt * .8; p.x += p.vx * dt; p.y += p.vy * dt; p.a -= dt * .55;
        ctx.globalAlpha = Math.max(0, p.a); ctx.fillStyle = p.c!; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }
    while (pool.length < target()) pool.push(spawn(W, H, pool.length < target()));
    if (pool.length > target()) pool.length = target();
    ctx.fillStyle = col; ctx.strokeStyle = col;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      p.life += dt;
      if (kind === "stars") {
        ctx.globalAlpha = .25 + .75 * Math.abs(Math.sin(t * .8 + p.life));
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 7); ctx.fill();
        continue;
      }
      p.x += (p.vx + (kind === "snow" ? Math.sin(t + i) * 12 : 0)) * dt; p.y += p.vy * dt;
      if (kind === "particles") { if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; }
      else if (p.y > H + 30 || p.y < -40 || p.x > W + 40 || p.x < -60) { pool[i] = spawn(W, H); continue; }
      ctx.globalAlpha = p.a;
      if (kind === "rain") { ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * .02, p.y + p.s); ctx.stroke(); }
      else if (kind === "petals") {
        p.rot! += p.vr! * dt;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot!); ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * .55, 0, 0, 7); ctx.fill(); ctx.restore();
      } else if (kind === "floating") {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 3); g.addColorStop(0, col); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 3, 0, 7); ctx.fill(); ctx.fillStyle = col;
      } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 7); ctx.fill(); }
    }
    if (kind === "particles") {
      ctx.lineWidth = .6;
      const max = 90 + o.intensity;
      for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
        const dx = pool[i].x - pool[j].x, dy = pool[i].y - pool[j].y, d = dx * dx + dy * dy;
        if (d < max * max) { ctx.globalAlpha = (1 - Math.sqrt(d) / max) * .35; ctx.beginPath(); ctx.moveTo(pool[i].x, pool[i].y); ctx.lineTo(pool[j].x, pool[j].y); ctx.stroke(); }
      }
    }
    ctx.globalAlpha = 1;
  }, still);
}

function shade(hex: string, f: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r * 255 * f)},${Math.round(g * 255 * f)},${Math.round(b * 255 * f)})`;
}

/** CSS fallback used when WebGL is unavailable. */
export function fallbackGradient(colors: string[]) {
  const [a, b, c] = [colors[0] ?? "#1d4ed8", colors[1] ?? colors[0] ?? "#38bdf8", colors[2] ?? colors[0] ?? "#6366f1"];
  return `radial-gradient(80% 60% at 20% 20%, ${a}55, transparent 60%), radial-gradient(70% 60% at 80% 70%, ${b}44, transparent 60%), radial-gradient(60% 50% at 50% 100%, ${c}33, transparent 70%), #020617`;
}

const PARTICLE_BG = new Set(["stars", "particles", "rain", "snow"]);

/** Start a full background effect. Returns null if it fell back to CSS. */
export function startBackground(canvas: HTMLCanvasElement, effect: string, o: EffectOpts): Stop | null {
  const still = reducedMotion();
  if (PARTICLE_BG.has(effect)) return particles(canvas, effect, o, still, false);
  return webgl(canvas, effect in SHADERS ? effect : "aurora", o, still);
}

/** Start a transparent overlay effect drawn above the background. */
export function startOverlay(canvas: HTMLCanvasElement, effect: string, o: EffectOpts): Stop | null {
  if (effect === "none") return null;
  const still = reducedMotion();
  if (effect === "lightRays") {
    const ctx = canvas.getContext("2d")!;
    return loop((t) => {
      const { w, h, dpr } = fit(canvas, 1.25);
      const W = w / dpr, H = h / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 6; i++) {
        const a = -0.5 + i * 0.22 + Math.sin(t * o.speed * .3 + i) * .05;
        const g = ctx.createLinearGradient(W / 2, -40, W / 2 + Math.sin(a) * H, H);
        g.addColorStop(0, o.colors[0] + "40"); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(W / 2 - 20, -40); ctx.lineTo(W / 2 + 20, -40);
        ctx.lineTo(W / 2 + Math.sin(a) * H * 1.4 + 60 + o.density, H); ctx.lineTo(W / 2 + Math.sin(a) * H * 1.4 - 60 - o.density, H); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }, still);
  }
  if (effect === "ambient") return null; // ambient light is pure CSS (see renderer)
  return particles(canvas, effect, o, still, true);
}

// ------------------------------------------------------------------ cursor trails

export function startCursorTrail(canvas: HTMLCanvasElement, kind: string, color: string, length: number, glow: number): Stop {
  const ctx = canvas.getContext("2d")!;
  const pts: { x: number; y: number; a: number; vx?: number; vy?: number }[] = [];
  let mx = -100, my = -100;
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    mx = e.clientX - r.left; my = e.clientY - r.top;
    if (kind === "sparkle" || kind === "bubbles") for (let i = 0; i < 2; i++) pts.push({ x: mx, y: my, a: 1, vx: (Math.random() - .5) * 60, vy: (Math.random() - .5) * 60 - (kind === "bubbles" ? 40 : 0) });
    else pts.push({ x: mx, y: my, a: 1 });
    while (pts.length > length * (kind === "sparkle" || kind === "bubbles" ? 4 : 1)) pts.shift();
  };
  const host = canvas.parentElement!;
  host.addEventListener("pointermove", onMove);
  const stop = loop((_t, dt) => {
    const { w, h, dpr } = fit(canvas, 1.5);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    ctx.shadowColor = color; ctx.shadowBlur = glow / 4;
    if (kind === "line" || kind === "comet" || kind === "glow") {
      for (let i = 1; i < pts.length; i++) {
        const f = i / pts.length;
        ctx.strokeStyle = color; ctx.globalAlpha = f * (kind === "glow" ? .5 : .9); ctx.lineWidth = (kind === "comet" ? 8 : kind === "glow" ? 14 : 3) * f; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
      }
      if (pts.length) pts.shift();
    } else {
      for (const p of pts) {
        p.x += (p.vx ?? 0) * dt; p.y += (p.vy ?? 0) * dt; p.a -= dt * 1.4;
        ctx.globalAlpha = Math.max(0, p.a); ctx.fillStyle = color; ctx.strokeStyle = color;
        ctx.beginPath(); ctx.arc(p.x, p.y, kind === "bubbles" ? 4 : 1.8, 0, 7); kind === "bubbles" ? ctx.stroke() : ctx.fill();
      }
      for (let i = pts.length - 1; i >= 0; i--) if (pts[i].a <= 0) pts.splice(i, 1);
    }
    ctx.globalAlpha = 1;
  }, false);
  return () => { stop(); host.removeEventListener("pointermove", onMove); };
}
