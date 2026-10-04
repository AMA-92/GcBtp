import fs from "node:fs";
const path = "/home/ubuntu/gcbtp/client/src/components/AndroidWorkspace.tsx";
let source = fs.readFileSync(path, "utf8");
if (!source.includes('import BuildingCreateFlow from "./BuildingCreateFlow";')) {
  source = source.replace('import { toast } from "sonner";', 'import { toast } from "sonner";\nimport BuildingCreateFlow from "./BuildingCreateFlow";');
}
source = source.replace(/function BuildingScreen[\s\S]*?function PlanningScreen/, 'function BuildingScreen(props: any) { return <BuildingCreateFlow {...props} />; }\nfunction PlanningScreen');
fs.writeFileSync(path, source);
