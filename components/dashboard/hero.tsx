import { LogoMark } from "@/components/brand/logo";

type Rect = { x: number; y: number; w: number; h: number; fill: string; opacity?: number };

/** Ilustração de cidade gerada de forma determinística (arte própria, sem imagens externas). */
const SKYLINE: Rect[] = (() => {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const out: Rect[] = [];
  let x = 0;
  while (x < 620) {
    const bw = 18 + rnd() * 34;
    const bh = 40 + rnd() * 120;
    const y = 170 - bh;
    out.push({ x, y, w: bw, h: bh, fill: "url(#hero-bld)" });
    for (let wy = y + 8; wy < 165; wy += 10)
      for (let wx = x + 4; wx < x + bw - 4; wx += 7)
        if (rnd() > 0.62) out.push({ x: wx, y: wy, w: 2.4, h: 3.4, fill: rnd() > 0.8 ? "#FF6B81" : "#F5D9B8", opacity: 0.35 + rnd() * 0.5 });
    x += bw + 2 + rnd() * 4;
  }
  return out;
})();

function Skyline() {
  const buildings = SKYLINE.map((r, i) => (
    <rect key={i} x={r.x.toFixed(1)} y={r.y.toFixed(1)} width={r.w.toFixed(1)} height={r.h.toFixed(1)} fill={r.fill} opacity={r.opacity} />
  ));
  return (
    <svg viewBox="0 0 620 170" preserveAspectRatio="xMidYMax slice" aria-hidden className="absolute inset-0 size-full">
      <defs>
        <linearGradient id="hero-bld" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A2626" />
          <stop offset="1" stopColor="#140E0E" />
        </linearGradient>
        <radialGradient id="hero-glow" cx=".7" cy=".9" r=".7">
          <stop offset="0" stopColor="#C8102E" stopOpacity=".55" />
          <stop offset="1" stopColor="#C8102E" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="620" height="170" fill="url(#hero-glow)" />
      {buildings}
      <path d="M330 130 L390 110 L430 118 L500 70 L560 40" fill="none" stroke="#FF4D6A" strokeWidth={3} strokeLinecap="round" opacity={0.9} />
      <path d="M548 36 L562 38 L558 52" fill="none" stroke="#FF4D6A" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Hero({ firstName, organizationName }: { firstName: string; organizationName: string }) {
  return (
    <section className="enter relative mb-4 grid min-h-[168px] overflow-hidden rounded-2xl border border-border bg-[linear-gradient(160deg,#fff_0%,#fff_55%,#f7edee_100%)] shadow-md md:grid-cols-2 md:bg-[linear-gradient(100deg,#fff_0%,#fff_38%,#f4eeea_52%,#2a1b1b_70%,#160f0f_100%)] sm:mb-5">
      <div className="relative z-10 flex flex-col justify-center gap-1.5 p-5 sm:p-7">
        <span className="self-start rounded-full border border-primary/15 bg-danger-soft px-2.5 py-1 text-xs font-semibold text-primary">
          Bem-vindo de volta!
        </span>
        <h1 className="mt-1 text-[30px] leading-[1.05] font-bold tracking-[-0.035em] sm:text-[40px]">Olá, {firstName}!</h1>
        <p className="text-[15px] text-muted-foreground">Aqui está um resumo da gestão de {organizationName} hoje.</p>
      </div>
      <div className="relative hidden md:block">
        <Skyline />
        <div className="absolute top-1/2 right-5 z-10 hidden max-w-[270px] -translate-y-1/2 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgb(20_15_15/0.85),rgb(20_15_15/0.55))] px-4 py-3.5 text-white backdrop-blur-sm xl:block">
          <p className="flex items-center gap-2.5 text-[22px] font-bold tracking-[0.01em] uppercase">
            <LogoMark className="size-8" /> Aguiar <span className="text-[#FF4D6A]">ERP</span>
          </p>
          <p className="mt-1.5 text-sm leading-snug text-sidebar-foreground">Contabilidade e gestão integradas, com dados isolados por CNPJ.</p>
        </div>
      </div>
    </section>
  );
}
