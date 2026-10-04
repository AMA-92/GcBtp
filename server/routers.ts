import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { invokeLLM } from "./_core/llm";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createCalculation, createEstimate, createMeasurement, createPrice, createProject, createReport, listCalculations, listEstimates, listMeasurements, listPrices, listProjects, listReports, getReportByToken, updateProject } from "./db";
import { nanoid } from "nanoid";
import { storagePut } from "./storage";
import { buildLocalPdf } from "../shared/local-pdf";

const projectInput = z.object({ name: z.string().min(2), client: z.string().min(2), site: z.string().min(2), author: z.string().min(2), currency: z.string().default("XOF"), unitSystem: z.string().default("métrique") });
const calculationInput = z.object({ projectId: z.number(), type: z.string(), title: z.string(), inputData: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}), resultData: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}) });
const assistantInput = z.object({ question: z.string().min(2), context: z.string().default("Aucun module spécifique ouvert.") });

function n(value: unknown, fallback = 0) { const result = Number(value); return Number.isFinite(result) ? result : fallback; }
function round(value: number) { return Math.round(value * 100) / 100; }
function beamResult(input: Record<string, unknown>) {
  const length = n(input.length), width = n(input.width), height = n(input.height), count = n(input.count, 1);
  const volume = length * width * height * count;
  const formwork = 2 * (width + height) * length * count;
  const steel = volume * n(input.steelRate, 100);
  const load = n(input.load, 8); const moment = load * length * length / 8; const shear = load * length / 2; return { volume: round(volume), formwork: round(formwork), steel: round(steel), moment: round(moment), shear: round(shear), formula: "V=L×l×h ; M=qL²/8 ; V=qL/2", warning: "Résultat indicatif à vérifier selon la norme et le projet." };
}
function slabResult(input: Record<string, unknown>) { const length = n(input.length), width = n(input.width), thickness = n(input.thickness); const volume = length * width * thickness; return { area: round(length * width), volume: round(volume), formwork: round(length * width), formula: "V=L×l×e", warning: "Les charges et le ferraillage doivent être validés par un ingénieur." }; }
function columnResult(input: Record<string, unknown>) { const width = n(input.width), depth = n(input.depth), height = n(input.height), count = n(input.count, 1); const volume = width * depth * height * count; return { volume: round(volume), formwork: round(2 * (width + depth) * height * count), axialLoad: round(n(input.load) + volume * 25), formula: "P=Pentrée+Poids propre", warning: "Ce calcul ne remplace pas une vérification de flambement et de ferraillage." }; }
function footingResult(input: Record<string, unknown>) { const length = n(input.length), width = n(input.width), thickness = n(input.thickness), load = n(input.load), soil = n(input.soilBearing, 150); const area = length * width; return { area: round(area), volume: round(area * thickness), pressure: round(area ? load / area : 0), capacity: round(area * soil), formula: "q=N/A", warning: "La portance du sol doit provenir d’une donnée géotechnique validée." }; }
function dosageResult(input: Record<string, unknown>) { const volume = n(input.volume, 1), cement = n(input.cement, 350), waterRatio = n(input.waterRatio, 0.5); return { cement: round(volume * cement), sand: round(volume * 0.5), gravel: round(volume * 0.8), water: round(volume * cement * waterRatio), formula: "Quantités = volume × dosage indicatif", warning: "Une formulation de laboratoire reste nécessaire pour une exigence de résistance." }; }
function stairResult(input: Record<string, unknown>) { const rise = n(input.rise, 2.8), steps = Math.max(1, Math.round(n(input.steps, 16))), tread = n(input.tread, 0.28); return { riser: round(rise / steps), totalRun: round(steps * tread), steps, formula: "h marche = hauteur totale / nombre de marches", warning: "Vérifier la géométrie, les charges et le ferraillage selon le projet." }; }

