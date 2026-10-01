import { z } from "zod";
import { investmentSchema, evaluateInvestment, type InvestmentInput } from "./investment-model.ts";

export function currentObservationDate() {
  const date=new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

export const documentLabels = ["Mieterliste & Verträge", "Darlehen & Zinsbindung", "Grundbuch & Eigentum", "Zustand & Investitionen"] as const;
const evidenceSchema = z.object({ label: z.enum(documentLabels), status: z.enum(["missing", "owner-confirmed"]) }).strict();
export const assetSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,48}$/),
  label: z.string().trim().min(1).max(70),
  units: z.number().int().min(1).max(10000),
  sourceKind: z.enum(["example", "example-derived", "owner-input"]),
  sourceUrl: z.string().max(600).optional(),
  observedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  input: investmentSchema,
  evidence: z.array(evidenceSchema).length(4)
}).strict().superRefine((asset, ctx) => {
  if (new Set(asset.evidence.map(item => item.label)).size !== 4) ctx.addIssue({code:"custom",message:"Jeder Dokumenttyp muss genau einmal vorkommen.",path:["evidence"]});
  if (asset.sourceUrl) {
    try { normalizeListingUrl(asset.sourceUrl); } catch { ctx.addIssue({code:"custom",message:"Ungültige Kleinanzeigen-Quelle.",path:["sourceUrl"]}); }
  }
  if (asset.observedAt && (!Number.isFinite(Date.parse(asset.observedAt + "T00:00:00Z")) || new Date(asset.observedAt + "T00:00:00Z").toISOString().slice(0,10) !== asset.observedAt)) ctx.addIssue({code:"custom",message:"Ungültiges Beobachtungsdatum.",path:["observedAt"]});
  if (asset.observedAt && asset.observedAt > currentObservationDate()) ctx.addIssue({code:"custom",message:"Beobachtungsdatum liegt in der Zukunft.",path:["observedAt"]});
  if (Boolean(asset.sourceUrl) !== Boolean(asset.observedAt)) ctx.addIssue({code:"custom",message:"Quelle und Beobachtungsdatum gemeinsam angeben.",path:["sourceUrl"]});
});
export type WorkspaceAsset = z.infer<typeof assetSchema>;
export const packSchema = z.object({version:z.literal("property-workspace.v1"),assets:z.array(assetSchema).min(1).max(12)}).strict().superRefine((pack,ctx)=>{
  if(new Set(pack.assets.map(asset=>asset.id)).size !== pack.assets.length) ctx.addIssue({code:"custom",message:"Objekt-IDs müssen eindeutig sein.",path:["assets"]});
  if(new Set(pack.assets.map(asset=>asset.input.horizonYears)).size !== 1) ctx.addIssue({code:"custom",message:"Das Portfolio braucht einen gemeinsamen Betrachtungszeitraum.",path:["assets"]});
  const sources=pack.assets.flatMap(asset=>{try{return asset.sourceUrl?[listingIdentity(asset.sourceUrl)]:[]}catch{return[]}});
  if(new Set(sources).size !== sources.length) ctx.addIssue({code:"custom",message:"Ein Inserat darf nur einem Objektmodell zugeordnet sein.",path:["assets"]});
});

const base: InvestmentInput = {
  purchasePrice:1450000, acquisitionCostPct:10, initialCapex:70000, monthlyColdRent:10400,
  vacancyPct:4, annualOperatingCosts:12000, annualMaintenanceReserve:9000,
  rentGrowthPct:1.5, costGrowthPct:2, loanAmount:1000000, interestRatePct:3.5,
  amortizationYears:30, fixedRateYears:5, refinanceRatePct:4.5, horizonYears:10,
  exitCapRatePct:5, sellingCostPct:3, discountRatePct:8
};
export const emptyEvidence = () => documentLabels.map(label=>({label,status:"missing" as const}));
export const sampleAssets: WorkspaceAsset[] = [
  {id:"DEMO-01",label:"Wohnhaus Nord",units:8,sourceKind:"example",input:base,evidence:emptyEvidence()},
  {id:"DEMO-02",label:"Stadthaus West",units:5,sourceKind:"example",input:{...base,purchasePrice:820000,initialCapex:35000,monthlyColdRent:4900,annualOperatingCosts:7200,annualMaintenanceReserve:6000,loanAmount:570000,interestRatePct:3.8,fixedRateYears:2,refinanceRatePct:4.3,exitCapRatePct:5.2},evidence:emptyEvidence()},
  {id:"DEMO-03",label:"Gartenhaus Süd",units:4,sourceKind:"example",input:{...base,purchasePrice:610000,initialCapex:90000,monthlyColdRent:3600,vacancyPct:8,annualOperatingCosts:4500,annualMaintenanceReserve:5000,loanAmount:430000,interestRatePct:4.1,fixedRateYears:7,refinanceRatePct:4.8,exitCapRatePct:5.2},evidence:emptyEvidence()}
];

