import { writeFileSync } from "node:fs";
import { buildLocalPdf } from "../shared/local-pdf.ts";
writeFileSync("/tmp/gcbtp-verification.pdf", buildLocalPdf("Synthèse GcBtp", "Élément | G | Q | Nu | Nser\nSemelle S1 | 12.5 | 0 | 16.9 | 12.5"));
console.log("wrote /tmp/gcbtp-verification.pdf");
