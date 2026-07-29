// Generate branded 1200x630 featured images (PNG) for the blog articles.
// Draws each as an SVG in ABCAC brand style, then rasterizes via the
// pre-installed Chromium. Output: public/blog/<article-file>.png
//
// Usage: node scripts/generate-blog-images.mjs
import { chromium } from "playwright-core";
import fs from "fs";
import path from "path";

const NAVY = "#0D223F", BURGUNDY = "#7B1F1F", CREAM = "#F7F3EE", GOLDLINE = "#C9A227";

const POSTS = [
  { file: "01-certification-vs-licensure-arizona", category: "Certification & Licensure", lines: ["Certification vs. Licensure", "in Arizona"], motif: "seals" },
  { file: "02-arizona-license-ladder-lact-laac-liac", category: "Certification & Licensure", lines: ["The Arizona License Ladder:", "LACT → LAAC → LIAC"], motif: "ladder" },
  { file: "03-sb1062-lisac-to-liac", category: "Policy & Compliance", lines: ["From LISAC to LIAC:", "What SB1062 Changed"], motif: "doc" },
  { file: "04-icrc-adc-exam-inside", category: "Exams & Testing", lines: ["Inside the IC&RC", "ADC Exam"], motif: "exam" },
  { file: "05-counseling-compact-live-arizona", category: "Interstate Mobility", lines: ["The Counseling Compact", "Is Live in Arizona"], motif: "network" },
  { file: "06-42-cfr-part-2-enforceable", category: "Policy & Compliance", lines: ["42 CFR Part 2", "Is Now Enforceable"], motif: "shield" },
  { file: "07-ai-scribes-therapy-room", category: "Technology & AI", lines: ["AI Scribes in the", "Therapy Room"], motif: "wave" },
  { file: "08-contingency-management-meth", category: "Clinical & Treatment", lines: ["Contingency Management:", "The Tool We Underuse"], motif: "star" },
  { file: "09-arizona-overdose-outlier", category: "Arizona Landscape", lines: ["Why Arizona's Overdose", "Numbers Defy the National Trend"], motif: "chart" },
  { file: "10-become-addiction-counselor-arizona-roadmap", category: "Arizona Landscape", lines: ["Becoming an Addiction Counselor", "in Arizona: 2026 Roadmap"], motif: "road" },
];