export function normalizeListingUrl(value: string) {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || !["kleinanzeigen.de","www.kleinanzeigen.de","www.ebay-kleinanzeigen.de"].includes(url.hostname) || url.username || url.password || url.port || !url.pathname.startsWith("/s-anzeige/")) throw new Error("Bitte eine HTTPS-Inserat-URL von Kleinanzeigen verwenden.");
  url.search="";url.hash="";
  url.hostname="www.kleinanzeigen.de";
  url.pathname=url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function listingIdentity(value:string) {
  const canonical=normalizeListingUrl(value);
  const tail=new URL(canonical).pathname.split("/").pop()||"";
  const id=tail.match(/^(\d{6,})-\d+-\d+$/)?.[1];
  return id?`listing:${id}`:canonical;
}

export function portfolioSummary(assets:WorkspaceAsset[]) {
  const models=assets.map(asset=>({asset,model:evaluateInvestment(asset.input)}));
  const horizon=assets[0].input.horizonYears;
  const years=Array.from({length:horizon},(_,i)=>({
    year:i+1,
    cashFlow:models.reduce((sum,item)=>sum+item.model.years[i].cashFlow,0),
    debt:models.reduce((sum,item)=>sum+item.model.years[i].closingDebt,0),
    debtService:models.reduce((sum,item)=>sum+item.model.years[i].debtService,0),
    cashAvailable:models.reduce((sum,item)=>sum+item.model.years[i].cashAvailableForDebtService,0)
  }));
  return {models,years,totalCost:models.reduce((s,m)=>s+m.model.totalCost,0),equity:models.reduce((s,m)=>s+m.model.initialEquity,0),initialDebt:assets.reduce((s,a)=>s+a.input.loanAmount,0),units:assets.reduce((s,a)=>s+a.units,0),npv:models.reduce((s,m)=>s+m.model.npv,0)};
}

export function decisionQueue(assets:WorkspaceAsset[]) {
  return assets.flatMap(asset=>{
    const model=evaluateInvestment(asset.input);
    const minCoverage=Math.min(...model.years.map(y=>y.coverageAfterReserve ?? Infinity));
    const actions:{id:string;assetId:string;title:string;detail:string;tone:"amber"|"teal";section:"underwrite"|"evidence"}[]=[];
    if(minCoverage<1) actions.push({id:asset.id+"-coverage",assetId:asset.id,title:"Liquiditätslücke prüfen",detail:`${asset.label}: Schuldendienst ist in mindestens einem Modelljahr nach Reserve nicht gedeckt.`,tone:"amber",section:"underwrite"});
    if(asset.input.fixedRateYears<asset.input.horizonYears && asset.input.loanAmount>0 && asset.input.fixedRateYears<asset.input.amortizationYears) actions.push({id:asset.id+"-refi",assetId:asset.id,title:`Anschlussfinanzierung · Jahr ${asset.input.fixedRateYears+1}`,detail:`${asset.label}: Restschuld, Bankangebot und tragbare Rate zusammen prüfen.`,tone:"amber",section:"underwrite"});
    const missing=asset.evidence.filter(e=>e.status==="missing").length;
    if(missing)actions.push({id:asset.id+"-evidence",assetId:asset.id,title:`${missing} Belege offen`,detail:`${asset.label}: Annahmen vor einer Kapitalentscheidung mit Unterlagen abgleichen.`,tone:"teal",section:"evidence"});
    return actions;
  }).sort((a,b)=>{
    const priority=(id:string)=>id.endsWith("-coverage")?0:id.endsWith("-refi")?1:2;
    return priority(a.id)-priority(b.id);
  });
}

