import { FileText, ShieldCheck } from "lucide-react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";

export default function SharedReport() {
  const [, params] = useRoute<{ token: string }>("/partage/:token");
  const report = trpc.reports.shared.useQuery({ token: params?.token ?? "" }, { enabled: Boolean(params?.token) });
  if (report.isLoading) return <div className="grid min-h-screen place-items-center bg-[#f5f7fa] text-sm text-[#71808a]">Chargement du rapport…</div>;
  if (!report.data) return <div className="grid min-h-screen place-items-center bg-[#f5f7fa] p-6 text-center"><div><FileText className="mx-auto mb-4 h-10 w-10 text-[#9ba9b0]" /><h1 className="text-2xl font-semibold text-[#102f45]">Rapport introuvable</h1><p className="mt-2 text-sm text-[#71808a]">Ce lien a peut-être été supprimé ou n’est plus valide.</p></div></div>;
  return <main className="min-h-screen bg-[#f5f7fa] p-5 md:p-10"><div className="mx-auto max-w-3xl rounded-2xl border border-[#e3e9ed] bg-white p-6 shadow-sm md:p-10"><div className="mb-8 flex items-center justify-between border-b border-[#eef1f3] pb-6"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#102f45] text-white"><FileText className="h-5 w-5" /></div><div><div className="font-semibold text-[#102f45]">GcBtp</div><div className="text-xs uppercase tracking-[0.16em] text-[#94a0a7]">Rapport partagé</div></div></div><ShieldCheck className="h-5 w-5 text-[#0b747a]" /></div><h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#102f45]">{report.data.title}</h1><p className="mt-2 text-sm text-[#71808a]">Document généré et conservé dans un espace sécurisé.</p><a href={report.data.fileUrl} target="_blank" rel="noreferrer" className="mt-8 inline-flex rounded-xl bg-[#0b747a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#095f65]">Ouvrir le PDF</a></div></main>;
}