export const appRouter = router({
  system: systemRouter,
  auth: router({ me: publicProcedure.query(opts => opts.ctx.user), logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }) }),
  projects: router({
    list: protectedProcedure.query(({ ctx }) => listProjects(ctx.user.id)),
    create: protectedProcedure.input(projectInput).mutation(({ ctx, input }) => createProject({ ...input, ownerId: ctx.user.id })),
    update: protectedProcedure.input(z.object({ id: z.number(), patch: projectInput.partial().extend({ status: z.enum(["active", "archived"]).optional(), progress: z.number().min(0).max(100).optional() }) })).mutation(({ ctx, input }) => updateProject(input.id, ctx.user.id, input.patch)),
    duplicate: protectedProcedure.input(z.object({ source: projectInput.extend({ progress: z.number().optional() }) })).mutation(({ ctx, input }) => createProject({ ...input.source, ownerId: ctx.user.id, name: `${input.source.name} — copie`, progress: input.source.progress ?? 0 })),
  }),
  prices: router({
    list: protectedProcedure.query(({ ctx }) => listPrices(ctx.user.id)),
    create: protectedProcedure.input(z.object({ category: z.string(), label: z.string(), unit: z.string(), unitPrice: z.number(), currency: z.string().default("XOF") })).mutation(({ ctx, input }) => createPrice({ ...input, unitPrice: input.unitPrice.toFixed(2), ownerId: ctx.user.id })),
  }),
  measurements: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().optional() }).optional()).query(({ ctx, input }) => listMeasurements(ctx.user.id, input?.projectId)),
    create: protectedProcedure.input(z.object({ projectId: z.number(), elementType: z.string(), label: z.string(), inputs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])), results: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])) })).mutation(({ ctx, input }) => createMeasurement({ ownerId: ctx.user.id, projectId: input.projectId, elementType: input.elementType, label: input.label, inputsData: JSON.stringify(input.inputs), resultsData: JSON.stringify(input.results) })),
  }),
  calculations: router({
    list: protectedProcedure.query(({ ctx }) => listCalculations(ctx.user.id)),
    create: protectedProcedure.input(calculationInput).mutation(({ ctx, input }) => createCalculation({ ownerId: ctx.user.id, projectId: input.projectId, type: input.type, title: input.title, inputData: JSON.stringify(input.inputData), resultData: JSON.stringify(input.resultData) })),
    quick: protectedProcedure.input(z.object({ type: z.enum(["poutre", "dalle", "poteau", "semelle", "dosage", "escalier"]), input: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])) })).mutation(({ input }) => { const result = input.type === "poutre" ? beamResult(input.input) : input.type === "dalle" ? slabResult(input.input) : input.type === "poteau" ? columnResult(input.input) : input.type === "semelle" ? footingResult(input.input) : input.type === "dosage" ? dosageResult(input.input) : stairResult(input.input); return { type: input.type, result }; }),
  }),
  estimates: router({
    list: protectedProcedure.query(({ ctx }) => listEstimates(ctx.user.id)),
    create: protectedProcedure.input(z.object({ projectId: z.number(), reference: z.string(), title: z.string(), lines: z.array(z.object({ label: z.string(), unit: z.string(), quantity: z.number(), unitPrice: z.number() })), taxRate: z.number().min(0).max(100) })).mutation(({ ctx, input }) => { const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0); const total = subtotal * (1 + input.taxRate / 100); return createEstimate({ ownerId: ctx.user.id, projectId: input.projectId, reference: input.reference, title: input.title, linesData: JSON.stringify(input.lines), subtotal: subtotal.toFixed(2), taxRate: input.taxRate.toFixed(2), total: total.toFixed(2) }); }),
  }),
  reports: router({
    list: protectedProcedure.query(({ ctx }) => listReports(ctx.user.id)),
    create: protectedProcedure.input(z.object({ projectId: z.number(), type: z.string(), title: z.string(), fileKey: z.string(), fileUrl: z.string() })).mutation(({ ctx, input }) => createReport({ ...input, ownerId: ctx.user.id, shareToken: nanoid(32) })),
    createPdf: protectedProcedure.input(z.object({ projectId: z.number(), type: z.string(), title: z.string(), content: z.string() })).mutation(async ({ ctx, input }) => {
      const shareToken = nanoid(32);
      const key = `${ctx.user.id}/reports/${shareToken}.pdf`;
      const pdf = buildLocalPdf(input.title, input.content);
      const stored = await storagePut(key, pdf, "application/pdf");
      const id = await createReport({ ownerId: ctx.user.id, projectId: input.projectId, type: input.type, title: input.title, fileKey: stored.key, fileUrl: stored.url, shareToken });
      return { id, url: stored.url, shareToken };
    }),
    shared: publicProcedure.input(z.object({ token: z.string() })).query(({ input }) => getReportByToken(input.token)),
  }),
  assistant: router({
    ask: protectedProcedure.input(assistantInput).mutation(async ({ input }) => { const response = await invokeLLM({ messages: [{ role: "system", content: "Tu es l’assistant GcBtp. Réponds en français, explique les hypothèses et formules de façon claire. Ne présente jamais un calcul indicatif comme une validation réglementaire. Pour les sujets de structure, recommande une vérification par un ingénieur habilité." }, { role: "user", content: `Module ouvert: ${input.context}\nQuestion: ${input.question}` }] }); return { answer: response.choices?.[0]?.message?.content ?? "Je n’ai pas pu générer une réponse." }; }),
  }),
});

export type AppRouter = typeof appRouter;