export const primarySources = [
  {id:"kst-rate",title:"Körperschaftsteuer nach Jahr",authority:"Bundesfinanzministerium",url:"https://www.bundesfinanzministerium.de/Content/DE/Glossareintraege/K/koerperschaftsteuer.html?view=renderHelp",note:"15 % bis 2027; ab 2028 jährlich ein Prozentpunkt weniger, ab 2032 10 %. Nur Körperschaftsteuer, keine Gesamtsteuerquote."},
  {id:"participation",title:"Beteiligungserträge",authority:"KStG § 8b",url:"https://www.gesetze-im-internet.de/kstg_1977/__8b.html",note:"Beteiligungserträge und Anteilsverkäufe gesondert prüfen. Die Regeln machen Mieten oder direkte Immobilienverkäufe nicht zu Beteiligungserträgen."},
  {id:"trade",title:"Erweiterte Grundstückskürzung",authority:"GewStG § 9",url:"https://www.gesetze-im-internet.de/gewstg/__9.html",note:"Antrag, tatsächliche Tätigkeit und Ausschlüsse prüfen; Nebentätigkeiten und ihre Grenzen sind entscheidend."},
  {id:"maintenance",title:"Erhaltung der Mietsache",authority:"BGB § 535",url:"https://www.gesetze-im-internet.de/bgb/__535.html",note:"Zustand, Mangel und Verantwortlichkeit anhand des konkreten Mietverhältnisses prüfen."},
  {id:"kleinanzeigen",title:"Professionelle Importschnittstellen",authority:"Kleinanzeigen",url:"https://hilfe-gewerblich.kleinanzeigen.de/artikel/schnittstellen",note:"OpenImmo-Import mit gebuchter Partnerschaft und individuellen FTP-Zugangsdaten. Kein Zugang zur Suche oder zu Nachrichten fremder Konten."}
];

export function structureBrief(input:{existing:boolean;residence:string;goal:string;hasHolding:boolean;year:string}) {
  const facts=`Objektland: Deutschland (Arbeitsannahme). Eigentümer-Steueransässigkeit: ${input.residence || "offen"}. Betrachtungsjahr: ${input.year}. ${input.existing?"Bestandsvermögen":"Neuerwerb"}. Holding vorhanden: ${input.hasHolding?"laut Eingabe ja":"laut Eingabe nein"}. Ziel: ${input.goal}.`;
  const questions=[
    input.existing?"Welche Steuer- und Finanzierungskosten löst eine Übertragung des konkreten Bestands aus, verglichen mit Behalten? Erwerbsdatum, Nutzung, stille Reserven, Grunderwerbsteuer und Bankzustimmung belegen.":"Welche Erwerbsstruktur soll vor dem notariellen Kaufvertrag Eigentümer werden? Finanzierung, Haftung und laufende Kosten je Variante vergleichen.",
    "Wie unterscheiden sich Reinvestition und private Entnahme nach sämtlichen Steuerstufen, Solidaritätszuschlag, Gewerbesteuer und Verwaltungskosten?",
    "Erfüllt die Objektgesellschaft nach ihrer tatsächlichen Tätigkeit die Voraussetzungen der erweiterten Grundstückskürzung? PV, Zusatzleistungen und verbundene Unternehmen einbeziehen.",
    "Wie unterscheiden sich Objektverkauf und Anteilsverkauf beim vorgesehenen Ausstieg? Beteiligungsregeln nicht auf direkte Immobiliengewinne übertragen.",
    "Welche AfA-Basis, Zinsen, sofortigen Aufwendungen und aktivierungspflichtigen Maßnahmen sind aus den Belegen abzuleiten? Tilgung und bloße Rücklagen sind nicht als laufender Aufwand zu behandeln."
  ];
  return `# Strukturentscheidung – Arbeitsbrief\n\n${facts}\n\n## Vergleich\nPrivatvermögen | direkt gehaltene Objektgesellschaft | Holding mit Objektgesellschaft(en). Bestehende Objekte und Neuerwerbe separat rechnen. Keine Variante ist bereits empfohlen.\n\n## Entscheidende Fragen\n${questions.map((q,i)=>`${i+1}. ${q}`).join("\n")}\n\n## Benötigte Unterlagen\nEigentums- und Beteiligungsübersicht; Kaufverträge und Erwerbsdaten; Darlehen; Mieterliste; letzte Steuerbescheide und Abschreibungsverzeichnis; Maßnahmenplan; Entnahme- und Exit-Ziel. Unterlagen ausschließlich im vereinbarten privaten Datenraum teilen.\n\n## Nächste Entscheidung\nSteuerberatung beauftragen, die drei Varianten auf gleicher Datengrundlage und für das tatsächliche Jahr zu vergleichen. Bis dahin keine Übertragungsempfehlung.\n\n## Primärquellen\n${primarySources.slice(0,3).map(s=>`- ${s.title}: ${s.url}`).join("\n")}\n\nQuellenstand: 12.09.2026. Fallbezogene Rechts- und Steuerprüfung offen. Bei Auslandsbezug lokales Recht und DBA gesondert prüfen.\n`;
}