const MOTIFS = {
  seals: `<circle cx="960" cy="240" r="120" fill="none" stroke="${CREAM}" stroke-width="10" opacity=".9"/>
    <circle cx="960" cy="240" r="88" fill="none" stroke="${CREAM}" stroke-width="4" opacity=".55"/>
    <rect x="820" y="300" width="180" height="130" rx="14" fill="${BURGUNDY}" stroke="${CREAM}" stroke-width="6"/>
    <line x1="850" y1="340" x2="970" y2="340" stroke="${CREAM}" stroke-width="8" stroke-linecap="round" opacity=".85"/>
    <line x1="850" y1="370" x2="950" y2="370" stroke="${CREAM}" stroke-width="8" stroke-linecap="round" opacity=".6"/>
    <line x1="850" y1="400" x2="930" y2="400" stroke="${CREAM}" stroke-width="8" stroke-linecap="round" opacity=".4"/>`,
  ladder: `<g stroke="${CREAM}" stroke-width="12" stroke-linecap="round">
    <line x1="840" y1="470" x2="960" y2="470"/><line x1="900" y1="360" x2="1020" y2="360"/><line x1="960" y1="250" x2="1080" y2="250"/></g>
    <g fill="${BURGUNDY}" stroke="${CREAM}" stroke-width="5">
    <circle cx="900" cy="440" r="24"/><circle cx="960" cy="330" r="24"/><circle cx="1020" cy="220" r="24"/></g>
    <path d="M 1040 200 L 1090 150 M 1090 150 l -28 6 M 1090 150 l -6 28" stroke="${GOLDLINE}" stroke-width="9" fill="none" stroke-linecap="round"/>`,
  doc: `<rect x="860" y="150" width="200" height="270" rx="16" fill="${CREAM}" opacity=".95"/>
    <g stroke="${NAVY}" stroke-width="10" stroke-linecap="round" opacity=".8">
    <line x1="895" y1="210" x2="1025" y2="210"/><line x1="895" y1="255" x2="1025" y2="255"/><line x1="895" y1="300" x2="985" y2="300"/></g>
    <rect x="880" y="340" width="120" height="44" rx="10" fill="${BURGUNDY}"/>
    <path d="M 1010 362 l 50 0 m 0 0 l -18 -14 m 18 14 l -18 14" stroke="${GOLDLINE}" stroke-width="9" fill="none" stroke-linecap="round"/>`,
  exam: `<rect x="830" y="160" width="240" height="280" rx="16" fill="${CREAM}" opacity=".95"/>
    <g stroke-width="8" stroke-linecap="round">
    <rect x="860" y="200" width="34" height="34" rx="8" fill="${BURGUNDY}"/><line x1="915" y1="217" x2="1040" y2="217" stroke="${NAVY}" opacity=".7"/>
    <rect x="860" y="265" width="34" height="34" rx="8" fill="none" stroke="${NAVY}" opacity=".6"/><line x1="915" y1="282" x2="1040" y2="282" stroke="${NAVY}" opacity=".7"/>
    <rect x="860" y="330" width="34" height="34" rx="8" fill="${BURGUNDY}"/><line x1="915" y1="347" x2="1040" y2="347" stroke="${NAVY}" opacity=".7"/></g>
    <path d="M 866 210 l 9 12 l 16 -20" stroke="${CREAM}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M 866 340 l 9 12 l 16 -20" stroke="${CREAM}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  network: `<g stroke="${CREAM}" stroke-width="5" opacity=".65">
    <line x1="880" y1="220" x2="1000" y2="300"/><line x1="1000" y1="300" x2="1090" y2="200"/><line x1="1000" y1="300" x2="930" y2="420"/><line x1="880" y1="220" x2="1090" y2="200"/><line x1="930" y1="420" x2="1090" y2="200"/></g>
    <g fill="${BURGUNDY}" stroke="${CREAM}" stroke-width="6">
    <circle cx="880" cy="220" r="30"/><circle cx="1090" cy="200" r="24"/><circle cx="1000" cy="300" r="36"/><circle cx="930" cy="420" r="26"/></g>`,
  shield: `<path d="M 950 150 l 110 42 v 96 c 0 84 -52 132 -110 158 c -58 -26 -110 -74 -110 -158 v -96 z" fill="${BURGUNDY}" stroke="${CREAM}" stroke-width="8"/>
    <rect x="915" y="285" width="70" height="60" rx="10" fill="${CREAM}"/>
    <path d="M 928 285 v -22 c 0 -26 44 -26 44 0 v 22" stroke="${CREAM}" stroke-width="10" fill="none"/>
    <circle cx="950" cy="312" r="8" fill="${NAVY}"/>`,
  wave: `<g stroke="${CREAM}" stroke-width="10" stroke-linecap="round">
    <line x1="850" y1="280" x2="850" y2="320"/><line x1="890" y1="250" x2="890" y2="350"/><line x1="930" y1="210" x2="930" y2="390"/><line x1="970" y1="260" x2="970" y2="340"/><line x1="1010" y1="230" x2="1010" y2="370"/><line x1="1050" y1="275" x2="1050" y2="325"/></g>
    <rect x="880" y="410" width="140" height="18" rx="9" fill="${BURGUNDY}"/>
    <rect x="905" y="390" width="90" height="20" rx="8" fill="${BURGUNDY}" opacity=".7"/>`,
  star: `<path d="M 950 170 l 32 66 l 73 10 l -53 51 l 13 72 l -65 -34 l -65 34 l 13 -72 l -53 -51 l 73 -10 z" fill="${GOLDLINE}" stroke="${CREAM}" stroke-width="7"/>
    <g fill="${BURGUNDY}" stroke="${CREAM}" stroke-width="5">
    <rect x="855" y="420" width="40" height="50" rx="8"/><rect x="915" y="390" width="40" height="80" rx="8"/><rect x="975" y="355" width="40" height="115" rx="8"/></g>`,
  chart: `<g stroke="${CREAM}" stroke-width="5" opacity=".5"><line x1="820" y1="440" x2="1100" y2="440"/><line x1="820" y1="440" x2="820" y2="170"/></g>
    <path d="M 830 240 L 910 280 L 990 330 L 1080 390" stroke="${CREAM}" stroke-width="10" fill="none" stroke-linecap="round" opacity=".7"/>
    <path d="M 830 380 L 910 350 L 990 290 L 1080 210" stroke="${BURGUNDY}" stroke-width="12" fill="none" stroke-linecap="round"/>
    <circle cx="1080" cy="210" r="16" fill="${BURGUNDY}" stroke="${CREAM}" stroke-width="5"/>`,
  road: `<path d="M 840 470 C 980 430 850 330 990 290 C 1110 255 1010 200 1090 160" stroke="${CREAM}" stroke-width="26" fill="none" stroke-linecap="round" opacity=".9"/>
    <path d="M 840 470 C 980 430 850 330 990 290 C 1110 255 1010 200 1090 160" stroke="${NAVY}" stroke-width="8" fill="none" stroke-dasharray="2 26" stroke-linecap="round"/>
    <g fill="${BURGUNDY}" stroke="${CREAM}" stroke-width="5">
    <circle cx="840" cy="470" r="20"/><circle cx="990" cy="290" r="20"/><circle cx="1090" cy="160" r="20"/></g>`,
};

function svgFor(post) {
  const titleSpans = post.lines
    .map((l, i) => `<tspan x="80" dy="${i === 0 ? 0 : 62}">${l.replace(/&/g, "&amp;")}</tspan>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${NAVY}"/><stop offset="1" stop-color="#122E54"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1210" cy="-40" r="330" fill="${BURGUNDY}" opacity=".22"/>
  <circle cx="-60" cy="660" r="280" fill="${BURGUNDY}" opacity=".16"/>
  <rect x="0" y="0" width="1200" height="10" fill="${BURGUNDY}"/>
  ${MOTIFS[post.motif]}
  <text x="80" y="120" font-family="Georgia, 'Times New Roman', serif" font-size="26" font-weight="700" letter-spacing="4" fill="${GOLDLINE}">${post.category.toUpperCase().replace(/&/g, "&amp;")}</text>
  <text x="80" y="330" font-family="Georgia, 'Times New Roman', serif" font-size="52" font-weight="700" fill="${CREAM}">${titleSpans}</text>
  <text x="80" y="540" font-family="Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="2" fill="${CREAM}" opacity=".85">ABCAC</text>
  <text x="80" y="572" font-family="Arial, sans-serif" font-size="17" fill="${CREAM}" opacity=".55">Arizona Board for Certification of Addiction Counselors</text>
</svg>`;
}

const outDir = path.join(process.cwd(), "public", "blog");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const post of POSTS) {
  const svgPath = path.join(outDir, `${post.file}.tmp.svg`);
  fs.writeFileSync(svgPath, svgFor(post));
  await page.goto(`file://${svgPath}`);
  await page.screenshot({ path: path.join(outDir, `${post.file}.png`) });
  fs.unlinkSync(svgPath);
  console.log(`✓ ${post.file}.png`);
}
await browser.close();
