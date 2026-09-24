
import { test, expect } from "@playwright/test";
const routes = ["/", "/asset/BRENT", "/map", "/events", "/cross-market", "/research"];
const viewports = [
  {width:380, height:800, label:"380"},
  {width:520, height:800, label:"520"},
  {width:1024, height:800, label:"1024"},
  {width:1440, height:900, label:"1440"},
];
test.describe("visual regression", () => {
  for (const route of routes) {
    for (const vp of viewports) {
      test(`${route} @ ${vp.label}`, async ({ page, browser }) => {
        const ctx = await browser.newContext({viewport: {width: vp.width, height: vp.height}});
        const p = await ctx.newPage();
        // mock API like hero1.spec does
        const MOCK = {
          marketHome: {indices:{SPX:{payload:{"Global Quote":{"05. price":"4521.50","10. change percent":"+0.42%"}},stale:false}}, commodities:{BRENT:{payload:{price:"82.31", change_pct:"+1.2%", "Global Quote":{"05. price":"82.31"}},stale:false}}, fx:{}, rates:{payload:{value:"4.21%"}}, event_ticker:Array.from({length:8},(_,i)=>({payload:{title:`BRENT holds $82 on Hormuz watch — event ${i+1}`}})), anomaly_strip:{max_chokepoint_anomaly:{id:"hormuz", pct_change:10.9, stale:false, retrieved_at:new Date().toISOString()}, news_count:8}, evidence:[{provider:"serpapi", dataset:"google_news"}]},
          asset:{ticker:"BRENT", quote:{payload:{"Global Quote":{"05. price":"82.31","08. previous close":"81.30"}, price:"82.31"}}, chart:{rows:Array.from({length:30},(_,i)=>({ts:String(i+1), close:80+i*0.05})), tail:[]}, physical_vs_narrative:{price_delta_pct:2.1, physical_delta_pct:10.9, verdict:"PHYSICAL"}, filings:[{form:"10-K",title:"Annual Report"}], insider:[{owner:"J. Doe"}], rising_queries_badge:["why is brent up"], regional_interest_strip:[{geo:"IN",value:100}], what_people_are_asking:["why is BRENT moving?"], physical_corroboration:{id:"hormuz", pct_change:10.9}, evidence:[{provider:"serpapi", dataset:"google_trends", query:"BRENT", retrieved_at:new Date().toISOString()}]},
          crossMarket:{matrix:{BRENT:{XOM:0.85, CVX:0.82}}, candidate_edges:[{from:"BRENT",to:"XLE",weight:0.82, dashed:true}], evidence:[{provider:"serpapi"}]},
          mapBox:{id:"hormuz", name:"Strait of Hormuz", bbox:[[24.5,55.5],[27.0,57.5]], count:142, baseline_7d:128, pct_change:10.9, stale:false, positions:[{mmsi:"4000001",lat:26.2,lon:56.0}], retrieved_at:new Date().toISOString()},
          research:{report:"# Research: Why is BRENT moving?\n\nSerpApi-backed synthesis. BRENT +1.2% via Hormuz anomaly corroborated by AIS.", evidence_count:3, evidence:[{provider:"serpapi", dataset:"google_news", query:"BRENT moving"}], trace:Array.from({length:7},(_,i)=>({node:`stage${i}`,label:`Stage ${i}`,stage:"Discover",status:"done"}))},
        };
        await p.route("**/api/market-home", r=>r.fulfill({status:200, contentType:"application/json", body: JSON.stringify(MOCK.marketHome)}));
        await p.route("**/api/asset/*", r=>r.fulfill({status:200, contentType:"application/json", body: JSON.stringify(MOCK.asset)}));
        await p.route("**/api/cross-market", async r=>{ if(r.request().method()==="GET") return r.fulfill({status:200, contentType:"application/json", body: JSON.stringify(MOCK.crossMarket)}); return r.continue();});
        await p.route("**/api/cross-market/simulate", async r=>{ const v=JSON.parse(r.request().postData()??'{}').shock_value??10; return r.fulfill({status:200, contentType:"application/json", body: JSON.stringify({shock_asset:"BRENT", shock_value:v, exposures:[{target:"XOM",exposure:v*0.85}], exposed_chokepoints:[], evidence:[{provider:"serpapi"}]})});});
        await p.route("**/api/map", async r=>{ if(r.request().method()==="GET" && r.request().url().endsWith("/api/map")) return r.fulfill({status:200, contentType:"application/json", body: JSON.stringify([MOCK.mapBox])}); return r.continue();});
        await p.route("**/api/map/hormuz", r=>r.fulfill({status:200, contentType:"application/json", body: JSON.stringify(MOCK.mapBox)}));
        await p.route("**/api/map/*/history**", r=>r.fulfill({status:200, contentType:"application/json", body: JSON.stringify({counts:[100], crossings:[5]})}));
        await p.route("**/api/events**", async r=>{ if(r.request().url().includes("/chain")) return r.fulfill({status:200, contentType:"application/json", body: JSON.stringify({event_id:"geopolitical-1", category:"geopolitical", commodity:"BRENT", sectors:["Energy"], companies:["XOM"]})}); return r.fulfill({status:200, contentType:"application/json", body: JSON.stringify({clusters:[{title:"Hormuz tension lifts BRENT"}], evidence:[{provider:"serpapi"}]})});});
        await p.route("**/api/search**", r=>r.fulfill({status:200, contentType:"application/json", body: JSON.stringify({query:"", results:[{label:"BRENT",type:"asset", route:"/asset/BRENT"}]})}));
        await p.route("**/api/research/run", r=>r.fulfill({status:200, contentType:"application/json", body: JSON.stringify(MOCK.research)}));
        await p.route("**/healthz", r=>r.fulfill({status:200, contentType:"application/json", body: JSON.stringify({ok:true})}));
        await p.route("**/readyz", r=>r.fulfill({status:200, contentType:"application/json", body: JSON.stringify({db_exists:true, cache_size:12, ais_task:true})}));
        await p.route("**/api/geo/**", r=>r.fulfill({status:200, contentType:"application/json", body: JSON.stringify({type:"FeatureCollection",features:[{type:"Feature", geometry:{type:"Point", coordinates:[55.5,26.2]}, properties:{}}]})}));
        await p.route("**/api/map/layers/**", r=>r.fulfill({status:200, contentType:"application/json", body: JSON.stringify({feed:"weather", dots:[], evidence:[{provider:"serpapi"}]})}));
        await p.goto(route, {waitUntil:"networkidle", timeout:10000}).catch(()=>p.goto("/",{waitUntil:"domcontentloaded"}));
        await p.waitForTimeout(1200);
        // checks
        const overflow = await p.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth);
        const scrollW = await p.evaluate(()=>document.documentElement.scrollWidth);
        const innerW = await p.evaluate(()=>window.innerWidth);
        const canv = await p.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor || getComputedStyle(document.body).backgroundColor);
        const hairlineCount = await p.evaluate(()=> document.querySelectorAll('[class*="border-border"], [class*="border-zinc"]').length);
        // screenshot
        const safe = route.replace(/[^a-z0-9]/g,"_") || "root";
        const fp = `playwright-report/visual-${safe}-${vp.label}.png`;
        await p.screenshot({path: fp, fullPage:true});
        console.log(JSON.stringify({route, vp: vp.label, overflow, scrollW, innerW, canv, hairlineCount, fp}));
        expect(overflow, `horizontal overflow at ${route} ${vp.label}: scrollW ${scrollW} vs innerW ${innerW}`).toBe(false);
        await ctx.close();
      });
    }
  }
});
