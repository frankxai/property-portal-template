import assert from "node:assert/strict";
import { packSchema, sampleAssets, listingIdentity, normalizeListingUrl, portfolioSummary } from "../lib/principal-workspace.ts";

const fresh=()=>({version:"property-workspace.v1",assets:structuredClone(sampleAssets)});
const cases=[];
function check(name,run){run();cases.push(name)}
check("Roundtrip preserves fictional provenance and financial inputs",()=>assert.deepEqual(packSchema.parse(JSON.parse(JSON.stringify(fresh()))),fresh()));
check("Reject mismatched horizons",()=>{const pack=fresh();pack.assets[1].input.horizonYears=5;assert.equal(packSchema.safeParse(pack).success,false)});
check("Reject duplicate asset identities",()=>{const pack=fresh();pack.assets[1].id=pack.assets[0].id;assert.equal(packSchema.safeParse(pack).success,false)});
check("Reject future observation and absent date",()=>{const pack=fresh();pack.assets[0].sourceUrl="https://www.kleinanzeigen.de/s-anzeige/model/123456789-208-10";assert.equal(packSchema.safeParse(pack).success,false);pack.assets[0].observedAt="2099-01-01";assert.equal(packSchema.safeParse(pack).success,false)});
check("Listing identity survives changed title and legacy host",()=>assert.equal(listingIdentity("https://www.ebay-kleinanzeigen.de/s-anzeige/old/123456789-208-10?tracking=1"),listingIdentity("https://kleinanzeigen.de/s-anzeige/new/123456789-208-10")));
check("Reject duplicate imported listing identities",()=>{const pack=fresh();pack.assets[0].sourceUrl="https://www.kleinanzeigen.de/s-anzeige/old/123456789-208-10";pack.assets[1].sourceUrl="https://www.ebay-kleinanzeigen.de/s-anzeige/new/123456789-208-10?track=1";pack.assets[0].observedAt=pack.assets[1].observedAt="2026-09-01";assert.equal(packSchema.safeParse(pack).success,false)});
check("Reject unsafe or lookalike source URLs",()=>{for(const url of ["javascript:alert(1)","https://kleinanzeigen.de.evil.test/s-anzeige/a","https://owner:secret@kleinanzeigen.de/s-anzeige/a","https://127.0.0.1/s-anzeige/a"])assert.throws(()=>normalizeListingUrl(url))});
check("Portfolio year-one cash is sum of asset cash",()=>{const summary=portfolioSummary(sampleAssets);assert.equal(summary.years[0].cashFlow,summary.models.reduce((sum,item)=>sum+item.model.years[0].cashFlow,0));assert.equal(summary.years.length,10)});
console.log(JSON.stringify({status:"passed",checks:cases.length,cases},null,2));
