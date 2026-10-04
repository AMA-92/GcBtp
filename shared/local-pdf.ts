import type { RCDesignResult, RCElementDesign } from "./rc-design";
import {
  loadReinforcementTemplate,
  reinforcementDrawingNumber,
  reinforcementElementSummary,
  reinforcementElementTitle,
  groupReinforcementElements,
  type ReinforcementA4Group,
} from "./reinforcement-report";

function pdfEscape(value: string) {
  const ascii = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/·/g, " | ")
    .replace(/×/g, "x")
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .replace(/→/g, "->")
    .replace(/÷/g, "/")
    .replace(/\s{2,}/g, " ")
    .replace(/[^\x20-\x7E]/g, "?");
  return ascii.replace(/[\\()]/g, character => `\\${character}`);
}

function wrapLine(line: string, width = 92) {
  const words = line.trim().split(/\s+/);
  const result: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= width) current += ` ${word}`;
    else {
      result.push(current);
      current = word;
    }
  }
  if (current) result.push(current);
  return result.length ? result : [""];
}

function pageCommands(lines: string[]) {
  return [
    "BT",
    "/F1 10 Tf",
    "50 790 Td",
    ...lines.map((line, index) => {
      const critical = /plus chargé|rouge vif/i.test(line);
      return `${index ? "0 -15 Td\n" : ""}${critical ? "1 0 0 rg\n" : "0 0 0 rg\n"}(${pdfEscape(line)}) Tj`;
    }),
    "ET",
  ].join("\n");
}

type Point = { x: number; y: number };

function polygon(points: Point[], fill: string, stroke = "0.25 0.31 0.36 RG") {
  const path = `${points[0].x} ${points[0].y} m ${points.slice(1).map(point => `${point.x} ${point.y} l`).join(" ")} h`;
  return `${fill} rg\n${stroke}\n1 w\n${path}\nB`;
}

function line(from: Point, to: Point, color = "0.25 0.31 0.36 RG", width = 1) {
  return `${color}\n${width} w\n${from.x} ${from.y} m ${to.x} ${to.y} l S`;
}

function textAt(text: string, x: number, y: number, size = 10, color = "0.12 0.17 0.21 rg") {
  return `${color}\nBT\n/F1 ${size} Tf\n1 0 0 1 ${x} ${y} Tm\n(${pdfEscape(text)}) Tj\nET`;
}

function stairSchemaCommands() {
  const commands = [
    "q",
    "0.97 0.98 0.99 rg\n50 105 495 650 re f",
    polygon([{ x: 90, y: 175 }, { x: 390, y: 175 }, { x: 500, y: 230 }, { x: 200, y: 230 }], "0.32 0.37 0.40"),
    polygon([{ x: 300, y: 585 }, { x: 500, y: 585 }, { x: 555, y: 625 }, { x: 355, y: 625 }], "0.38 0.42 0.45"),
    polygon([{ x: 180, y: 225 }, { x: 220, y: 205 }, { x: 330, y: 420 }, { x: 290, y: 440 }], "0.55 0.57 0.57"),
    polygon([{ x: 330, y: 420 }, { x: 370, y: 440 }, { x: 480, y: 600 }, { x: 440, y: 580 }], "0.55 0.57 0.57"),
    polygon([{ x: 290, y: 420 }, { x: 370, y: 420 }, { x: 410, y: 460 }, { x: 330, y: 460 }], "0.64 0.66 0.65", "0.88 0.42 0.18 RG"),
    line({ x: 290, y: 420 }, { x: 330, y: 460 }, "0.88 0.42 0.18 RG", 1.5),
    line({ x: 370, y: 420 }, { x: 410, y: 460 }, "0.88 0.42 0.18 RG", 1.5),
    ...Array.from({ length: 8 }, (_, index) => line({ x: 195 + index * 14, y: 230 + index * 23 }, { x: 235 + index * 14, y: 210 + index * 23 }, "0.20 0.25 0.28 RG", 1)),
    ...Array.from({ length: 8 }, (_, index) => line({ x: 345 + index * 14, y: 430 + index * 22 }, { x: 385 + index * 14, y: 450 + index * 22 }, "0.20 0.25 0.28 RG", 1)),
    line({ x: 290, y: 480 }, { x: 410, y: 480 }, "0.88 0.42 0.18 RG", 1),
    line({ x: 290, y: 475 }, { x: 290, y: 485 }, "0.88 0.42 0.18 RG", 1),
    line({ x: 410, y: 475 }, { x: 410, y: 485 }, "0.88 0.42 0.18 RG", 1),
    line({ x: 290, y: 480 }, { x: 300, y: 484 }, "0.88 0.42 0.18 RG", 1),
    line({ x: 290, y: 480 }, { x: 300, y: 476 }, "0.88 0.42 0.18 RG", 1),
    line({ x: 410, y: 480 }, { x: 400, y: 484 }, "0.88 0.42 0.18 RG", 1),
    line({ x: 410, y: 480 }, { x: 400, y: 476 }, "0.88 0.42 0.18 RG", 1),
    line({ x: 420, y: 420 }, { x: 420, y: 460 }, "0.88 0.42 0.18 RG", 1),
    line({ x: 415, y: 420 }, { x: 425, y: 420 }, "0.88 0.42 0.18 RG", 1),
    line({ x: 415, y: 460 }, { x: 425, y: 460 }, "0.88 0.42 0.18 RG", 1),
    polygon([{ x: 110, y: 230 }, { x: 125, y: 230 }, { x: 125, y: 550 }, { x: 110, y: 550 }], "0.23 0.29 0.34"),
    polygon([{ x: 500, y: 225 }, { x: 515, y: 225 }, { x: 515, y: 585 }, { x: 500, y: 585 }], "0.23 0.29 0.34"),
    textAt("SCHEMA TECHNIQUE - ESCALIER MONOLITHIQUE", 92, 720, 14, "0.06 0.18 0.27 rg"),
    textAt("Deux volées en dalle inclinée BA 15 cm + paillasse intermédiaire continue", 92, 700, 10),
    textAt("VOLÉE 1 - dalle inclinée", 128, 300, 9, "0.88 0.42 0.18 rg"),
    textAt("VOLÉE 2 - dalle inclinée", 405, 535, 9, "0.88 0.42 0.18 rg"),
    textAt("PAILLASSE 2.00 x 1.00 m", 270, 500, 9, "0.88 0.42 0.18 rg"),
    textAt("Départ au coin supérieur de la volée 1", 82, 145, 8),
    textAt("La volée 2 prend naissance sur le bord opposé du palier", 275, 145, 8),
    textAt("Continuité monolithique : une seule entité structurelle", 150, 120, 10, "0.06 0.35 0.38 rg"),
    textAt("+3.20 m", 520, 635, 8, "0.06 0.35 0.38 rg"),
    textAt("+1.60 m", 520, 445, 8, "0.06 0.35 0.38 rg"),
    textAt("+0.00 m", 520, 170, 8, "0.06 0.35 0.38 rg"),
    "Q",
  ];
  return commands.join("\n");
}

