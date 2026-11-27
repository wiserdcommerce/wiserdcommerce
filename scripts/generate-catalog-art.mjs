import fs from "fs";
import path from "path";

const dir = path.join(process.cwd(), "public", "catalog");
fs.mkdirSync(dir, { recursive: true });

// Quiet, gallery-grade architectural studio renders on seamless #F2F2EF backdrop.
// Zero stamped corner text, zero crude black wireframe outlines.
const items = [
  {
    file: "lamp.svg",
    draw: `<ellipse cx="310" cy="348" rx="145" ry="18" fill="#171717" fill-opacity="0.08"/>
<rect x="200" y="330" width="96" height="16" rx="8" fill="#D9DBE0"/>
<path d="M248 330 V156 C248 136 262 124 282 124 H424" fill="none" stroke="#2D3036" stroke-width="11" stroke-linecap="round"/>
<rect x="336" y="114" width="128" height="18" rx="9" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="1.5"/>
<polygon points="340,132 460,132 496,342 296,342" fill="url(#lampGlow)"/>`,
    defs: `<linearGradient id="lampGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFE8B6" stop-opacity="0.34"/><stop offset="100%" stop-color="#FFE8B6" stop-opacity="0"/></linearGradient>`,
  },
  {
    file: "motion-pack.svg",
    draw: `<rect x="108" y="102" width="384" height="246" rx="16" fill="#FFFFFF" filter="url(#softShadow)"/>
<path d="M150 282 C214 282 232 168 302 168 C368 168 386 244 450 182" fill="none" stroke="#315FC8" stroke-width="3.5" stroke-linecap="round"/>
<circle cx="150" cy="282" r="6" fill="#171717"/>
<circle cx="302" cy="168" r="8" fill="#315FC8" stroke="#FFFFFF" stroke-width="2.5"/>
<circle cx="450" cy="182" r="6" fill="#167A67"/>
<rect x="150" y="310" width="300" height="6" rx="3" fill="#F0F1F2"/>
<rect x="150" y="310" width="170" height="6" rx="3" fill="#315FC8"/>`,
  },
  {
    file: "glass-pack.svg",
    draw: `<circle cx="248" cy="225" r="78" fill="#5278E8" fill-opacity="0.18"/>
<circle cx="358" cy="225" r="74" fill="#9B7BFF" fill-opacity="0.16"/>
<rect x="164" y="138" width="272" height="174" rx="22" fill="#FFFFFF" fill-opacity="0.82" stroke="#FFFFFF" stroke-width="2" filter="url(#softShadow)"/>
<rect x="196" y="176" width="76" height="76" rx="14" fill="#F7F7F5" stroke="#E5E7EB" stroke-width="1.5"/>
<rect x="292" y="188" width="112" height="14" rx="7" fill="#171717" fill-opacity="0.85"/>
<rect x="292" y="214" width="78" height="10" rx="5" fill="#6B6B6B" fill-opacity="0.35"/>`,
  },
  {
    file: "controller.svg",
    draw: `<ellipse cx="300" cy="342" rx="164" ry="18" fill="#171717" fill-opacity="0.08"/>
<path d="M168 166 C198 140 402 140 432 166 L462 280 C470 310 436 332 410 310 L362 268 H238 L190 310 C164 332 130 310 138 280 Z" fill="#FFFFFF" filter="url(#softShadow)"/>
<circle cx="226" cy="216" r="24" fill="#F0F1F2" stroke="#D1D5DB" stroke-width="1.5"/>
<circle cx="226" cy="216" r="14" fill="#E5E7EB"/>
<circle cx="374" cy="216" r="24" fill="#F0F1F2" stroke="#D1D5DB" stroke-width="1.5"/>
<circle cx="374" cy="199" r="5" fill="#315FC8"/>
<circle cx="391" cy="216" r="5" fill="#167A67"/>
<circle cx="374" cy="233" r="5" fill="#7853D8"/>
<circle cx="357" cy="216" r="5" fill="#171717"/>`,
  },
  {
    file: "game-assets.svg",
    draw: `<ellipse cx="300" cy="348" rx="150" ry="16" fill="#171717" fill-opacity="0.07"/>
<g filter="url(#softShadow)">
<polygon points="300,114 394,162 300,210 206,162" fill="#DCEEE9"/>
<polygon points="206,162 300,210 300,286 206,238" fill="#FFFFFF"/>
<polygon points="394,162 300,210 300,286 394,238" fill="#E6E8EC"/>
<polygon points="206,238 300,286 206,334 112,286" fill="#DDE6FA"/>
<polygon points="394,238 488,286 394,334 300,286" fill="#EAE4FA"/>
</g>`,
  },
  {
    file: "coaching.svg",
    draw: `<rect x="104" y="106" width="392" height="238" rx="16" fill="#FFFFFF" filter="url(#softShadow)"/>
<circle cx="300" cy="208" r="40" fill="#F2F2EF"/>
<polygon points="290,192 322,208 290,224" fill="#315FC8"/>
<rect x="142" y="294" width="316" height="8" rx="4" fill="#F0F1F2"/>
<rect x="142" y="294" width="202" height="8" rx="4" fill="#167A67"/>`,
  },
  {
    file: "brand-service.svg",
    draw: `<rect x="116" y="102" width="176" height="246" rx="12" fill="#FFFFFF" filter="url(#softShadow)"/>
<rect x="308" y="102" width="176" height="114" rx="12" fill="#315FC8" filter="url(#softShadow)"/>
<rect x="308" y="232" width="176" height="116" rx="12" fill="#FFFFFF" filter="url(#softShadow)"/>
<rect x="144" y="138" width="64" height="64" rx="10" fill="#171717"/>
<rect x="144" y="222" width="118" height="10" rx="5" fill="#E5E7EB"/>
<rect x="144" y="244" width="84" height="8" rx="4" fill="#F0F1F2"/>
<circle cx="352" cy="159" r="18" fill="#FFFFFF"/>
<circle cx="398" cy="159" r="18" fill="#55D6C2"/>
<rect x="336" y="274" width="118" height="10" rx="5" fill="#171717" fill-opacity="0.8"/>
<rect x="336" y="296" width="84" height="8" rx="4" fill="#E5E7EB"/>`,
  },
  {
    file: "audit-service.svg",
    draw: `<rect x="116" y="102" width="368" height="246" rx="16" fill="#FFFFFF" filter="url(#softShadow)"/>
<rect x="150" y="140" width="96" height="54" rx="10" fill="#167A67"/>
<rect x="268" y="148" width="176" height="14" rx="7" fill="#171717" fill-opacity="0.85"/>
<rect x="268" y="174" width="124" height="10" rx="5" fill="#E5E7EB"/>
<path d="M156 268 L178 290 L220 246" fill="none" stroke="#315FC8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="248" y="256" width="196" height="12" rx="6" fill="#F0F1F2"/>
<rect x="248" y="280" width="144" height="10" rx="5" fill="#E5E7EB"/>`,
  },
  {
    file: "dev-service.svg",
    draw: `<rect x="104" y="106" width="392" height="238" rx="16" fill="#FFFFFF" filter="url(#softShadow)"/>
<path d="M238 190 L190 225 L238 260" fill="none" stroke="#315FC8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M362 190 L410 225 L362 260" fill="none" stroke="#315FC8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M320 176 L280 274" fill="none" stroke="#171717" stroke-opacity="0.35" stroke-width="6" stroke-linecap="round"/>`,
  },
];

for (const it of items) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
  <defs>
    <filter id="softShadow" x="-15%" y="-15%" width="130%" height="135%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#171717" flood-opacity="0.08"/>
    </filter>
    ${it.defs || ""}
  </defs>
  <rect width="600" height="450" fill="#F2F2EF"/>
  ${it.draw}
</svg>`;
  fs.writeFileSync(path.join(dir, it.file), svg, "utf8");
}

console.log(`Updated ${items.length} gallery-grade studio catalog renders.`);