export function buildLocalPdf(title: string, content: string) {
  const contentLines = content.split(/\r?\n/).flatMap(line => wrapLine(line));
  const lines = contentLines[0] === title ? contentLines : [title, "", ...contentLines];
  const pageSize = 48;
  const textPages = Array.from({ length: Math.max(1, Math.ceil(lines.length / pageSize)) }, (_, index) =>
    lines.slice(index * pageSize, (index + 1) * pageSize)
  );
  const hasStairSchema = /escaliers?|paillasse|stair/i.test(`${title}\n${content}`);
  const pageKinds: Array<{ kind: "text" | "stair"; lines?: string[] }> = textPages.map(page => ({ kind: "text", lines: page }));
  if (hasStairSchema) pageKinds.push({ kind: "stair" });
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageKinds.map((_, index) => `${5 + index * 2} 0 R`).join(" ")}] /Count ${pageKinds.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  pageKinds.forEach((page, index) => {
    const contentId = 5 + index * 2;
    const commands = page.kind === "stair" ? stairSchemaCommands() : pageCommands(page.lines ?? []);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
      `<< /Length ${new TextEncoder().encode(commands).length} >>\nstream\n${commands}\nendstream`
    );
  });
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function downloadLocalPdf(title: string, content: string) {
  const bytes = buildLocalPdf(title, content);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName =
    title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() ||
    "rapport-gcbtp";
  link.href = url;
  link.download = `${safeName}.pdf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pdfLineText(value: unknown) {
  return String(value ?? "").replace(/[\r\n]+/g, " ");
}

function a4Text(text: string, x: number, y: number, size = 8, bold = false) {
  return `0 0 0 rg\nBT\n/${bold ? "F2" : "F1"} ${size} Tf\n1 0 0 1 ${x} ${y} Tm\n(${pdfEscape(pdfLineText(text))}) Tj\nET`;
}

function a4Box(x: number, y: number, w: number, h: number, fill = "0.98 0.98 0.98 rg", stroke = "0.25 0.30 0.34 RG") {
  return `${fill}\n${stroke}\n0.7 w\n${x} ${y} ${w} ${h} re B`;
}

function a4Line(x1: number, y1: number, x2: number, y2: number, width = 0.7) {
  return `0.25 0.30 0.34 RG\n${width} w\n${x1} ${y1} m ${x2} ${y2} l S`;
}

function a4Dimension(x1: number, y1: number, x2: number, y2: number, label: string) {
  const horizontal = Math.abs(y2 - y1) < Math.abs(x2 - x1);
  const tx = horizontal ? (x1 + x2) / 2 - Math.min(70, label.length * 2.4) : x2 + 6;
  const ty = horizontal ? y1 + 5 : (y1 + y2) / 2;
  const arrows = horizontal
    ? [a4Line(x1, y1, x2, y2, 0.6), a4Line(x1, y1, x1 + 5, y1 + 3, 0.6), a4Line(x1, y1, x1 + 5, y1 - 3, 0.6), a4Line(x2, y2, x2 - 5, y2 + 3, 0.6), a4Line(x2, y2, x2 - 5, y2 - 3, 0.6)].join("\n")
    : [a4Line(x1, y1, x2, y2, 0.6), a4Line(x1, y1, x1 + 3, y1 + 5, 0.6), a4Line(x1, y1, x1 - 3, y1 + 5, 0.6), a4Line(x2, y2, x2 + 3, y2 - 5, 0.6), a4Line(x2, y2, x2 - 3, y2 - 5, 0.6)].join("\n");
  return `${arrows}\n${a4Text(label, tx, ty, 6, true)}`;
}

function reinforcementSketchCommands(element: RCElementDesign, x: number, y: number, w: number, h: number) {
  const commands: string[] = [a4Box(x, y, w, h, "0.995 0.995 0.995 rg")];
  const bars = (suffix: string) => element.reinforcement.find(item => item.id.endsWith(suffix));
  const label = (bar: ReturnType<typeof bars>, fallback: string) => bar?.label || fallback;
  const diameter = (bar: ReturnType<typeof bars>, fallback = 8) => bar?.diameterMm ?? fallback;
  const count = (bar: ReturnType<typeof bars>, fallback = 1) => Math.max(1, bar?.count ?? fallback);
  const dimValues = (geometry: string) => (geometry.match(/\d+(?:[.,]\d+)?/g) ?? []).map(v => Number(v.replace(",", ".")));
  const numbers = dimValues(geometryByIdForDrawing(element));
  const mm = (n: number | undefined, fallback: number) => Number.isFinite(n) && (n as number) > 0 ? n as number : fallback;
  const arrowText = (text: string, tx: number, ty: number) => commands.push(a4Text(text, tx, ty, 6, true));
  const drawDotBars = (n: number, x1: number, x2: number, yy: number, r = 2.4) => {
    const visible = Math.min(Math.max(n, 2), 18);
    for (let i = 0; i < visible; i++) {
      const px = visible === 1 ? (x1 + x2) / 2 : x1 + (x2 - x1) * i / (visible - 1);
      commands.push(`0.70 0.10 0.06 rg\n${px} ${yy} ${r} 0 360 arc f`);
    }
  };
  const drawVerticalBars = (n: number, xx: number, y1: number, y2: number, r = 2.2) => {
    const visible = Math.min(Math.max(n, 2), 18);
    for (let i = 0; i < visible; i++) {
      const py = visible === 1 ? (y1 + y2) / 2 : y1 + (y2 - y1) * i / (visible - 1);
      commands.push(`0.70 0.10 0.06 rg\n${xx} ${py} ${r} 0 360 arc f`);
    }
  };
  const drawStirrups = (n: number, x1: number, x2: number, y1: number, y2: number) => {
    const visible = Math.min(Math.max(n, 3), 18);
    for (let i = 0; i < visible; i++) {
      const xx = x1 + (x2 - x1) * i / (visible - 1);
      commands.push(a4Line(xx, y1, xx, y2, 0.8));
      if (i === 0 || i === visible - 1) commands.push(a4Line(xx, y1, xx + (i === 0 ? 7 : -7), y1 + 5, 0.8));
    }
  };

  if (element.type === "column") {
    const b = mm(numbers[0], 250), d = mm(numbers[1], b), height = mm(numbers[2], 3000);
    const longitudinal = bars(":longitudinal"), ties = bars(":ties");
    // Elévation
    const ex = x + 28, ey = y + 35, ew = 120, eh = 115;
    commands.push(a4Text("ÉLÉVATION DU POTEAU", ex, y + h - 16, 7, true));
    commands.push(a4Box(ex + 42, ey, 36, eh, "1 1 1 rg", "0.15 0.22 0.26 RG"));
    drawVerticalBars(count(longitudinal, 4), ex + 46, ey + 5, ey + eh - 5, 1.8);
    drawVerticalBars(count(longitudinal, 4), ex + 74, ey + 5, ey + eh - 5, 1.8);
    drawStirrups(count(ties, 8), ex + 43, ex + 77, ey + 8, ey + eh - 8);
    commands.push(a4Dimension(ex + 42, ey - 13, ex + 78, ey - 13, `${b.toFixed(0)} mm`));
    commands.push(a4Dimension(ex + 90, ey, ex + 90, ey + eh, `${height.toFixed(0)} mm`));
    arrowText(`1 : ${label(longitudinal, "Longitudinales")}`, ex + 4, ey + eh + 5);
    arrowText(`2 : ${label(ties, "Cadres")}`, ex + 4, ey + 12);
    // Coupe A-A
    const sx = x + 220, sy = y + 45, sw = 85, sh = 85;
    commands.push(a4Text("COUPE A-A", sx, y + h - 16, 7, true));
    commands.push(a4Box(sx, sy, sw, sh, "1 1 1 rg", "0.15 0.22 0.26 RG"));
    commands.push(a4Box(sx + 8, sy + 8, sw - 16, sh - 16, "1 1 1 rg", "0.10 0.42 0.44 RG"));
    const nLong = Math.min(count(longitudinal, 4), 12);
    const pts = Math.max(2, Math.ceil(nLong / 2));
    for (let i = 0; i < pts; i++) {
      const px = sx + 15 + (sw - 30) * i / Math.max(1, pts - 1);
      commands.push(`0.70 0.10 0.06 rg\n${px} ${sy + 15} 2.5 0 360 arc f`);
      commands.push(`0.70 0.10 0.06 rg\n${px} ${sy + sh - 15} 2.5 0 360 arc f`);
    }
    commands.push(a4Dimension(sx, sy - 11, sx + sw, sy - 11, `${b.toFixed(0)} mm`));
    commands.push(a4Dimension(sx + sw + 10, sy, sx + sw + 10, sy + sh, `${d.toFixed(0)} mm`));
    arrowText(`HA ${diameter(longitudinal, 12)} · ${count(longitudinal, 4)} barres`, sx, sy - 23);
    arrowText(`HA ${diameter(ties, 6)} · ${label(ties, "cadres")}`, sx, sy - 34);
    return commands.join("\n");
  }

  if (element.type === "beam" || element.type === "tie-beam") {
    const b = mm(numbers[0], 200), d = mm(numbers[1], 400), length = mm(numbers[2], 3500);
    const top = bars(":top"), bottom = bars(":bottom"), links = bars(":links");
    const bx = x + 35, by = y + 78, bw = 300, bh = 65;
    commands.push(a4Text("ÉLÉVATION — ARMATURES LONGITUDINALES ET CADRES", bx, y + h - 16, 7, true));
    commands.push(a4Line(bx, by + 8, bx + bw, by + 8, 1.2));
    commands.push(a4Line(bx, by + bh - 8, bx + bw, by + bh - 8, 1.2));
    drawStirrups(count(links, 8), bx + 8, bx + bw - 8, by + 8, by + bh - 8);
    arrowText(`1 : ${label(bottom, "Longitudinal inférieur")}`, bx, by + bh + 8);
    arrowText(`2 : ${label(top, "Longitudinal supérieur")}`, bx, by - 12);
    arrowText(`3 : ${label(links, "Cadres")}`, bx + 190, by + bh + 8);
    commands.push(a4Dimension(bx, by - 25, bx + bw, by - 25, `${length.toFixed(0)} mm`));
    commands.push(a4Dimension(bx + bw + 15, by, bx + bw + 15, by + bh, `${d.toFixed(0)} mm`));
    // Coupes aux appuis et en travée
    const sectionY = y + 25, secW = 58, secH = 40;
    [bx + 35, bx + bw - 95].forEach((sx, index) => {
      commands.push(a4Box(sx, sectionY, secW, secH, "1 1 1 rg", "0.15 0.22 0.26 RG"));
      commands.push(a4Box(sx + 6, sectionY + 6, secW - 12, secH - 12, "1 1 1 rg", "0.10 0.42 0.44 RG"));
      const botN = Math.min(count(bottom, 2), 6), topN = Math.min(count(top, 2), 6);
      drawDotBars(botN, sx + 12, sx + secW - 12, sectionY + 12, 2.2);
      drawDotBars(topN, sx + 12, sx + secW - 12, sectionY + secH - 12, 2.2);
      commands.push(a4Text(index === 0 ? "A-A APPUI" : "B-B TRAVÉE", sx, sectionY - 9, 5.5, true));
    });
    commands.push(a4Text(`Bas : ${diameter(bottom, 12)} / Haut : ${diameter(top, 10)} / Cadres : ${diameter(links, 8)}`, bx + 105, sectionY - 9, 5.5));
    return commands.join("\n");
  }

  if (element.type === "footing") {
    const B = mm(numbers[0] ? numbers[0] * 1000 : undefined, 1200), L = mm(numbers[1] ? numbers[1] * 1000 : undefined, 1200), hF = mm(numbers[2] ? numbers[2] * 1000 : undefined, 300);
    const bx = x + 30, by = y + 55, bw = 150, bh = 105;
    const armX = bars(":x"), armY = bars(":y");
    commands.push(a4Text("VUE EN PLAN — NAPPES X / Y", bx, y + h - 16, 7, true));
    commands.push(a4Box(bx, by, bw, bh, "1 1 1 rg", "0.15 0.22 0.26 RG"));
    const nx = Math.min(count(armX, 8), 18), ny = Math.min(count(armY, 8), 18);
    for (let i = 0; i < nx; i++) commands.push(a4Line(bx + 8 + (bw - 16) * i / Math.max(1, nx - 1), by + 8, bx + 8 + (bw - 16) * i / Math.max(1, nx - 1), by + bh - 8, 0.55));
    for (let i = 0; i < ny; i++) commands.push(a4Line(bx + 8, by + 8 + (bh - 16) * i / Math.max(1, ny - 1), bx + bw - 8, by + 8 + (bh - 16) * i / Math.max(1, ny - 1), 0.55));
    commands.push(a4Box(bx + bw/2 - 22, by + bh/2 - 18, 44, 36, "0.94 0.94 0.94 rg"));
    commands.push(a4Dimension(bx, by - 13, bx + bw, by - 13, `${B.toFixed(0)} mm`));
    commands.push(a4Dimension(bx + bw + 12, by, bx + bw + 12, by + bh, `${L.toFixed(0)} mm`));
    // Coupes X-X / Y-Y
    const sx = x + 225, sy = y + 42, sw = 115;
    commands.push(a4Text("COUPES X-X / Y-Y", sx, y + h - 16, 7, true));
    for (let j = 0; j < 2; j++) {
      const yy = sy + j * 55;
      commands.push(a4Box(sx, yy, sw, 34, "0.95 0.95 0.95 rg", "0.15 0.22 0.26 RG"));
      commands.push(a4Line(sx + 4, yy + 7, sx + sw - 4, yy + 7, 1));
      for (let i = 0; i < Math.min(j === 0 ? nx : ny, 10); i++) commands.push(a4Line(sx + 10 + i * (sw - 20) / Math.max(1, Math.min(j === 0 ? nx : ny, 10)-1), yy + 9, sx + 10 + i * (sw - 20) / Math.max(1, Math.min(j === 0 ? nx : ny, 10)-1), yy + 18, 0.7));
      commands.push(a4Text(j === 0 ? `X-X · ${label(armX, "Armatures X")}` : `Y-Y · ${label(armY, "Armatures Y")}`, sx, yy - 6, 5.5, true));
    }
    commands.push(a4Text(`Épaisseur : ${hF.toFixed(0)} mm`, sx, sy - 22, 6, true));
    return commands.join("\n");
  }

  if (element.type === "slab") {
    const thickness = mm(numbers[0], 150);
    const px = x + 25, py = y + 55, pw = 185, ph = 100;
    const armX = bars(":x"), armY = bars(":y");
    commands.push(a4Text("PLAN — NAPPES D'ARMATURES", px, y + h - 16, 7, true));
    commands.push(a4Box(px, py, pw, ph, "1 1 1 rg", "0.15 0.22 0.26 RG"));
    const nx = Math.min(count(armX, 7), 16), ny = Math.min(count(armY, 7), 16);
    for (let i = 0; i < nx; i++) commands.push(a4Line(px + 8 + (pw - 16) * i / Math.max(1, nx - 1), py + 6, px + 8 + (pw - 16) * i / Math.max(1, nx - 1), py + ph - 6, 0.5));
    for (let i = 0; i < ny; i++) commands.push(a4Line(px + 6, py + 8 + (ph - 16) * i / Math.max(1, ny - 1), px + pw - 6, py + 8 + (ph - 16) * i / Math.max(1, ny - 1), 0.5));
    commands.push(a4Dimension(px, py - 12, px + pw, py - 12, "PORTÉE X"));
    commands.push(a4Dimension(px + pw + 10, py, px + pw + 10, py + ph, "PORTÉE Y"));
    const sx = x + 255, sy = y + 52, sw = 90, sh = 55;
    commands.push(a4Text("COUPE", sx, y + h - 16, 7, true));
    commands.push(a4Box(sx, sy, sw, 20, "0.95 0.95 0.95 rg", "0.15 0.22 0.26 RG"));
    commands.push(a4Line(sx + 8, sy + 6, sx + sw - 8, sy + 6, 1));
    commands.push(a4Line(sx + 8, sy + 14, sx + sw - 8, sy + 14, 0.8));
    commands.push(a4Text(`e = ${thickness.toFixed(0)} mm`, sx, sy - 12, 6, true));
    commands.push(a4Text(`X : ${label(armX, "HA X")}`, sx, sy + 38, 5.5));
    commands.push(a4Text(`Y : ${label(armY, "HA Y")}`, sx, sy + 29, 5.5));
    return commands.join("\n");
  }

  if (element.type === "wall") {
    const t = mm(numbers[0], 200), length = mm(numbers[1], 3000), height = mm(numbers[2], 3000);
    const vertical = bars(":vertical"), horizontal = bars(":horizontal"), boundary = bars(":boundary");
    const ex = x + 25, ey = y + 38, ew = 190, eh = 112;
    commands.push(a4Text("ÉLÉVATION — ARMATURES VERTICALES / HORIZONTALES", ex, y + h - 16, 7, true));
    commands.push(a4Box(ex, ey, ew, eh, "1 1 1 rg", "0.15 0.22 0.26 RG"));
    const nv = Math.min(count(vertical, 8), 18), nh = Math.min(count(horizontal, 8), 12);
    for (let i = 0; i < nv; i++) commands.push(a4Line(ex + 8 + (ew - 16) * i / Math.max(1, nv - 1), ey + 5, ex + 8 + (ew - 16) * i / Math.max(1, nv - 1), ey + eh - 5, 0.8));
    for (let i = 0; i < nh; i++) commands.push(a4Line(ex + 5, ey + 8 + (eh - 16) * i / Math.max(1, nh - 1), ex + ew - 5, ey + 8 + (eh - 16) * i / Math.max(1, nh - 1), 0.5));
    commands.push(a4Line(ex + 8, ey, ex + 8, ey + eh, 2));
    commands.push(a4Line(ex + ew - 8, ey, ex + ew - 8, ey + eh, 2));
    commands.push(a4Dimension(ex, ey - 12, ex + ew, ey - 12, `${length.toFixed(0)} mm`));
    commands.push(a4Dimension(ex + ew + 12, ey, ex + ew + 12, ey + eh, `${height.toFixed(0)} mm`));
    const sx = x + 250, sy = y + 55;
    commands.push(a4Text("COUPE DU VOILE", sx, y + h - 16, 7, true));
    commands.push(a4Box(sx, sy, 100, 75, "0.95 0.95 0.95 rg", "0.15 0.22 0.26 RG"));
    commands.push(a4Line(sx + 35, sy, sx + 35, sy + 75, 2));
    commands.push(a4Line(sx + 65, sy, sx + 65, sy + 75, 2));
    commands.push(a4Text(`t = ${t.toFixed(0)} mm`, sx, sy - 12, 6, true));
    commands.push(a4Text(`V : ${label(vertical, "Armatures verticales")}`, sx, sy + 62, 5.2));
    commands.push(a4Text(`H : ${label(horizontal, "Armatures horizontales")}`, sx, sy + 51, 5.2));
    commands.push(a4Text(`Rives : ${label(boundary, "Armatures de rive")}`, sx, sy + 40, 5.2));
    return commands.join("\n");
  }

  commands.push(a4Text("DÉTAIL DE FERRAILLAGE", x + 8, y + h - 16, 7, true));
  commands.push(a4Text("Disposition issue des propositions d'armatures calculées.", x + 8, y + 12, 6));
  return commands.join("\n");
}

// Le générateur PDF reçoit la géométrie au niveau de la fonction principale.
// Pour conserver une API compacte, la géométrie textuelle est passée via un contexte temporaire
// pendant la génération de chaque plan.
let currentDrawingGeometry: Record<string, string> = {};
function geometryByIdForDrawing(element: RCElementDesign) {
  return currentDrawingGeometry[element.elementId] ?? "";
}


function reinforcementShapeInfo(bar: RCElementDesign["reinforcement"][number]) {
  const text = bar.label.toLowerCase();
  if (/cadre|etrier|étrier/.test(text)) return { code: "31", form: "Cadre fermé" };
  if (/rive|boundary/.test(text)) return { code: "21", form: "Barre droite" };
  if (/nappe|horizontal|vertical|longitudinal|principale/.test(text)) return { code: "00", form: "Barre droite" };
  return { code: "00", form: "Barre droite" };
}

function reinforcementShapeCommands(bar: RCElementDesign["reinforcement"][number], x: number, y: number) {
  const info = reinforcementShapeInfo(bar);
  if (info.code === "31") {
    return [a4Line(x, y, x + 18, y, 0.8), a4Line(x, y, x, y + 10, 0.8), a4Line(x, y + 10, x + 18, y + 10, 0.8), a4Line(x + 18, y + 10, x + 18, y + 3, 0.8)];
  }
  return [a4Line(x, y, x + 22, y, 0.9)];
}
function reinforcementA4Commands(group: ReinforcementA4Group, result: RCDesignResult, groupIndex: number, geometryById: Record<string, string> = {}, rowOffset = 0, continuation = false) {
  currentDrawingGeometry = geometryById;
  const template = loadReinforcementTemplate();
  const W = 842, H = 595;
  const margin = 24;
  const representative = group.representative;
  const drawingNo = `${template.drawingPrefix || "GCBTP"}-F-${String(groupIndex + 1).padStart(3, "0")}-${representative.type.toUpperCase()}-${String(group.elements.length).padStart(2, "0")}`;
  const summaries = group.elements.map(reinforcementElementSummary);
  const utilization = Math.max(...summaries.map(item => item.utilization), 0);
  const status = summaries.some(item => item.status === "NON SATISFAISANT") ? "NON SATISFAISANT" : summaries.some(item => item.status === "A VERIFIER") ? "A VERIFIER" : "SATISFAISANT";
  const title = `${reinforcementElementTitle(representative)} — SECTION TYPE`;
  const commands: string[] = [];
  commands.push("q", "1 1 1 rg", `0 0 ${W} ${H} re f`, "Q");
  commands.push(a4Box(margin, 500, W - 2 * margin, 70, "0.94 0.96 0.97 rg"));
  commands.push(a4Text(template.logoText || template.companyName || "GCBTP", margin + 10, 548, 15, true));
  commands.push(a4Text(title, margin + 110, 548, 13, true));
  commands.push(a4Text(`${template.scaleLabel} · ${drawingNo}${continuation ? " · SUITE" : ""}`, margin + 110, 531, 7));
  commands.push(a4Text(`ELEMENT TYPE REPRESENTATIF · QUANTITE : ${group.elements.length}`, margin + 110, 518, 7, true));
  commands.push(a4Text(`Taux max. : ${(utilization * 100).toFixed(0)} % · ${status}`, 570, 548, 7, true));

  commands.push(a4Box(margin, 300, 375, 185, "0.99 0.99 0.99 rg"));
  commands.push(reinforcementSketchCommands(representative, margin, 300, 375, 185));

  commands.push(a4Box(415, 300, 403, 185, "0.99 0.99 0.99 rg"));
  commands.push(a4Text("IDENTIFICATION DU GROUPE", 425, 466, 8, true));
  const ids = group.elements.map(item => item.elementId).join(", ");
  const geometry = geometryById[representative.elementId] ?? "Section / géométrie : non renseignée";
  const idChunks = ids.match(/.{1,72}(?:, |$)/g)?.map(value => value.trim()) ?? [ids];
  const geometryLines = wrapLine(geometry, 58);
  const infoLines = [
    `Type : ${reinforcementElementTitle(representative)}`,
    `Quantité : ${group.elements.length} élément(s) identique(s)`,
    `Repères : ${idChunks[0] || "—"}`,
    ...idChunks.slice(1).map(value => `         ${value}`),
    `Combinaison : ${representative.combinationName} (${representative.combinationId})`,
    `Référentiel : ${result.standard || "non renseigné"}`,
    `Annexe / règles locales : ${result.nationalAnnex || "non renseignée"}`,
    `Béton : C${result.materialBasis.fckMpa || "—"} · Acier : fyk ${result.materialBasis.fykMpa || "—"} MPa`,
    `Enrobage : ${result.materialBasis.coverMm || "—"} mm`,
    `Géométrie : ${geometryLines[0] || "non renseignée"}`,
    ...geometryLines.slice(1).map(value => `            ${value}`),
    "UN SEUL ELEMENT REPRESENTATIF est dessiné ci-contre.",
    "Les autres repères ont exactement le même type, section et ferraillage.",
  ];
  infoLines.forEach((line, i) => commands.push(a4Text(line.slice(0, 112), 425, 451 - i * 11, 6.5, line.startsWith("UN SEUL"))));
  commands.push(a4Text("CONTRÔLES GOUVERNANTS", 425, 330, 8, true));
  representative.checks.slice(0, 2).forEach((check, i) => {
    const label = `${check.label} · Ed ${check.demand === null ? "—" : check.demand.toFixed(2)} ${check.unit} · Rd ${check.resistance === null ? "—" : check.resistance.toFixed(2)} · ${check.status}`;
    commands.push(a4Text(label.slice(0, 92), 425, 316 - i * 11, 6.5));
  });

  commands.push(a4Box(margin, 115, W - 2 * margin, 170, "1 1 1 rg"));
  commands.push(a4Text("NOMENCLATURE / FERRAILLAGE DE L'ELEMENT TYPE", margin + 10, 268, 9, true));
  const cols = [margin + 8, margin + 155, margin + 370, margin + 420, margin + 475, margin + 530, margin + 600, margin + 700];
  ["Pos.", "Armature", "Code", "Forme", "Dia. (mm)", "Qté", "L totale (m)", "Masse (kg)"].forEach((head, i) => commands.push(a4Text(head, cols[i], 250, 6.5, true)));
  commands.push(a4Line(margin + 6, 244, W - margin - 6, 244));
  // Le dessin et la nomenclature représentent un seul élément type (le représentant).
  // La quantité et les repères sont indiqués séparément dans le cartouche technique.
  const rows = representative.reinforcement.map(bar => ({ elementId: representative.elementId, bar }));
  const visibleRows = rows.slice(rowOffset, rowOffset + 10);
  visibleRows.forEach((row, i) => {
    const y = 232 - i * 14;
    const shape = reinforcementShapeInfo(row.bar);
    commands.push(a4Text(String(rowOffset + i + 1), cols[0], y, 6.5, true));
    commands.push(a4Text(`${row.elementId} · ${row.bar.label}`.slice(0, 34), cols[1], y, 6.2));
    commands.push(a4Text(shape.code, cols[2], y, 6.5));
    commands.push(...reinforcementShapeCommands(row.bar, cols[3], y + 2));
    commands.push(a4Text(`HA ${row.bar.diameterMm}`, cols[4], y, 6.5));
    commands.push(a4Text(String(row.bar.count), cols[5], y, 6.5));
    commands.push(a4Text(row.bar.totalLengthM.toFixed(1), cols[6], y, 6.5));
    commands.push(a4Text(row.bar.massKg.toFixed(1), cols[7], y, 6.5));
  });
  if (rowOffset === 0 && rows.length > 10) commands.push(a4Text(`Suite sur ${Math.ceil((rows.length - 10) / 10)} page(s) A4 de nomenclature.`, margin + 8, 123, 6, true));
  commands.push(a4Text(`ELEMENT REPRESENTATIF : ${representative.elementId} · QUANTITE : ${group.elements.length}`, margin + 8, 135, 6.5, true));

  const cartY = 24;
  commands.push(a4Box(margin, cartY, W - 2 * margin, 78, "0.96 0.97 0.98 rg"));
  commands.push(a4Line(590, cartY, 590, cartY + 78));
  commands.push(a4Line(700, cartY, 700, cartY + 78));
  commands.push(a4Line(margin, cartY + 28, W - margin, cartY + 28));
  commands.push(a4Line(margin, cartY + 53, W - margin, cartY + 53));
  commands.push(a4Text("ENTREPRISE / BUREAU D'ÉTUDES", margin + 8, cartY + 61, 6, true));
  commands.push(a4Text(template.companyName || "Nom de l'entreprise", margin + 8, cartY + 46, 8, true));
  commands.push(a4Text([template.companyAddress, template.companyPhone, template.companyEmail, template.companyWebsite, template.officeReference].filter(Boolean).join(" · ") || "Adresse · Téléphone · Email · Référence", margin + 8, cartY + 34, 5.5));
  commands.push(a4Text("PROJET / CLIENT", margin + 8, cartY + 18, 6, true));
  commands.push(a4Text(`${template.projectName || "Projet"} · ${template.projectReference || "Réf. non renseignée"} · ${template.clientName || "Client non renseigné"}`, margin + 115, cartY + 18, 6.5));
  commands.push(a4Text(template.projectAddress || "Adresse du projet non renseignée", margin + 8, cartY + 7, 5.5));
  commands.push(a4Text("DESSIN", 598, cartY + 61, 6, true));
  commands.push(a4Text(drawingNo, 598, cartY + 45, 7, true));
  commands.push(a4Text("FORMAT", 708, cartY + 61, 6, true));
  commands.push(a4Text("A4", 708, cartY + 45, 8, true));
  commands.push(a4Text("IND", 708, cartY + 18, 6, true));
  commands.push(a4Text("A", 728, cartY + 18, 8, true));
  commands.push(a4Text(template.engineerName ? `Ingénieur : ${template.engineerName}` : "Ingénieur : non renseigné", 598, cartY + 18, 6));
  commands.push(a4Text(template.drafterName ? `Dessinateur : ${template.drafterName}` : "Dessinateur : non renseigné", 598, cartY + 7, 6));
  commands.push(a4Text(template.footerNote, margin + 8, 12, 5.5));
  return commands.join("\n");
}

export function buildReinforcementA4Pdf(result: RCDesignResult, element?: RCElementDesign, geometryById: Record<string, string> = {}, groupsOverride?: ReinforcementA4Group[]) {
  const groups = groupsOverride ?? (element
    ? [{ key: element.elementId, type: element.type, elements: [element], representative: element, identicalReinforcement: true } satisfies ReinforcementA4Group]
    : groupReinforcementElements(result.elements, geometryById));
  const pageGroups = groups.length ? groups : [{ key: "EMPTY", type: "beam", elements: [{ elementId: "EMPTY", type: "beam", combinationId: "-", combinationName: "-", checks: [], reinforcement: [], limitations: ["Aucun élément de ferraillage disponible."] } as RCElementDesign], representative: { elementId: "EMPTY", type: "beam", combinationId: "-", combinationName: "-", checks: [], reinforcement: [], limitations: ["Aucun élément de ferraillage disponible."] } as RCElementDesign, identicalReinforcement: true } satisfies ReinforcementA4Group];
  const template = loadReinforcementTemplate();
  const pageSpecs: Array<{ group: ReinforcementA4Group; index: number; rowOffset: number; continuation: boolean }> = [];
  pageGroups.forEach((group, index) => {
    const rows = group.representative.reinforcement.length;
    pageSpecs.push({ group, index, rowOffset: 0, continuation: false });
    for (let offset = 10; offset < rows; offset += 10) pageSpecs.push({ group, index, rowOffset: offset, continuation: true });
  });
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageSpecs.map((_, index) => `${5 + index * 2} 0 R`).join(" ")} ] /Count ${pageSpecs.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  pageSpecs.forEach((spec, pageIndex) => {
    const pageId = 5 + pageIndex * 2;
    const contentId = 6 + pageIndex * 2;
    let commands = reinforcementA4Commands(spec.group, result, spec.index, geometryById, spec.rowOffset, spec.continuation);
    const media = template.orientation === "portrait" ? [0, 0, 595, 842] : [0, 0, 842, 595];
    if (template.orientation === "portrait") commands = `q\n0 1 -1 0 595 0 cm\n${commands}\nQ`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [${media.join(" ")}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
      `<< /Length ${new TextEncoder().encode(commands).length} >>\nstream\n${commands}\nendstream`
    );
  });
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function downloadReinforcementGroupA4Pdf(result: RCDesignResult, group: ReinforcementA4Group, geometryById: Record<string, string> = {}) {
  const bytes = buildReinforcementA4Pdf(result, undefined, geometryById, [group]);
  const template = loadReinforcementTemplate();
  const label = reinforcementElementTitle(group.representative).replace(/\s+/g, "-");
  const section = (geometryById[group.representative.elementId] ?? "section").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const filename = `${template.drawingPrefix || "GCBTP"}-${label}-${section}-Q${group.elements.length}.pdf`;
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadReinforcementA4Pdf(result: RCDesignResult, element?: RCElementDesign, geometryById: Record<string, string> = {}) {
  const bytes = buildReinforcementA4Pdf(result, element, geometryById);
  const groups = element ? [] : groupReinforcementElements(result.elements, geometryById);
  const title = element ? `${reinforcementElementTitle(element)}-${element.elementId}` : `ferraillage-A4-GcBtp-${groups.length}-plans`;
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
