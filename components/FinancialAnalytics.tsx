"use client";

import { useState, useMemo, useCallback } from "react";
import { Sparkles, BarChart2, TrendingUp, Activity, Shield, Users, Zap, Calculator } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type KmHistory = { date: string; pe: number|null; ev_ebitda: number|null; roic: number|null; p_fcf: number|null; current_ratio: number|null; debt_equity: number|null }[];
type GrowthHistory = { date: string; rev_growth: number; eps_growth: number; fcf_growth: number }[];
type EarningsSurprise = { date: string; eps_actual: number|null; eps_est: number|null; surprise_pct: number|null }[];
type PeerComp = { symbol: string; name?: string; pe: number|null; ev_ebitda: number|null; p_fcf: number|null; roic: number; net_margin: number; gross_margin?: number|null; rev_per_emp?: number|null; market_cap?: number|null; rev_growth?: number|null }[];
type SegmentData = { date: string; data: Record<string, number> };
type SegmentHistory = { date: string; data: Record<string, number> }[];
type AnalystEstimates = { date: string; rev_avg: number|null; eps_avg: number|null; ebitda_avg: number|null; num_analysts: number|null }[];
type QuarterlyTrend = { date: string; revenue?: number; gross_margin_pct?: number; operating_margin_pct?: number; net_margin_pct?: number; eps_diluted?: number; free_cash_flow?: number }[];
type InsiderTrade = { name: string; title?: string; transaction?: string; shares?: number|null; price?: number|null; value?: number|null; date?: string };

export type FinancialAnalyticsProps = {
  ticker: string;
  companyName: string;
  facts: Record<string, number>;
  history: Record<string, Record<string, number>>;
  quarterly: Record<string, number>;
  quarterlyPeriod: string;
  kmHistory?: KmHistory;
  growthHistory?: GrowthHistory;
  earningsSurprises?: EarningsSurprise;
  peers?: PeerComp;
  sector?: string;
  segments?: SegmentData;
  geoSegments?: SegmentData;
  segmentHistory?: SegmentHistory;
  geoSegmentHistory?: SegmentHistory;
  analystEstimates?: AnalystEstimates;
  fmpRating?: string;
  quarterlyTrends?: QuarterlyTrend;
  earningsTranscript?: string;
  insiderTrading?: InsiderTrade[];
  analystRec?: { strong_buy: number; buy: number; hold: number; sell: number; strong_sell: number; total: number; date?: string };
};

// ── Design tokens ─────────────────────────────────────────────────────────────

const BLUE    = "#3b82f6";
const TEAL    = "#14b8a6";
const GREEN   = "#10b981";
const AMBER   = "#f59e0b";
const RED     = "#ef4444";
const PURPLE  = "#a78bfa";
const ORANGE  = "#f97316";
const PINK    = "#ec4899";
const DARK_BG     = "#071428";
const CARD_BG     = "#0c1b38";
const DARK_BORDER = "#1e3560";
const PALETTE = [BLUE, TEAL, GREEN, AMBER, PURPLE, ORANGE, PINK, RED];

// ── Utility ───────────────────────────────────────────────────────────────────

function abbr(n: number, prefix = ""): string {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n); const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${prefix}${(abs/1e12).toFixed(1)}T`;
  if (abs >= 1e9)  return `${sign}${prefix}${(abs/1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `${sign}${prefix}${(abs/1e6).toFixed(1)}M`;
  if (abs >= 1e3)  return `${sign}${prefix}${(abs/1e3).toFixed(0)}K`;
  return `${sign}${prefix}${abs.toFixed(1)}`;
}

function yearsFrom(h: Record<string, number>): string[] {
  return Object.keys(h || {}).sort().slice(-7);
}

// ── SVG Chart Primitives ──────────────────────────────────────────────────────

const PAD = { t: 22, r: 10, b: 30, l: 48 };

function gridLines(minV: number, maxV: number, toY: (v:number)=>number, W: number, n=4) {
  return Array.from({length: n+1}, (_,i) => {
    const v = minV + (maxV - minV) * i / n;
    const y = toY(v);
    return (
      <g key={i}>
        <line x1={PAD.l} x2={W-PAD.r} y1={y} y2={y} stroke={DARK_BORDER} strokeWidth="0.5" />
        <text x={PAD.l-3} y={y+3} textAnchor="end" fontSize="7" fill="#ffffff35">{abbr(v)}</text>
      </g>
    );
  });
}

function xLabels(labels: string[], toX: (i:number)=>number, H: number) {
  return labels.map((l,i) => (
    <text key={i} x={toX(i)} y={H-PAD.b+11} textAnchor="middle" fontSize="7" fill="#ffffff45">
      {l.length > 7 ? l.slice(2,7) : l}
    </text>
  ));
}

// Single-series bar chart
function BarChart({ data, color=BLUE, pct=false, showGrowth=false, H=160 }:{
  data:{label:string;value:number;highlight?:boolean}[];
  color?:string; pct?:boolean; showGrowth?:boolean; H?:number;
}) {
  const W=320;
  if (!data.length) return <NoData W={W} H={H}/>;
  const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;
  const vals=data.map(d=>d.value);
  const minV=Math.min(0,...vals), maxV=Math.max(...vals,0.001);
  const range=maxV-minV||1;
  const toY=(v:number)=>PAD.t+ch-((v-minV)/range)*ch;
  const zY=toY(0);
  const step=cw/data.length, bw=Math.max(8,step*0.62);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      {gridLines(minV,maxV,toY,W)}
      <line x1={PAD.l} x2={W-PAD.r} y1={zY} y2={zY} stroke="#ffffff25" strokeWidth="0.8"/>
      {data.map((d,i)=>{
        const bx=PAD.l+i*step+(step-bw)/2;
        const by=d.value>=0?toY(d.value):zY;
        const bh=Math.max(1,Math.abs(toY(d.value)-zY));
        const fc=d.highlight?"#60a5fa":d.value<0?RED:color;
        const prev=i>0?data[i-1].value:null;
        const g=prev!=null&&prev!==0?((d.value-prev)/Math.abs(prev)*100):null;
        return (
          <g key={i}>
            <rect x={bx} y={by} width={bw} height={bh} fill={fc} rx="1.5" opacity="0.88"/>
            {showGrowth&&g!=null&&(
              <text x={bx+bw/2} y={by-3} textAnchor="middle" fontSize="6.5" fill={g>=0?GREEN:RED} fontWeight="700">
                {g>=0?"▲":"▼"}{Math.abs(g).toFixed(0)}%
              </text>
            )}
            <text x={bx+bw/2} y={H-PAD.b+11} textAnchor="middle" fontSize="7" fill="#ffffff45">
              {d.label.length>7?d.label.slice(2,7):d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Multi-series line chart
function LineChart({ series, labels, pct=false, H=160 }:{
  series:{name:string;values:(number|null)[];color:string}[];
  labels:string[]; pct?:boolean; H?:number;
}) {
  const W=320;
  if (!series.length||!labels.length) return <NoData W={W} H={H}/>;
  const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;
  const all=series.flatMap(s=>s.values.filter((v):v is number=>v!=null));
  if (!all.length) return <NoData W={W} H={H}/>;
  const rawMin=Math.min(...all), rawMax=Math.max(...all);
  const pad5=(rawMax-rawMin)*0.08;
  const minV=rawMin-pad5, maxV=rawMax+pad5;
  const range=maxV-minV||1;
  const toY=(v:number)=>PAD.t+ch-((v-minV)/range)*ch;
  const toX=(i:number)=>PAD.l+(i/Math.max(labels.length-1,1))*cw;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      {gridLines(minV,maxV,toY,W)}
      {series.map(s=>{
        const segs:string[][]=[];let cur:string[]=[];
        labels.forEach((_,i)=>{const v=s.values[i];if(v!=null)cur.push(`${toX(i)},${toY(v)}`);else if(cur.length){segs.push(cur);cur=[];}});
        if(cur.length)segs.push(cur);
        return (
          <g key={s.name}>
            {segs.map((seg,si)=><polyline key={si} points={seg.join(" ")} fill="none" stroke={s.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>)}
            {labels.map((_,i)=>s.values[i]!=null?<circle key={i} cx={toX(i)} cy={toY(s.values[i]!)} r="2.5" fill={s.color}/>:null)}
          </g>
        );
      })}
      {xLabels(labels,toX,H)}
      {series.length>1&&(
        <g>{series.map((s,i)=>(
          <g key={s.name} transform={`translate(${PAD.l+i*78},${H-8})`}>
            <rect x="0" y="-4" width="8" height="3" fill={s.color} rx="1"/>
            <text x="10" y="0" fontSize="6.5" fill="#ffffff55">{s.name}</text>
          </g>
        ))}</g>
      )}
    </svg>
  );
}

// Grouped bar chart
function GroupedBar({ groups, series, pct=false, H=160 }:{
  groups:string[];
  series:{name:string;values:number[];color:string}[];
  pct?:boolean; H?:number;
}) {
  const W=320;
  if (!groups.length||!series.length) return <NoData W={W} H={H}/>;
  const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;
  const all=series.flatMap(s=>s.values);
  const minV=Math.min(0,...all), maxV=Math.max(...all,0.001);
  const range=maxV-minV||1;
  const toY=(v:number)=>PAD.t+ch-((v-minV)/range)*ch;
  const zY=toY(0);
  const gW=cw/groups.length;
  const bw=Math.max(5,(gW*0.8)/series.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      {gridLines(minV,maxV,toY,W)}
      <line x1={PAD.l} x2={W-PAD.r} y1={zY} y2={zY} stroke="#ffffff25" strokeWidth="0.8"/>
      {groups.map((g,gi)=>{
        const gx=PAD.l+gi*gW+gW*0.1;
        return (
          <g key={gi}>
            {series.map((s,si)=>{
              const v=s.values[gi]??0;
              const bx=gx+si*bw;
              const by=v>=0?toY(v):zY;
              const bh=Math.max(1,Math.abs(toY(v)-zY));
              return <rect key={si} x={bx} y={by} width={bw-1} height={bh} fill={s.color} rx="1" opacity="0.85"/>;
            })}
            <text x={PAD.l+gi*gW+gW/2} y={H-PAD.b+11} textAnchor="middle" fontSize="7" fill="#ffffff45">
              {g.length>7?g.slice(2,7):g}
            </text>
          </g>
        );
      })}
      {series.map((s,i)=>(
        <g key={s.name} transform={`translate(${PAD.l+i*78},${H-8})`}>
          <rect x="0" y="-4" width="8" height="3" fill={s.color} rx="1"/>
          <text x="10" y="0" fontSize="6.5" fill="#ffffff55">{s.name}</text>
        </g>
      ))}
    </svg>
  );
}

// Stacked bar chart
function StackedBar({ labels, series, H=160 }:{
  labels:string[];
  series:{name:string;values:number[];color:string}[];
  H?:number;
}) {
  const W=320;
  if (!labels.length||!series.length) return <NoData W={W} H={H}/>;
  const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;
  const totals=labels.map((_,i)=>series.reduce((s,r)=>s+(r.values[i]??0),0));
  const maxV=Math.max(...totals,0.001);
  const toY=(v:number)=>PAD.t+ch-(v/maxV)*ch;
  const step=cw/labels.length, bw=Math.max(10,step*0.65);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      {[0,.25,.5,.75,1].map((f,i)=>{
        const gv=maxV*f; const gy=toY(gv);
        return <g key={i}><line x1={PAD.l} x2={W-PAD.r} y1={gy} y2={gy} stroke={DARK_BORDER} strokeWidth="0.5"/><text x={PAD.l-3} y={gy+3} textAnchor="end" fontSize="7" fill="#ffffff35">{abbr(gv)}</text></g>;
      })}
      {labels.map((lbl,li)=>{
        const bx=PAD.l+li*step+(step-bw)/2;
        let cumY=PAD.t+ch;
        return (
          <g key={li}>
            {series.map((s,si)=>{const v=s.values[li]??0;const bh=Math.max(0,(v/maxV)*ch);cumY-=bh;return <rect key={si} x={bx} y={cumY} width={bw} height={bh} fill={s.color} opacity="0.85"/>;}) }
            <text x={bx+bw/2} y={H-PAD.b+11} textAnchor="middle" fontSize="7" fill="#ffffff45">{lbl.length>7?lbl.slice(2,7):lbl}</text>
          </g>
        );
      })}
      {series.map((s,i)=>(
        <g key={s.name} transform={`translate(${PAD.l+i*76},${H-8})`}>
          <rect x="0" y="-4" width="8" height="3" fill={s.color} rx="1"/>
          <text x="10" y="0" fontSize="6.5" fill="#ffffff55">{s.name}</text>
        </g>
      ))}
    </svg>
  );
}

// Horizontal bar (peer comparison)
function HBar({ data, suffix="x", color=BLUE }:{
  data:{label:string;value:number;highlight?:boolean;sub?:string}[];
  suffix?:string; color?:string;
}) {
  const W=320; const H=Math.max(90,data.length*26+20);
  const cw=W-58-64; const step=Math.max(20,(H-28)/data.length);
  const bh=Math.min(13,step-4);
  const maxV=Math.max(...data.map(d=>d.value),0.001);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      {data.map((d,i)=>{
        const y=14+i*step+(step-bh)/2;
        const bw=Math.max(2,(d.value/maxV)*cw);
        const fc=d.highlight?"#60a5fa":color;
        return (
          <g key={i}>
            <text x={55} y={y+bh/2+3} textAnchor="end" fontSize="7.5" fill={d.highlight?"#93c5fd":"#ffffff70"} fontWeight={d.highlight?"700":"400"}>{d.label}</text>
            <rect x={58} y={y} width={Math.max(2,bw)} height={bh} fill={fc} rx="2" opacity="0.85"/>
            <text x={58+bw+3} y={y+bh/2+3} fontSize="7.5" fill={fc} fontWeight="600">{d.value.toFixed(1)}{suffix}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Beat/Miss dot-and-stick
function BeatMiss({ data }:{ data: EarningsSurprise }) {
  const W=320; const H=150;
  const recent=data.slice(0,8).reverse();
  if (!recent.length) return <NoData W={W} H={H}/>;
  const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;
  const surps=recent.map(d=>d.surprise_pct??0);
  const maxS=Math.max(Math.max(...surps.map(Math.abs)),3);
  const toY=(v:number)=>PAD.t+ch/2-(v/maxS)*(ch/2);
  const step=cw/Math.max(recent.length-1,1);
  const toX=(i:number)=>PAD.l+i*step;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      <line x1={PAD.l} x2={W-PAD.r} y1={PAD.t+ch/2} y2={PAD.t+ch/2} stroke="#ffffff25" strokeWidth="0.8"/>
      {[-maxS/2,maxS/2].map((gv,i)=>{const gy=toY(gv);return(<g key={i}><line x1={PAD.l} x2={W-PAD.r} y1={gy} y2={gy} stroke={DARK_BORDER} strokeWidth="0.4" strokeDasharray="2,2"/><text x={PAD.l-3} y={gy+3} textAnchor="end" fontSize="7" fill="#ffffff35">{gv>0?"+":""}{gv.toFixed(0)}%</text></g>);})}
      {recent.map((d,i)=>{
        const s=d.surprise_pct??0;
        const x=toX(i); const y0=PAD.t+ch/2; const y1=toY(s);
        const c=s>=0?GREEN:RED;
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={Math.min(y0,y1)} y2={Math.max(y0,y1)} stroke={c} strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx={x} cy={y1} r="3.5" fill={c}/>
            <text x={x} y={s>=0?y1-5:y1+11} textAnchor="middle" fontSize="6.5" fill={c} fontWeight="700">{s>=0?"+":""}{s.toFixed(1)}%</text>
            <text x={x} y={H-PAD.b+11} textAnchor="middle" fontSize="6.5" fill="#ffffff40">{d.date?.slice(5,7)+"/"+d.date?.slice(2,4)}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Scatter plot
function Scatter({ points, xLabel="", yLabel="", H=160 }:{
  points:{label:string;x:number;y:number;highlight?:boolean}[];
  xLabel?:string; yLabel?:string; H?:number;
}) {
  const W=320;
  if (!points.length) return <NoData W={W} H={H}/>;
  const cw=W-PAD.l-PAD.r-4, ch=H-PAD.t-PAD.b;
  const xs=points.map(p=>p.x), ys=points.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const toX=(v:number)=>PAD.l+((v-minX)/(maxX-minX||1))*cw;
  const toY=(v:number)=>PAD.t+ch-((v-minY)/(maxY-minY||1))*ch;
  // Linear regression
  const n=points.length;
  const mx=xs.reduce((a,b)=>a+b,0)/n, my=ys.reduce((a,b)=>a+b,0)/n;
  const num=points.reduce((a,p)=>a+(p.x-mx)*(p.y-my),0);
  const den=points.reduce((a,p)=>a+(p.x-mx)**2,0);
  const slope=den!==0?num/den:0;
  const intercept=my-slope*mx;
  const x1r=minX, y1r=slope*x1r+intercept;
  const x2r=maxX, y2r=slope*x2r+intercept;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t+ch} stroke={DARK_BORDER} strokeWidth="0.8"/>
      <line x1={PAD.l} x2={W-PAD.r} y1={PAD.t+ch} y2={PAD.t+ch} stroke={DARK_BORDER} strokeWidth="0.8"/>
      {[0.25,0.5,0.75].map(f=>(
        <g key={f}>
          <line x1={PAD.l} x2={W-PAD.r} y1={PAD.t+ch*f} y2={PAD.t+ch*f} stroke={DARK_BORDER} strokeWidth="0.3" strokeDasharray="2,2"/>
          <line x1={PAD.l+cw*f} x2={PAD.l+cw*f} y1={PAD.t} y2={PAD.t+ch} stroke={DARK_BORDER} strokeWidth="0.3" strokeDasharray="2,2"/>
        </g>
      ))}
      {/* Regression line */}
      <line x1={toX(x1r)} y1={toY(y1r)} x2={toX(x2r)} y2={toY(y2r)} stroke="#3b82f640" strokeWidth="1.2" strokeDasharray="3,2"/>
      {points.map((p,i)=>(
        <g key={i}>
          <circle cx={toX(p.x)} cy={toY(p.y)} r={p.highlight?5:3.5} fill={p.highlight?"#60a5fa":PALETTE[i%PALETTE.length]} opacity="0.9"/>
          <text x={toX(p.x)} y={toY(p.y)-6} textAnchor="middle" fontSize="6.5" fill={p.highlight?"#93c5fd":"#ffffff60"}>{p.label}</text>
        </g>
      ))}
      {xLabel&&<text x={PAD.l+cw/2} y={H-2} textAnchor="middle" fontSize="7" fill="#ffffff35">{xLabel}</text>}
      {yLabel&&<text x={6} y={PAD.t+ch/2} textAnchor="middle" fontSize="7" fill="#ffffff35" transform={`rotate(-90,6,${PAD.t+ch/2})`}>{yLabel}</text>}
    </svg>
  );
}

// Monte Carlo distribution histogram
function MonteCarloChart({ simulations, current, H=160 }:{ simulations:number[]; current:number; H?:number }) {
  const W=320;
  if (!simulations.length) return <NoData W={W} H={H}/>;
  const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;
  const sorted=[...simulations].sort((a,b)=>a-b);
  const minV=sorted[0], maxV=sorted[sorted.length-1];
  const BINS=30;
  const binW=(maxV-minV)/BINS||1;
  const bins=Array.from({length:BINS},(_,i)=>{
    const lo=minV+i*binW, hi=lo+binW;
    return simulations.filter(v=>v>=lo&&v<hi).length;
  });
  const maxBin=Math.max(...bins,1);
  const toX=(v:number)=>PAD.l+((v-minV)/(maxV-minV||1))*cw;
  const bw=cw/BINS;
  const p5=sorted[Math.floor(sorted.length*0.05)];
  const p95=sorted[Math.floor(sorted.length*0.95)];
  const median=sorted[Math.floor(sorted.length*0.5)];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      {/* Confidence band */}
      <rect x={toX(p5)} y={PAD.t} width={toX(p95)-toX(p5)} height={ch} fill="#3b82f610"/>
      {/* Bars */}
      {bins.map((cnt,i)=>{
        const x=PAD.l+i*bw;
        const bh=(cnt/maxBin)*ch;
        const v=minV+i*binW;
        const isAbove=v>=current;
        return <rect key={i} x={x} y={PAD.t+ch-bh} width={Math.max(1,bw-0.5)} height={bh} fill={isAbove?GREEN:RED} opacity="0.7"/>;
      })}
      {/* Current price line */}
      <line x1={toX(current)} x2={toX(current)} y1={PAD.t} y2={PAD.t+ch} stroke={AMBER} strokeWidth="1.5" strokeDasharray="3,2"/>
      <text x={toX(current)} y={PAD.t-3} textAnchor="middle" fontSize="6.5" fill={AMBER} fontWeight="700">NOW</text>
      {/* Median */}
      <line x1={toX(median)} x2={toX(median)} y1={PAD.t} y2={PAD.t+ch} stroke={BLUE} strokeWidth="1" strokeDasharray="2,2"/>
      {/* Labels */}
      <text x={toX(p5)} y={H-PAD.b+11} textAnchor="middle" fontSize="6.5" fill={RED}>P5</text>
      <text x={toX(p95)} y={H-PAD.b+11} textAnchor="middle" fontSize="6.5" fill={GREEN}>P95</text>
      <text x={toX(median)} y={H-PAD.b+11} textAnchor="middle" fontSize="6.5" fill={BLUE}>Med</text>
      <text x={PAD.l} y={H-PAD.b+11} textAnchor="start" fontSize="6.5" fill="#ffffff35">{abbr(minV,"$")}</text>
      <text x={W-PAD.r} y={H-PAD.b+11} textAnchor="end" fontSize="6.5" fill="#ffffff35">{abbr(maxV,"$")}</text>
    </svg>
  );
}

// Waterfall
function Waterfall({ items, H=160 }:{ items:{label:string;value:number;total?:boolean}[]; H?:number }) {
  const W=320;
  if (!items.length) return <NoData W={W} H={H}/>;
  const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;
  let running=0;
  const bars=items.map(item=>{
    if(item.total){const b={label:item.label,start:0,end:running+item.value,total:true};running+=item.value;return b;}
    const start=running; running+=item.value;
    return{label:item.label,start,end:running,total:false};
  });
  const allV=bars.flatMap(b=>[b.start,b.end]);
  const minV=Math.min(0,...allV),maxV=Math.max(...allV,0.001),range=maxV-minV||1;
  const toY=(v:number)=>PAD.t+ch-((v-minV)/range)*ch;
  const step=cw/bars.length,bw=Math.max(10,step*0.65);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      {[0,.25,.5,.75,1].map((f,i)=>{const gv=minV+range*f;const gy=toY(gv);return<g key={i}><line x1={PAD.l} x2={W-PAD.r} y1={gy} y2={gy} stroke={DARK_BORDER} strokeWidth="0.5"/><text x={PAD.l-3} y={gy+3} textAnchor="end" fontSize="7" fill="#ffffff35">{abbr(gv,"$")}</text></g>;})}
      {bars.map((b,i)=>{
        const bx=PAD.l+i*step+(step-bw)/2;
        const diff=b.end-b.start;
        const by=toY(Math.max(b.start,b.end));
        const bh=Math.max(1,Math.abs(toY(b.start)-toY(b.end)));
        const fc=b.total?BLUE:diff>=0?GREEN:RED;
        return (
          <g key={i}>
            <rect x={bx} y={by} width={bw} height={bh} fill={fc} rx="1.5" opacity="0.88"/>
            <text x={bx+bw/2} y={by-2} textAnchor="middle" fontSize="6" fill={fc} fontWeight="700">{diff>=0?"+":""}{abbr(diff,"$")}</text>
            <text x={bx+bw/2} y={H-PAD.b+11} textAnchor="middle" fontSize="6.5" fill="#ffffff40">{b.label}</text>
            {i<bars.length-1&&!b.total&&<line x1={bx+bw} x2={PAD.l+(i+1)*step+(step-bw)/2} y1={toY(b.end)} y2={toY(b.end)} stroke="#ffffff15" strokeWidth="0.5" strokeDasharray="2,2"/>}
          </g>
        );
      })}
    </svg>
  );
}

// Area chart (shaded line)
function AreaChart({ values, labels, color=BLUE, H=160 }:{
  values:(number|null)[];labels:string[];color?:string;H?:number;
}) {
  const W=320;
  const validVals=values.filter((v):v is number=>v!=null);
  if (!validVals.length) return <NoData W={W} H={H}/>;
  const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;
  const minV=Math.min(0,...validVals),maxV=Math.max(...validVals,0.001);
  const range=maxV-minV||1;
  const toY=(v:number)=>PAD.t+ch-((v-minV)/range)*ch;
  const toX=(i:number)=>PAD.l+(i/Math.max(labels.length-1,1))*cw;
  const pts=labels.map((_,i)=>values[i]!=null?`${toX(i)},${toY(values[i]!)}`:null).filter(Boolean) as string[];
  if (!pts.length) return <NoData W={W} H={H}/>;
  const first=pts[0].split(","); const last=pts[pts.length-1].split(",");
  const area=`${pts.join(" ")} ${last[0]},${PAD.t+ch} ${first[0]},${PAD.t+ch}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      {gridLines(minV,maxV,toY,W)}
      <polygon points={area} fill={color} opacity="0.12"/>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      {values.map((v,i)=>v!=null?<circle key={i} cx={toX(i)} cy={toY(v)} r="2.5" fill={color}/>:null)}
      {xLabels(labels,toX,H)}
    </svg>
  );
}

function NoData({ W=320, H=140 }:{ W?:number; H?:number }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      <text x={W/2} y={H/2} textAnchor="middle" fontSize="10" fill="#ffffff18">Insufficient data</text>
    </svg>
  );
}

// ── LOOP 14: Historical Multiple Range Band ───────────────────────────────────

function MultipleRangeBand({ values, current, unit="x", color=BLUE }:{
  values:(number|null)[]; current:number|null; unit?:string; color?:string;
}) {
  const W=300, H=68, pl=8, pr=8, pt=22, pb=14, cw=W-pl-pr;
  const valid=values.filter((v):v is number=>v!=null&&v>0);
  if(valid.length<2||current==null) return <text x={W/2} y={H/2} textAnchor="middle" fontSize="9" fill="#ffffff18">No history</text>;
  const minV=Math.min(...valid)*0.9, maxV=Math.max(...valid)*1.1, rng=maxV-minV||1;
  const toX=(v:number)=>pl+Math.max(0,Math.min(cw,((v-minV)/rng)*cw));
  const sorted=[...valid].sort((a,b)=>a-b);
  const p25=sorted[Math.floor(sorted.length*0.25)]??sorted[0];
  const p75=sorted[Math.floor(sorted.length*0.75)]??sorted[sorted.length-1];
  const avg=valid.reduce((a,b)=>a+b,0)/valid.length;
  const pct=((current-sorted[0])/(sorted[sorted.length-1]-sorted[0]||1))*100;
  const xc=toX(current);
  const isHigh=current>avg;
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      <rect x={toX(sorted[0])} y={pt+2} width={Math.max(0,toX(sorted[sorted.length-1])-toX(sorted[0]))} height={12} fill={`${color}18`} rx={2}/>
      <rect x={toX(p25)} y={pt} width={Math.max(1,toX(p75)-toX(p25))} height={16} fill={`${color}2a`} rx={3}/>
      <line x1={toX(avg)} x2={toX(avg)} y1={pt-2} y2={pt+20} stroke={color} strokeWidth="1.2" strokeDasharray="2,2"/>
      <text x={toX(avg)} y={pt-4} textAnchor="middle" fontSize="6" fill={color} opacity="0.65">{avg.toFixed(1)}{unit}</text>
      <line x1={xc} x2={xc} y1={pt-5} y2={pt+22} stroke={AMBER} strokeWidth="2"/>
      <circle cx={xc} cy={pt+8} r={5} fill={AMBER}/>
      <text x={xc} y={pt-7} textAnchor="middle" fontSize="7.5" fill={AMBER} fontWeight="700">{current.toFixed(1)}{unit}</text>
      <text x={toX(sorted[0])} y={H-pb+8} textAnchor="middle" fontSize="5.5" fill="#ffffff20">{sorted[0].toFixed(1)}</text>
      <text x={toX(sorted[sorted.length-1])} y={H-pb+8} textAnchor="middle" fontSize="5.5" fill="#ffffff20">{sorted[sorted.length-1].toFixed(1)}</text>
      <text x={W/2} y={H-1} textAnchor="middle" fontSize="6.5" fill={isHigh?`${RED}bb`:`${GREEN}bb`}>
        {Math.round(pct)}th pct · {isHigh?"+":`-`}{Math.abs(((current-avg)/avg)*100).toFixed(0)}% vs {valid.length}Y avg {avg.toFixed(1)}{unit}
      </text>
    </svg>
  );
}

// ── LOOP 14: Quarterly Earnings Heat Table ─────────────────────────────────────

type QTRow = { key:"revenue"|"gross_margin_pct"|"operating_margin_pct"|"net_margin_pct"|"eps_diluted"|"free_cash_flow"; label:string; fmt:(v:number)=>string };

function QuarterlyHeatTable({ data }:{ data:QuarterlyTrend }) {
  if(data.length<4) return null;
  const sorted=[...data].sort((a,b)=>a.date.localeCompare(b.date)).slice(-8);
  const ROWS:QTRow[]=[
    {key:"revenue",           label:"Revenue",      fmt:v=>abbr(v,"$")},
    {key:"gross_margin_pct",  label:"Gross Mgn",    fmt:v=>`${v.toFixed(1)}%`},
    {key:"operating_margin_pct",label:"Op Mgn",     fmt:v=>`${v.toFixed(1)}%`},
    {key:"net_margin_pct",    label:"Net Mgn",      fmt:v=>`${v.toFixed(1)}%`},
    {key:"eps_diluted",       label:"EPS",          fmt:v=>`$${v.toFixed(2)}`},
    {key:"free_cash_flow",    label:"FCF",          fmt:v=>abbr(v,"$")},
  ];
  return(
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{fontSize:8}}>
        <thead>
          <tr style={{borderBottom:`1px solid ${DARK_BORDER}`}}>
            <th className="px-2 py-1.5 text-left font-bold" style={{color:"#ffffff25",fontSize:7,minWidth:70}}>METRIC</th>
            {sorted.map((q,i)=>(
              <th key={i} className="px-2 py-1.5 text-center font-bold" style={{color:i===sorted.length-1?AMBER:"#ffffff30",fontSize:7,minWidth:58,borderLeft:`1px solid ${DARK_BORDER}`,background:i===sorted.length-1?"rgba(245,158,11,0.06)":"transparent"}}>
                {q.date?.slice(0,7)??""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(row=>{
            return(
              <tr key={row.key} style={{borderTop:`1px solid ${DARK_BORDER}`}}>
                <td className="px-2 py-1.5 font-bold" style={{color:"#ffffff35",fontSize:7.5}}>{row.label}</td>
                {sorted.map((q,i)=>{
                  const val=q[row.key] as number|undefined;
                  const prev=i>0?sorted[i-1][row.key] as number|undefined:undefined;
                  const chg=val!=null&&prev!=null&&Math.abs(prev)>0?(val-prev)/Math.abs(prev)*100:null;
                  const isLast=i===sorted.length-1;
                  const bgAlpha=chg!=null?Math.min(Math.abs(chg)*0.008,0.22):0;
                  const bg=chg!=null?(chg>0?`rgba(16,185,129,${bgAlpha})`:`rgba(239,68,68,${bgAlpha})`):"transparent";
                  return(
                    <td key={i} className="px-2 py-1.5 text-center" style={{background:isLast?"rgba(245,158,11,0.05)":bg,borderLeft:`1px solid ${DARK_BORDER}`,outline:isLast?`1px solid rgba(245,158,11,0.18)`:undefined}}>
                      {val!=null?(
                        <div>
                          <div className="font-bold tabular-nums" style={{color:isLast?AMBER:"#ffffff65",fontSize:8}}>{row.fmt(val)}</div>
                          {chg!=null&&<div style={{color:chg>0?GREEN:RED,fontSize:6}}>{chg>0?"▲":"▼"}{Math.abs(chg).toFixed(1)}%</div>}
                        </div>
                      ):<span style={{color:"#ffffff15",fontSize:8}}>—</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── LOOP 15: Transcript Intelligence Parser ───────────────────────────────────

function parseTranscript(text:string):{guidance:string[];questions:string[];keyNumbers:string[];totalLength:number;hasQA:boolean;sentiment:{bulls:number;bears:number;score:number;topBull:string;topBear:string}}|null {
  if(!text||text.length<500) return null;
  const upper=text.toUpperCase();
  // Find Q&A section start (handles both FMP "Operator: we will now begin..." and formatted Q: markers)
  const markers=["QUESTIONS AND ANSWERS","QUESTION AND ANSWER","Q&A SESSION","\nQ:","QUESTION:","\nQUESTION ","WE WILL NOW BEGIN THE QUESTION","NOW OPEN THE LINE","NOW TAKE QUESTIONS"];
  let qaStart=-1;
  for(const m of markers){const idx=upper.indexOf(m);if(idx>300&&(qaStart<0||idx<qaStart))qaStart=idx;}
  const mgmt=qaStart>0?text.slice(0,qaStart):text.slice(0,8000);
  const qa=qaStart>0?text.slice(qaStart,qaStart+10000):"";
  const GUIDE=/\b(expect(?:s|ed|ing)?|guid(?:e|ance|ing)|target(?:s|ed)?|anticip(?:ate|ates|ating)|project(?:s|ed|ing)?|forecast|outlook|full.?year|fy\s*2[0-9]|next quarter|next year|on track|reaffirm|rais(?:e|ed|ing)|lower(?:ed|ing)? guid)/i;
  const allText=mgmt+(qa.length>0?" "+qa:"");
  const sents=allText.split(/(?<=[.!?])\s+(?=[A-Z"])/).filter(s=>s.length>50&&s.length<450);
  const guidance=sents.filter(s=>GUIDE.test(s)).map(s=>s.trim()).slice(0,5);
  // Extract analyst questions from Q&A section
  // FMP format: "Analyst Name - Firm Name\n\nQuestion text" or "Q: text" or speaker lines ending in colon
  const questions:string[]=[];
  if(qa.length>100){
    const qaLines=qa.split('\n').map(l=>l.trim()).filter(Boolean);
    let curQ="",isInQuestion=false;
    // Detect analyst lines: "Name - Firm" pattern or lines matching known analyst firm names
    const isAnalystLine=(l:string)=>{
      if(/^q\s*[:\.]/i.test(l)) return true;
      // FMP: "First Last - Firm Name" on its own line (short line, ends with common firm indicators)
      if(l.length<80&&/-\s+\w/.test(l)&&!/^operator|^ceo|^cfo|^president|^chief/i.test(l)) return true;
      return false;
    };
    const isMgmtLine=(l:string)=>/^a\s*[:\.]/i.test(l)||/^operator\s*:/i.test(l)||/^[A-Z][a-z]+ [A-Z][a-z]+ -- /i.test(l);
    for(let i=0;i<qaLines.length&&questions.length<5;i++){
      const l=qaLines[i];
      if(isAnalystLine(l)){
        if(curQ.length>30)questions.push(curQ.slice(0,220).trim());
        curQ=l.replace(/^q\s*[:.]\s*/i,'').replace(/^.*?-\s+\w[^-]+\s*$/,'');
        isInQuestion=true;
      } else if(isMgmtLine(l)&&isInQuestion){
        if(curQ.length>30){questions.push(curQ.slice(0,220).trim());curQ="";isInQuestion=false;}
      } else if(isInQuestion&&l.length>10){
        curQ+=" "+l;
      }
    }
    if(curQ.length>30&&questions.length<5)questions.push(curQ.slice(0,220).trim());
  }
  const numRe=/\$[\d,.]+\s*(?:billion|million|trillion|B|M|T)?\b|\b\d+(?:\.\d+)?%/gi;
  const keyNumbers=[...new Set(text.match(numRe)??[])].slice(0,12);
  // Sentiment keyword analysis
  const BULL_KW=[
    ["accelerat",4],["expand",3],["opportunity",3],["outperform",4],["strong demand",5],
    ["record",3],["growth",2],["confident",3],["favorable",2],["momentum",3],
    ["improve",2],["ahead of",3],["exceed",3],["rais.*guid",4],["beat",2],
  ] as [string,number][];
  const BEAR_KW=[
    ["headwind",5],["challeng",4],["pressure",3],["uncertain",4],["decline",3],
    ["below expect",5],["disapp",4],["concern",3],["difficult",3],["softness",4],
    ["slower",3],["compet.*intens",4],["miss",3],["lower.*guid",5],["macro",2],
  ] as [string,number][];
  const lc=text.toLowerCase();
  const countKw=(kws:[string,number][])=>{let score=0;const hits:string[]=[];for(const[pat,w]of kws){const re=new RegExp(pat,"gi");const m=lc.match(re);if(m){score+=m.length*w;if(hits.length<3)hits.push(pat.replace(/\.\*/g," ").replace(/\*/g,""));}};return{score,hits};};
  const bullResult=countKw(BULL_KW), bearResult=countKw(BEAR_KW);
  const sentimentScore=Math.round(Math.min(100,Math.max(0,50+(bullResult.score-bearResult.score)/Math.max(bullResult.score+bearResult.score,1)*60)));
  return{guidance,questions:questions.slice(0,4),keyNumbers,totalLength:text.length,hasQA:qa.length>100,
    sentiment:{bulls:bullResult.score,bears:bearResult.score,score:sentimentScore,topBull:bullResult.hits[0]??"",topBear:bearResult.hits[0]??""}};
}

// Donut / pie chart
function DonutChart({ data, H=180 }:{ data:{label:string;value:number}[]; H?:number }) {
  const W=320;
  const sorted=[...data].sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).slice(0,8);
  if (!sorted.length) return <NoData W={W} H={H}/>;
  const total=sorted.reduce((s,d)=>s+Math.abs(d.value),0);
  if (!total) return <NoData W={W} H={H}/>;
  const cx=80, cy=H/2, outerR=58, innerR=30;
  let ang=-Math.PI/2;
  const slices=sorted.map((d,i)=>{
    const pct=Math.abs(d.value)/total;
    const end=ang+pct*2*Math.PI;
    const x1=cx+outerR*Math.cos(ang), y1=cy+outerR*Math.sin(ang);
    const x2=cx+outerR*Math.cos(end),  y2=cy+outerR*Math.sin(end);
    const ix1=cx+innerR*Math.cos(end), iy1=cy+innerR*Math.sin(end);
    const ix2=cx+innerR*Math.cos(ang), iy2=cy+innerR*Math.sin(ang);
    const large=pct>0.5?1:0;
    const path=`M${x1},${y1}A${outerR},${outerR},0,${large},1,${x2},${y2}L${ix1},${iy1}A${innerR},${innerR},0,${large},0,${ix2},${iy2}Z`;
    const mid=(ang+end)/2;
    ang=end;
    return{path,color:PALETTE[i%PALETTE.length],pct,mid,label:d.label,value:d.value};
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      {slices.map((s,i)=>(
        <path key={i} d={s.path} fill={s.color} opacity="0.88" stroke={DARK_BG} strokeWidth="0.8"/>
      ))}
      {/* Centre label */}
      <text x={cx} y={cy-3} textAnchor="middle" fontSize="8" fill="#ffffff40">TOP</text>
      <text x={cx} y={cy+7} textAnchor="middle" fontSize="8" fill="#ffffff40">{sorted.length}</text>
      {/* Legend */}
      {slices.map((s,i)=>(
        <g key={i} transform={`translate(150,${8+i*21})`}>
          <rect x="0" y="-6" width="8" height="8" fill={s.color} rx="1" opacity="0.88"/>
          <text x="11" y="0" fontSize="7" fill="#ffffff55">
            {s.label.length>22?s.label.slice(0,22)+"…":s.label}
          </text>
          <text x="11" y="10" fontSize="6.5" fill="#ffffff30">{(s.pct*100).toFixed(1)}% · {abbr(s.value,"$")}</text>
        </g>
      ))}
    </svg>
  );
}

// Horizontal gauge bar (used for Altman Z)
function GaugeBar({ value, min, max, zones, H=40 }:{
  value:number; min:number; max:number;
  zones:{from:number;to:number;color:string;label:string}[];
  H?:number;
}) {
  const W=320;
  const cw=W-PAD.l-PAD.r;
  const toX=(v:number)=>PAD.l+Math.max(0,Math.min(1,(v-min)/(max-min||1)))*cw;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      {zones.map((z,i)=>{
        const x1=toX(Math.max(z.from,min)), x2=toX(Math.min(z.to,max));
        return(
          <g key={i}>
            <rect x={x1} y={10} width={Math.max(0,x2-x1)} height={12} fill={z.color} opacity="0.3" rx="1"/>
            <text x={(x1+x2)/2} y={30} textAnchor="middle" fontSize="6.5" fill={z.color} fontWeight="600">{z.label}</text>
          </g>
        );
      })}
      {/* Needle */}
      <line x1={toX(value)} x2={toX(value)} y1={6} y2={26} stroke={AMBER} strokeWidth="2" strokeLinecap="round"/>
      <circle cx={toX(value)} cy={16} r="4" fill={AMBER}/>
      <text x={toX(value)} y={4} textAnchor="middle" fontSize="7.5" fill={AMBER} fontWeight="700">{value.toFixed(2)}</text>
    </svg>
  );
}

// 5-axis radar / spider chart — institutional quant factor viz
function RadarChart({ scores, labels, H=200 }:{ scores:number[]; labels:{text:string;color:string}[]; H?:number }) {
  const W=300;
  const cx=W/2, cy=H/2-4;
  const r=Math.min(cx-52,cy-22);
  const n=scores.length;
  const angles=Array.from({length:n},(_,i)=>-Math.PI/2+(2*Math.PI*i)/n);
  const pt=(ang:number,frac:number):[number,number]=>[cx+r*frac*Math.cos(ang),cy+r*frac*Math.sin(ang)];
  const levels=[0.2,0.4,0.6,0.8,1.0];
  const dataPath=scores.map((s,i)=>{const[x,y]=pt(angles[i],Math.max(0.02,s/100));return`${i===0?"M":"L"}${x.toFixed(1)},${y.toFixed(1)}`;}).join(" ")+"Z";
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      {levels.map(frac=>(
        <polygon key={frac} points={angles.map(a=>pt(a,frac).join(",")).join(" ")}
          fill="none" stroke={frac===1?"rgba(255,255,255,0.12)":DARK_BORDER} strokeWidth={frac===1?"0.8":"0.4"}/>
      ))}
      {levels.filter((_,i)=>i===1||i===3).map((frac,fi)=>(
        <text key={fi} x={cx+2} y={pt(angles[0],frac)[1]-1} fontSize="5.5" fill="#ffffff15" textAnchor="start">{Math.round(frac*100)}</text>
      ))}
      {angles.map((a,i)=>{const[x,y]=pt(a,1);return<line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={DARK_BORDER} strokeWidth="0.5"/>;} )}
      <path d={dataPath} fill="rgba(59,130,246,0.15)" stroke={BLUE} strokeWidth="1.5" strokeLinejoin="round"/>
      {scores.map((s,i)=>{const[x,y]=pt(angles[i],Math.max(0.02,s/100));return<circle key={i} cx={x} cy={y} r="3" fill={labels[i]?.color??BLUE}/>;} )}
      {labels.map((l,i)=>{
        const[lx,ly]=pt(angles[i],1.27);
        const sc=scores[i];
        const off=i===0?-0.15:(sc<70?0.17:-0.13);
        const[sx,sy]=pt(angles[i],Math.max(0.02,sc/100)+off);
        return(
          <g key={i}>
            <text x={lx} y={ly+3} textAnchor="middle" fontSize="8.5" fill={l.color} fontWeight="700">{l.text}</text>
            <text x={sx} y={sy+2} textAnchor="middle" fontSize="7.5" fill="#ffffff45" fontWeight="600">{sc}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Football-field valuation chart — horizontal ranges for each method
function FootballFieldChart({ methods, currentPrice, H=210 }:{
  methods:{label:string;lo:number;hi:number;color:string}[];
  currentPrice:number; H?:number;
}) {
  const W=480; const LPAD=128;
  const cw=W-LPAD-14;
  if(!methods.length)return<NoData W={W} H={H}/>;
  const allVals=methods.flatMap(m=>[m.lo,m.hi]).filter(v=>v>0);
  if(!allVals.length)return<NoData W={W} H={H}/>;
  const raw0=Math.min(...allVals,currentPrice>0?currentPrice:Infinity)*0.78;
  const raw1=Math.max(...allVals,currentPrice>0?currentPrice:0)*1.22;
  const minV=Math.max(0,raw0), maxV=raw1;
  const toX=(v:number)=>LPAD+((v-minV)/(maxV-minV||1))*cw;
  const barH=13;
  const spacing=(H-52)/Math.max(methods.length,1);
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
      {Array.from({length:6},(_,i)=>{const v=minV+(maxV-minV)*i/5;const x=toX(v);return(
        <g key={i}>
          <line x1={x} x2={x} y1={20} y2={H-18} stroke={DARK_BORDER} strokeWidth="0.4"/>
          <text x={x} y={14} textAnchor="middle" fontSize="6.5" fill="#ffffff18">${v>=1e9?`${(v/1e9).toFixed(0)}B`:v>=1e6?`${(v/1e6).toFixed(0)}M`:v.toFixed(0)}</text>
        </g>
      );})}
      {methods.map((m,i)=>{
        const y=28+i*spacing;
        const x1=toX(m.lo), x2=Math.max(toX(m.lo)+4,toX(m.hi));
        return(
          <g key={i}>
            <text x={LPAD-5} y={y+barH/2+3} textAnchor="end" fontSize="7.5" fill="#ffffff45">{m.label}</text>
            <rect x={x1} y={y} width={x2-x1} height={barH} fill={m.color} opacity="0.2" rx="2"/>
            <rect x={x1} y={y} width={2.5} height={barH} fill={m.color} opacity="0.85" rx="1"/>
            <rect x={Math.max(x1+2,x2-2)} y={y} width={2.5} height={barH} fill={m.color} opacity="0.85" rx="1"/>
            <text x={x1-3} y={y+barH/2+3} textAnchor="end" fontSize="5.5" fill={m.color} opacity="0.65">${m.lo.toFixed(0)}</text>
            <text x={x2+3} y={y+barH/2+3} textAnchor="start" fontSize="5.5" fill={m.color} opacity="0.65">${m.hi.toFixed(0)}</text>
          </g>
        );
      })}
      {currentPrice>0&&(
        <g>
          <line x1={toX(currentPrice)} x2={toX(currentPrice)} y1={17} y2={H-16} stroke={AMBER} strokeWidth="1.5" strokeDasharray="3,2"/>
          <circle cx={toX(currentPrice)} cy={H-13} r="3.5" fill={AMBER}/>
          <text x={toX(currentPrice)} y={H-4} textAnchor="middle" fontSize="7" fill={AMBER} fontWeight="700">${currentPrice.toFixed(0)}</text>
          <text x={toX(currentPrice)} y={12} textAnchor="middle" fontSize="6" fill={AMBER}>NOW</text>
        </g>
      )}
    </svg>
  );
}

// ── Chart Card ────────────────────────────────────────────────────────────────

function Card({ title, sub, badge, children }:{ title:string; sub?:string; badge?:string; children:React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden border" style={{background:CARD_BG,borderColor:DARK_BORDER}}>
      <div className="px-3 py-2 border-b flex items-center justify-between" style={{borderColor:DARK_BORDER}}>
        <div>
          <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff45"}}>{title}</p>
          {sub&&<p className="text-[7.5px] mt-0.5" style={{color:"#ffffff20"}}>{sub}</p>}
        </div>
        {badge&&<span className="text-[7px] px-1.5 py-0.5 rounded font-bold" style={{background:"rgba(59,130,246,0.15)",color:"#60a5fa",border:"1px solid rgba(59,130,246,0.2)"}}>{badge}</span>}
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

// ── Metric pill ───────────────────────────────────────────────────────────────

function Pill({ label, value, color="#ffffff" }:{ label:string; value:string; color?:string }) {
  return (
    <div className="flex flex-col items-center p-2 rounded" style={{background:"rgba(255,255,255,0.04)",border:"1px solid #1e3560"}}>
      <p className="text-[7px] font-bold uppercase tracking-widest mb-0.5" style={{color:"#ffffff30"}}>{label}</p>
      <p className="text-[13px] font-bold tabular-nums" style={{color}}>{value}</p>
    </div>
  );
}

// ── Category tabs ─────────────────────────────────────────────────────────────

const CATS = [
  { id:"growth",    label:"Revenue & Growth",    icon:TrendingUp  },
  { id:"margins",   label:"Profitability",        icon:BarChart2   },
  { id:"cashflow",  label:"Cash Flow",            icon:Activity    },
  { id:"balance",   label:"Balance Sheet",        icon:Shield      },
  { id:"multiples", label:"Valuation",            icon:Zap         },
  { id:"quality",   label:"Quality & Peers",      icon:Users       },
  { id:"quant",     label:"Quant & Scenarios",    icon:Calculator  },
  { id:"signals",   label:"Signals & Scores",     icon:Sparkles    },
] as const;
type CatId = typeof CATS[number]["id"];

// ── Main Component ────────────────────────────────────────────────────────────

export default function FinancialAnalytics({
  ticker, companyName, facts, history, quarterly, quarterlyPeriod,
  kmHistory=[], growthHistory=[], earningsSurprises=[], peers=[], sector="",
  segments, geoSegments, segmentHistory=[], geoSegmentHistory=[], analystEstimates=[], fmpRating, quarterlyTrends=[],
  earningsTranscript="", insiderTrading=[], analystRec,
}:FinancialAnalyticsProps) {
  const [tab, setTab] = useState<CatId>("growth");
  const [aiText, setAiText]     = useState("");
  const [aiRunning, setAiRunning] = useState(false);
  const [scenarios, setScenarios] = useState({
    bull: { revCAGR: 20, exitMargin: 30, exitMultiple: 22, wacc: 8 },
    base: { revCAGR: 12, exitMargin: 22, exitMultiple: 16, wacc: 9 },
    bear: { revCAGR:  4, exitMargin: 15, exitMultiple: 11, wacc: 11 },
  });

  // ── Derived series ────────────────────────────────────────────────────────

  const revYears = yearsFrom(history.revenue ?? {});
  const niYears  = yearsFrom(history.net_income ?? {});
  const cfYears  = yearsFrom(history.operating_cf ?? {});
  const asYears  = yearsFrom(history.total_assets ?? {});
  const epsYears = yearsFrom(history.eps_diluted ?? {});

  const H = (key:string, yrs:string[]) => yrs.map(y=>({label:y, value:history[key]?.[y]??0}));
  const Hn = (key:string, yrs:string[]) => yrs.map(y=>history[key]?.[y]??null);

  // Margins from history
  const gMarg = revYears.map(y=>{ const r=history.revenue?.[y];const g=history.gross_profit?.[y];return r&&g?g/r*100:null;});
  const oMarg = revYears.map(y=>{ const r=history.revenue?.[y];const o=history.operating_income?.[y];return r&&o?o/r*100:null;});
  const nMarg = revYears.map(y=>{ const r=history.revenue?.[y];const n=history.net_income?.[y];return r&&n?n/r*100:null;});
  const eMarg = revYears.map(y=>{ const r=history.revenue?.[y];const e=history.ebitda?.[y];return r&&e?e/r*100:null;});

  // FCF conversion
  const fcfConv = revYears.map(y=>{ const n=history.net_income?.[y];const f=history.free_cash_flow?.[y];return n&&n>0&&f!=null?f/n*100:null;});

  // Net debt
  const netDebt = asYears.map(y=>{ const ltd=history.long_term_debt?.[y]??0;const c=history.cash?.[y]??0;return{label:y,value:ltd-c};});

  // D/E
  const deRatio = asYears.map(y=>{ const tl=history.total_liabilities?.[y];const eq=history.equity?.[y];return tl&&eq&&eq>0?tl/eq:null;});

  // Current ratio history
  const crVals = asYears.map(y=>{ const ca=history.current_assets?.[y];const cl=history.current_liabilities?.[y];return ca&&cl&&cl>0?ca/cl:null;});

  // Derived ROIC history from income+BS data (NOPAT/Invested Capital)
  const roicHist: KmHistory = useMemo(() => {
    // Prefer fetched km_history, otherwise derive from financial history
    if (kmHistory.length > 0) return kmHistory;
    return asYears.map(y => {
      const oi  = history.operating_income?.[y];
      const tax = history.income_tax?.[y];
      const pt  = history.pretax_income?.[y];
      const ta  = history.total_assets?.[y];
      const cl  = history.current_liabilities?.[y];
      const eq  = history.equity?.[y];
      const tl  = history.total_liabilities?.[y];
      const ca  = history.current_assets?.[y];
      const ni  = history.net_income?.[y];
      const ltd = history.long_term_debt?.[y];
      const cash= history.cash?.[y];

      // NOPAT = EBIT × (1 - tax rate)
      const taxRate = pt && tax ? tax/Math.abs(pt) : 0.21;
      const nopat  = oi ? oi * (1-taxRate) : null;
      // Invested Capital = Total Assets - Current Liabilities - Cash
      const ic = ta && cl && cash != null ? ta - cl - cash : null;
      const roic = nopat && ic && ic > 0 ? nopat/ic*100 : null;
      const roe  = ni && eq && eq > 0 ? ni/eq*100 : null;
      const crv  = ca && cl && cl > 0 ? ca/cl : null;
      const dev  = tl && eq && eq > 0 ? tl/eq : null;

      return {
        date: y,
        pe: (history.pe_history as Record<string,number>|undefined)?.[y] ?? null,
        ev_ebitda: (history.ev_ebitda_history as Record<string,number>|undefined)?.[y] ?? null,
        roic,
        p_fcf: null,
        current_ratio: crv,
        debt_equity: dev,
      };
    });
  }, [kmHistory, history, asYears]);

  // CapEx intensity
  const capexPct = revYears.map(y=>{ const c=history.capex?.[y];const r=history.revenue?.[y];return c&&r&&r>0?Math.abs(c)/r*100:null;});

  // SBC %
  const sbcPct = revYears.map(y=>{ const s=history.sbc_expense?.[y];const r=history.revenue?.[y];return s&&r&&r>0?s/r*100:null;});

  // Accruals ratio
  const accruals = revYears.map(y=>{ const n=history.net_income?.[y];const o=history.operating_cf?.[y];const ta=history.total_assets?.[y];return n!=null&&o!=null&&ta&&ta>0?(n-o)/ta*100:null;});

  // Shareholder returns
  const retYears = yearsFrom(history.buybacks ?? history.dividends_paid ?? {});
  const bbVals   = retYears.map(y=>Math.abs(history.buybacks?.[y]??0));
  const divVals  = retYears.map(y=>Math.abs(history.dividends_paid?.[y]??0));

  // Revenue growth decomp
  const revGrowth = revYears.slice(1).map((y,i)=>{ const c=history.revenue?.[y];const p=history.revenue?.[revYears[i]];return c&&p&&p>0?(c-p)/p*100:0;});
  const oiGrowth  = revYears.slice(1).map((y,i)=>{ const c=history.operating_income?.[y];const p=history.operating_income?.[revYears[i]];return c&&p&&p>0?(c-p)/p*100:0;});
  const niGrowth  = niYears.slice(1).map((y,i)=>{ const c=history.net_income?.[y];const p=history.net_income?.[niYears[i]];return c&&p&&p>0?(c-p)/p*100:0;});

  // Operating expense stack
  const opexYears = yearsFrom(history.rd_expense ?? history.sga_expense ?? {});

  // Peers merged with subject
  const subjectRevPerEmp = facts.revenue&&facts.employees&&facts.employees>0 ? Math.round(facts.revenue/facts.employees/1000) : null;
  const allPeers: PeerComp = [
    { symbol: ticker, pe: facts.pe_ratio??null, ev_ebitda: facts.ev_ebitda??null, p_fcf: facts.p_fcf??null, roic: facts.roic??0, net_margin: facts.net_margin_pct??0, gross_margin: facts.gross_margin_pct??null, rev_per_emp: subjectRevPerEmp, market_cap: facts.market_cap??null, rev_growth: facts.revenue_growth_yoy??null },
    ...peers,
  ];

  // ── KM history (prefer fetched, fall back to derived) ─────────────────────
  const kmDates = roicHist.map(k=>k.date?.slice(0,7)??"").slice(0,8);
  const kmPE    = roicHist.slice(0,8).map(k=>k.pe);
  const kmEV    = roicHist.slice(0,8).map(k=>k.ev_ebitda);
  const kmROIC  = roicHist.slice(0,8).map(k=>k.roic);
  const kmPFCF  = roicHist.slice(0,8).map(k=>k.p_fcf);
  const kmCR    = roicHist.slice(0,8).map(k=>k.current_ratio);
  const kmDE    = roicHist.slice(0,8).map(k=>k.debt_equity);

  // ── Monte Carlo DCF simulation ────────────────────────────────────────────

  const monteCarloResults = useMemo(()=>{
    const fcf   = facts.free_cash_flow;
    const mc    = facts.market_cap;
    const sh    = facts.shares_diluted_wtd;
    if (!fcf||!mc||!sh||fcf<=0) return { sims:[], price: mc/sh, pUp:null, pDown:null };

    const currentPrice = (facts.stock_price || mc/sh);
    const SIMS = 5000;
    const YEARS = 5;
    const results: number[] = [];

    // Parametric assumptions from historical data
    const revVals = Object.values(history.revenue||{});
    const revCAGRs = revVals.slice(1).map((v,i)=>revVals[i]>0?(v-revVals[i])/revVals[i]:0);
    const avgGrowth = revCAGRs.length>0 ? revCAGRs.reduce((a,b)=>a+b,0)/revCAGRs.length : 0.10;
    const growthStd = revCAGRs.length>1 ? Math.sqrt(revCAGRs.reduce((a,b)=>a+(b-avgGrowth)**2,0)/(revCAGRs.length-1)) : 0.08;
    const fcfMargin = facts.free_cash_flow && facts.revenue ? facts.free_cash_flow/facts.revenue : 0.15;

    for (let i=0;i<SIMS;i++){
      let cumFcf = 0;
      let curRev = facts.revenue||fcf/Math.max(fcfMargin,0.01);
      // Box-Muller for normal distribution
      const u1=Math.random(), u2=Math.random();
      const z=Math.sqrt(-2*Math.log(Math.max(u1,1e-10)))*Math.cos(2*Math.PI*u2);
      // Terminal multiple from current ev_ebitda distribution
      const baseMult = facts.ev_ebitda || 15;
      const termMult = Math.max(5, baseMult + (Math.random()-0.5)*8);
      const wacc = 0.09 + Math.random()*0.03;

      for (let yr=1;yr<=YEARS;yr++){
        const g = avgGrowth + growthStd*z*0.6*(1-yr*0.1);
        curRev *= (1+Math.max(-0.3,Math.min(0.6,g)));
        const yearFcf = curRev * (fcfMargin + (Math.random()-0.5)*0.04);
        cumFcf += yearFcf / Math.pow(1+wacc, yr);
      }
      const ebitda = (curRev*(facts.ebitda&&facts.revenue?facts.ebitda/facts.revenue:0.25));
      const termValue = ebitda * termMult / Math.pow(1+wacc, YEARS);
      const enterpriseVal = cumFcf + termValue;
      const netDebtCur = (facts.long_term_debt||0)-(facts.cash||0);
      const equityVal = Math.max(0, enterpriseVal - netDebtCur);
      results.push(equityVal/sh);
    }

    const sorted=[...results].sort((a,b)=>a-b);
    const p5=sorted[Math.floor(SIMS*0.05)];
    const p95=sorted[Math.floor(SIMS*0.95)];
    const median=sorted[Math.floor(SIMS*0.5)];
    const pUp=results.filter(v=>v>currentPrice).length/SIMS*100;

    return { sims:results, price:currentPrice, p5, p95, median, pUp, pDown:100-pUp };
  }, [facts, history]);

  // ── Revenue-to-FCF bridge ─────────────────────────────────────────────────

  const bridgeItems = useMemo(()=>{
    const rev  = facts.revenue||0;
    const cogs = facts.cost_of_revenue||0;
    const gp   = facts.gross_profit||(rev-cogs);
    const rd   = facts.rd_expense||0;
    const sga  = facts.sga_expense||0;
    const oi   = facts.operating_income||0;
    const da   = facts.da_expense||0;
    const capex= Math.abs(facts.capex||0);
    const fcf  = facts.free_cash_flow||0;
    const wc   = (facts.operating_cf||0) - oi - da;
    return [
      { label:"Revenue",  value: rev,         total:false },
      { label:"-COGS",    value: -cogs,        total:false },
      { label:"-OpEx",    value: -(rd+sga),   total:false },
      { label:"=EBIT",    value: 0,            total:true  },
      { label:"+D&A",     value: da,           total:false },
      { label:"WC Δ",     value: wc,           total:false },
      { label:"-CapEx",   value: -capex,       total:false },
      { label:"=FCF",     value: 0,            total:true  },
    ].filter(it=>it.value!==0||it.total);
  }, [facts]);

  // ── Rule of 40 ───────────────────────────────────────────────────────────

  const r40Points = growthHistory.length > 0
    ? growthHistory.slice(0,6).map(g=>({ label:g.date?.slice(0,4)??"", x:g.rev_growth, y:g.fcf_growth }))
    : revYears.slice(1).map((y,i)=>{
        const rg = revGrowth[i]??0;
        const fcf= history.free_cash_flow?.[y];
        const rev= history.revenue?.[y];
        const fg = fcf&&rev&&rev>0 ? fcf/rev*100 : 0;
        return { label:y.slice(0,4), x:rg, y:fg };
      });

  // ── Incremental EBIT Margin & Degree of Operating Leverage ───────────────
  const dolData = useMemo(() => {
    return revYears.slice(1).map((y, i) => {
      const prevY = revYears[i];
      const curRev = history.revenue?.[y], prevRev = history.revenue?.[prevY];
      const curOI  = history.operating_income?.[y], prevOI = history.operating_income?.[prevY];
      if (!curRev || !prevRev || curOI == null || prevOI == null || prevRev <= 0) return null;
      const deltaRev = curRev - prevRev, deltaOI = curOI - prevOI;
      const revPct = deltaRev / prevRev, oiPct = Math.abs(prevOI) > 0 ? deltaOI / Math.abs(prevOI) : null;
      const dol = oiPct != null && Math.abs(revPct) > 0.005 ? oiPct / revPct : null;
      const incrMargin = Math.abs(deltaRev) > 0 ? deltaOI / deltaRev * 100 : null;
      return { year: y.slice(0,4), dol, incrMargin, revPct: revPct*100, oiPct: oiPct != null ? oiPct*100 : null };
    }).filter(Boolean) as { year:string; dol:number|null; incrMargin:number|null; revPct:number; oiPct:number|null }[];
  }, [history, revYears]);

  // DuPont decomposition history
  const dupontHist = asYears.map(y=>({
    label:y,
    netMargin: (()=>{const n=history.net_income?.[y];const r=history.revenue?.[y];return n&&r&&r>0?n/r*100:0;})(),
    assetTO:   (()=>{const r=history.revenue?.[y];const a=history.total_assets?.[y];return r&&a&&a>0?r/a:0;})(),
    leverage:  (()=>{const a=history.total_assets?.[y];const e=history.equity?.[y];return a&&e&&e>0?a/e:0;})(),
  }));

  // ── Piotroski F-Score ─────────────────────────────────────────────────────
  const piotroski = useMemo(() => {
    const years = Object.keys(history.revenue || {}).sort();
    const cy = years[years.length - 1];
    const py = years[years.length - 2];
    const criteria: { label: string; pass: boolean; desc: string }[] = [];

    const roa = facts.net_income && facts.total_assets && facts.total_assets > 0 ? facts.net_income / facts.total_assets : null;
    const prevNI = py ? (history.net_income?.[py] ?? null) : null;
    const prevTA = py ? (history.total_assets?.[py] ?? null) : null;
    const prevROA = prevNI != null && prevTA && prevTA > 0 ? prevNI / prevTA : null;
    const ocf = facts.operating_cf ?? null;
    const ta = facts.total_assets ?? null;
    const ni = facts.net_income ?? null;

    // F1: ROA > 0
    criteria.push({ label: "ROA > 0", pass: (roa ?? -1) > 0, desc: roa != null ? `${(roa*100).toFixed(1)}%` : "—" });
    // F2: OCF > 0
    criteria.push({ label: "OCF > 0", pass: (ocf ?? -1) > 0, desc: ocf != null ? abbr(ocf,"$") : "—" });
    // F3: ΔROA > 0
    if (roa != null && prevROA != null) {
      const delta = roa - prevROA;
      criteria.push({ label: "ΔROA > 0", pass: delta > 0, desc: `${delta >= 0 ? "+" : ""}${(delta*100).toFixed(1)}pp` });
    }
    // F4: Accruals quality (OCF/TA > ROA)
    if (ocf != null && ta && ta > 0 && roa != null) {
      const q = ocf / ta;
      criteria.push({ label: "OCF Quality", pass: q > roa, desc: `OCF/TA ${(q*100).toFixed(1)}%` });
    }
    // F5: ΔLeverage < 0
    const ltd = facts.long_term_debt ?? null;
    const prevLTD = py ? (history.long_term_debt?.[py] ?? null) : null;
    if (ltd != null && ta && prevLTD != null && prevTA) {
      const curL = ltd / ta, prevL = prevLTD / prevTA;
      criteria.push({ label: "ΔLeverage < 0", pass: curL < prevL, desc: `${(curL*100).toFixed(0)}% vs ${(prevL*100).toFixed(0)}%` });
    }
    // F6: ΔCurrent Ratio > 0
    const ca = facts.current_assets ?? null;
    const cl = facts.current_liabilities ?? null;
    const prevCA = py ? (history.current_assets?.[py] ?? null) : null;
    const prevCL = py ? (history.current_liabilities?.[py] ?? null) : null;
    if (ca && cl && cl > 0 && prevCA && prevCL && prevCL > 0) {
      const cr = ca / cl, prevCR = prevCA / prevCL;
      criteria.push({ label: "ΔCurrent Ratio > 0", pass: cr > prevCR, desc: `${cr.toFixed(2)}x vs ${prevCR.toFixed(2)}x` });
    }
    // F7: No share dilution
    const curSh = facts.shares_diluted_wtd ?? null;
    const prevSh = py ? (history.shares_diluted_wtd?.[py] ?? null) : null;
    if (curSh && prevSh) {
      const chg = (curSh - prevSh) / prevSh;
      criteria.push({ label: "No Dilution", pass: curSh <= prevSh * 1.005, desc: `${chg >= 0 ? "+" : ""}${(chg*100).toFixed(1)}%` });
    }
    // F8: ΔGross Margin > 0
    const gm = facts.gross_margin_pct ?? null;
    const prevGP = py ? (history.gross_profit?.[py] ?? null) : null;
    const prevRev = py ? (history.revenue?.[py] ?? null) : null;
    const prevGM = prevGP && prevRev && prevRev > 0 ? prevGP / prevRev * 100 : null;
    if (gm != null && prevGM != null) {
      criteria.push({ label: "ΔGross Margin > 0", pass: gm > prevGM, desc: `${gm.toFixed(1)}% vs ${prevGM.toFixed(1)}%` });
    }
    // F9: ΔAsset Turnover > 0
    const rev = facts.revenue ?? null;
    const prevRevAT = py ? (history.revenue?.[py] ?? null) : null;
    if (rev && ta && prevRevAT && prevTA) {
      const at = rev / ta, prevAT = prevRevAT / prevTA;
      criteria.push({ label: "ΔAsset Turnover > 0", pass: at > prevAT, desc: `${at.toFixed(2)}x vs ${prevAT.toFixed(2)}x` });
    }

    const score = criteria.filter(c => c.pass).length;
    return { score, criteria, maxScore: criteria.length };
  }, [facts, history]);

  // ── Altman Z-Score ────────────────────────────────────────────────────────
  const altmanZ = useMemo(() => {
    const wc = (facts.current_assets ?? 0) - (facts.current_liabilities ?? 0);
    const ta = facts.total_assets;
    const re = facts.retained_earnings ?? 0;
    const ebit = facts.operating_income ?? 0;
    const mc = facts.market_cap ?? 0;
    const tl = Math.max(facts.total_liabilities ?? 1, 1);
    const rev = facts.revenue ?? 0;
    if (!ta || ta === 0) return null;
    const x1 = wc / ta;
    const x2 = re / ta;
    const x3 = ebit / ta;
    const x4 = mc / tl;
    const x5 = rev / ta;
    const z = 1.2*x1 + 1.4*x2 + 3.3*x3 + 0.6*x4 + 1.0*x5;
    const zone = z > 2.99 ? "SAFE" : z > 1.81 ? "GRAY" : "DISTRESS";
    const color = z > 2.99 ? GREEN : z > 1.81 ? AMBER : RED;
    return { z: parseFloat(z.toFixed(2)), x1, x2, x3, x4, x5, zone, color };
  }, [facts]);

  // ── Reverse DCF (market-implied growth rate) ─────────────────────────────
  const reverseDCF = useMemo(() => {
    const mc = facts.market_cap;
    const fcf = facts.free_cash_flow;
    const rev = facts.revenue;
    const wacc = 0.09;
    if (!mc || !fcf || !rev || fcf <= 0 || mc <= 0) return null;
    const fcfMargin = fcf / rev;
    const ebitdaMarg = facts.ebitda && facts.revenue ? facts.ebitda / facts.revenue : 0.25;
    const termMult = facts.ev_ebitda || 15;
    const netDebtV = (facts.long_term_debt ?? 0) - (facts.cash ?? 0);
    const targetEV = mc + netDebtV;
    let lo = -0.25, hi = 1.5, impliedG = 0.10;
    for (let iter = 0; iter < 60; iter++) {
      const g = (lo + hi) / 2;
      let cumFcf = 0, curRev = rev;
      for (let yr = 1; yr <= 5; yr++) {
        curRev *= (1 + g);
        cumFcf += curRev * fcfMargin / Math.pow(1 + wacc, yr);
      }
      const termEV = curRev * ebitdaMarg * termMult / Math.pow(1 + wacc, 5);
      const totalEV = cumFcf + termEV;
      if (Math.abs(totalEV - targetEV) < targetEV * 0.0005) { impliedG = g; break; }
      if (totalEV < targetEV) lo = g; else hi = g;
      impliedG = g;
    }
    const revVals = Object.values(history.revenue || {});
    const histCAGR = revVals.length >= 2
      ? Math.pow(revVals[revVals.length-1] / Math.max(revVals[0], 1), 1 / Math.max(revVals.length-1, 1)) - 1
      : null;
    return {
      impliedGrowth: parseFloat((impliedG * 100).toFixed(1)),
      fcfYield: parseFloat((fcf / mc * 100).toFixed(1)),
      histCAGR: histCAGR != null ? parseFloat((histCAGR * 100).toFixed(1)) : null,
      wacc: 9,
    };
  }, [facts, history]);

  // ── Earnings streak ───────────────────────────────────────────────────────
  const earningsStreak = useMemo(() => {
    let beats = 0, misses = 0, streak = 0;
    let streakDone = false;
    const beatMagnitudes: number[] = [];
    // earningsSurprises[0] = most recent; iterate newest-first for correct streak
    for (const e of earningsSurprises.slice(0, 8)) {
      if (e.surprise_pct == null) continue;
      if (e.surprise_pct > 0) {
        beats++;
        beatMagnitudes.push(e.surprise_pct);
        if (!streakDone) streak++;
      } else {
        misses++;
        streakDone = true;
      }
    }
    const avgBeatMag = beatMagnitudes.length > 0 ? beatMagnitudes.reduce((a,b)=>a+b,0)/beatMagnitudes.length : null;
    return { streak, beats, misses, total: beats + misses, avgBeatMag };
  }, [earningsSurprises]);

  // ── Quality composite score (0–100) ──────────────────────────────────────
  const qualityScore = useMemo(() => {
    let score = 0;
    // Piotroski contribution: max 45 pts
    if (piotroski.maxScore > 0) score += (piotroski.score / piotroski.maxScore) * 45;
    // Altman Z contribution: max 25 pts
    if (altmanZ) {
      if (altmanZ.zone === "SAFE") score += 25;
      else if (altmanZ.zone === "GRAY") score += 12;
    }
    // FCF yield > 3%: 10 pts
    if (facts.free_cash_flow && facts.market_cap && facts.free_cash_flow / facts.market_cap > 0.03) score += 10;
    // Earnings streak: 5 pts each consecutive beat, cap 20
    score += Math.min(earningsStreak.streak * 5, 20);
    return Math.min(100, Math.round(score));
  }, [piotroski, altmanZ, facts, earningsStreak]);

  // ── Multi-Factor Score Engine (Loop 9) ───────────────────────────────────
  const factorScores = useMemo(() => {
    const avg_=(arr:(number|null)[])=>{const v=arr.filter((x):x is number=>x!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
    const clamp=(x:number|null)=>x!=null?Math.max(0,Math.min(100,x)):null;
    const medArr=(arr:(number|null)[])=>{const v=arr.filter((x):x is number=>x!=null).sort((a,b)=>a-b);return v.length?v[Math.floor(v.length/2)]:null;};
    const peerPE=medArr(peers.map(p=>p.pe));
    const peerEV=medArr(peers.map(p=>p.ev_ebitda));

    // VALUE (4 sub-signals)
    const pe=facts.pe_ratio, ev=facts.ev_ebitda, pfcf=facts.p_fcf;
    const fcfYield=facts.free_cash_flow&&facts.market_cap?facts.free_cash_flow/facts.market_cap*100:null;
    const v_pe  =pe&&peerPE?clamp(50+(peerPE-pe)/(peerPE||1)*80):(pe?clamp((40-pe)/40*100+50):null);
    const v_ev  =ev&&peerEV?clamp(50+(peerEV-ev)/(peerEV||1)*80):(ev?clamp((20-ev)/20*100+50):null);
    const v_pfcf=pfcf?clamp((40-pfcf)/30*100):null;
    const v_fcfY=fcfYield!=null?clamp(fcfYield*12):null;
    const valueScore=Math.round(avg_([v_pe,v_ev,v_pfcf,v_fcfY])??0);

    // QUALITY (5 sub-signals)
    const roic=facts.roic, gm=facts.gross_margin_pct;
    const accrualLast=accruals[accruals.length-1]??null;
    const icov=facts.interest_coverage;
    const q_roic =roic!=null?clamp(roic/30*100):null;
    const q_gm   =gm!=null?clamp(gm):null;
    const q_piost=piotroski.maxScore>0?(piotroski.score/piotroski.maxScore)*100:null;
    const q_acc  =accrualLast!=null?clamp(50-accrualLast*8):null;  // negative accruals (OCF>NI) = high quality
    const q_icov =icov!=null?clamp(icov/25*100):null;
    const qualityFactor=Math.round(avg_([q_roic,q_gm,q_piost,q_acc,q_icov])??0);

    // MOMENTUM (4 sub-signals)
    const revG=facts.revenue_growth_yoy, epsG=facts.eps_growth_yoy;
    // Prefer OCF growth (operating cash momentum) over FCF growth (capex-distorted)
    const ocfG="ocf_growth_yoy" in facts ? facts.ocf_growth_yoy : facts.fcf_growth_yoy;
    const beatRate=earningsStreak.total>0?earningsStreak.beats/earningsStreak.total*100:null;
    const m_rev =revG!=null?clamp(revG/30*100+50):null;
    const m_eps =epsG!=null?clamp(epsG/25*100+50):null;
    const m_ocf =ocfG!=null?clamp(ocfG/30*100+50):null;
    const m_beat=beatRate!=null?clamp(beatRate):null;
    const momentumFactor=Math.round(avg_([m_rev,m_eps,m_ocf,m_beat])??0);

    // SAFETY (3 sub-signals)
    const s_altman=altmanZ?clamp(altmanZ.z/5*100):null;
    const cr=facts.current_assets&&facts.current_liabilities&&facts.current_liabilities>0?facts.current_assets/facts.current_liabilities:null;
    const s_cr=cr!=null?clamp((cr-0.5)/2.5*100):null;
    const netDE=facts.ebitda&&facts.ebitda>0&&facts.long_term_debt!=null&&facts.cash!=null?(facts.long_term_debt-facts.cash)/facts.ebitda:null;
    const s_nd=netDE!=null?clamp((4-netDE)/6*100+10):null;
    const safetyFactor=Math.round(avg_([s_altman,s_cr,s_nd])??0);

    // GROWTH (3 sub-signals)
    const revVals=Object.values(history.revenue||{});
    const revCAGR5=revVals.length>=2?(Math.pow(revVals[revVals.length-1]/Math.max(revVals[0],1),1/Math.max(revVals.length-1,1))-1)*100:null;
    const epsVals=Object.values(history.eps_diluted||{}).filter(v=>v>0);
    const epsCAGR5=epsVals.length>=2?(Math.pow(epsVals[epsVals.length-1]/Math.max(epsVals[0],0.001),1/Math.max(epsVals.length-1,1))-1)*100:null;
    const fwdRevG=analystEstimates.length>0&&analystEstimates[0].rev_avg&&facts.revenue?((analystEstimates[0].rev_avg/facts.revenue)-1)*100:null;
    const g_rev=revCAGR5!=null?clamp(revCAGR5/25*100):null;
    const g_eps=epsCAGR5!=null?clamp(epsCAGR5/20*100):null;
    const g_fwd=fwdRevG!=null?clamp(fwdRevG/20*100+50):null;
    const growthFactor=Math.round(avg_([g_rev,g_eps,g_fwd])??0);

    return {
      value:valueScore, quality:qualityFactor, momentum:momentumFactor, safety:safetyFactor, growth:growthFactor,
      overall:Math.round(avg_([valueScore,qualityFactor,momentumFactor,safetyFactor,growthFactor])??0),
      subs:{
        value:[
          {name:"P/E vs Peers",score:Math.round(v_pe??0),detail:pe?`${pe.toFixed(1)}x`+(peerPE?` (peer ${peerPE.toFixed(1)}x)`:""): "—"},
          {name:"EV/EBITDA vs Peers",score:Math.round(v_ev??0),detail:ev?`${ev.toFixed(1)}x`+(peerEV?` (peer ${peerEV.toFixed(1)}x)`:""): "—"},
          {name:"P/FCF",score:Math.round(v_pfcf??0),detail:pfcf?`${pfcf.toFixed(1)}x`:"—"},
          {name:"FCF Yield",score:Math.round(v_fcfY??0),detail:fcfYield!=null?`${fcfYield.toFixed(1)}%`:"—"},
        ],
        quality:[
          {name:"ROIC",score:Math.round(q_roic??0),detail:roic!=null?`${roic.toFixed(1)}%`:"—"},
          {name:"Gross Margin",score:Math.round(q_gm??0),detail:gm!=null?`${gm.toFixed(1)}%`:"—"},
          {name:"Piotroski",score:Math.round(q_piost??0),detail:`${piotroski.score}/${piotroski.maxScore}`},
          {name:"OCF Quality",score:Math.round(q_acc??0),detail:accrualLast!=null?`${accrualLast.toFixed(2)}%`:"—"},
          {name:"Int Coverage",score:Math.round(q_icov??0),detail:icov!=null?`${icov.toFixed(1)}x`:"—"},
        ],
        momentum:[
          {name:"Rev Growth YoY",score:Math.round(m_rev??0),detail:revG!=null?`${revG.toFixed(1)}%`:"—"},
          {name:"EPS Growth YoY",score:Math.round(m_eps??0),detail:epsG!=null?`${epsG.toFixed(1)}%`:"—"},
          {name:"OCF Growth YoY",score:Math.round(m_ocf??0),detail:ocfG!=null?`${ocfG.toFixed(1)}%`:"—"},
          {name:"Beat Rate",score:Math.round(m_beat??0),detail:earningsStreak.total>0?`${earningsStreak.beats}/${earningsStreak.total}`:"—"},
        ],
        safety:[
          {name:"Altman Z",score:Math.round(s_altman??0),detail:altmanZ?`${altmanZ.z}`:"—"},
          {name:"Current Ratio",score:Math.round(s_cr??0),detail:cr!=null?`${cr.toFixed(2)}x`:"—"},
          {name:"Net Debt/EBITDA",score:Math.round(s_nd??0),detail:netDE!=null?`${netDE.toFixed(1)}x`:"—"},
        ],
        growth:[
          {name:"5Y Rev CAGR",score:Math.round(g_rev??0),detail:revCAGR5!=null?`${revCAGR5.toFixed(1)}%`:"—"},
          {name:"5Y EPS CAGR",score:Math.round(g_eps??0),detail:epsCAGR5!=null?`${epsCAGR5.toFixed(1)}%`:"—"},
          {name:"Fwd Rev Growth",score:Math.round(g_fwd??0),detail:fwdRevG!=null?`${fwdRevG.toFixed(1)}%`:"—"},
        ],
      },
    };
  }, [facts, history, peers, piotroski, altmanZ, accruals, earningsStreak, analystEstimates]);

  // ── LOOP 14: Investment Thesis Card ──────────────────────────────────────
  const investmentThesis = useMemo(() => {
    const score = factorScores.overall;
    const verdict = score >= 75 ? "OVERWEIGHT" : score >= 50 ? "NEUTRAL" : "UNDERWEIGHT";
    const verdictColor = score >= 75 ? GREEN : score >= 50 ? AMBER : RED;
    const verdictBg = score >= 75 ? "rgba(16,185,129,0.08)" : score >= 50 ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)";

    type SubEntry = {name:string;score:number;detail:string};
    const allSubs:SubEntry[]=[
      ...factorScores.subs.quality,
      ...factorScores.subs.growth,
      ...factorScores.subs.momentum,
      ...factorScores.subs.safety,
      ...factorScores.subs.value,
    ];
    const bullSubs=allSubs.filter(s=>s.score>=70&&s.detail!=="—").sort((a,b)=>b.score-a.score).slice(0,3);
    const bearSubs=allSubs.filter(s=>s.score<=40&&s.detail!=="—").sort((a,b)=>a.score-b.score).slice(0,3);

    const validPE=kmPE.filter((v):v is number=>v!=null&&v>0);
    const avgPE=validPE.length?validPE.reduce((a,b)=>a+b,0)/validPE.length:null;
    const currPE=facts.pe_ratio;
    const peVsHist=currPE&&avgPE?((currPE-avgPE)/avgPE*100):null;

    const validEV=kmEV.filter((v):v is number=>v!=null&&v>0);
    const avgEV=validEV.length?validEV.reduce((a,b)=>a+b,0)/validEV.length:null;
    const currEV=facts.ev_ebitda;
    const evVsHist=currEV&&avgEV?((currEV-avgEV)/avgEV*100):null;

    return{verdict,verdictColor,verdictBg,score,bullSubs,bearSubs,peVsHist,evVsHist,avgPE,avgEV,currPE,currEV};
  },[factorScores,kmPE,kmEV,facts]);

  // ── LOOP 14: Revenue × Margin Sensitivity Grid ───────────────────────────
  const revMarginSensitivity = useMemo(() => {
    const rev=facts.revenue, ebitda=facts.ebitda, sh=facts.shares_diluted_wtd;
    const mc=facts.market_cap, ltd=facts.long_term_debt??0, cash=facts.cash??0;
    const evEBITDA=facts.ev_ebitda;
    if(!rev||!ebitda||!sh||!mc||!evEBITDA||ebitda<=0) return null;
    const curMarginPct=ebitda/rev*100;
    const netD=ltd-cash;
    const currentPrice=facts.stock_price||(mc/sh);
    const revGs=[-0.05,0,0.05,0.10,0.15,0.20,0.25,0.30];
    const mDs=[-0.10,-0.05,0,0.05,0.10];
    const grid=revGs.map(rg=>mDs.map(md=>{
      const futRev=rev*(1+rg);
      const futMargin=Math.max(0.01,(curMarginPct+md*100)/100);
      const futEBITDA=futRev*futMargin;
      const futEV=futEBITDA*evEBITDA;
      const equityVal=Math.max(0,futEV-netD);
      return Math.round(equityVal/sh);
    }));
    return{grid,revGs,mDs,curMarginPct,currentPrice:Math.round(currentPrice)};
  },[facts]);

  // ── LOOP 15: Transcript parse (memoised) ─────────────────────────────────
  const transcriptData = useMemo(()=>parseTranscript(earningsTranscript),[earningsTranscript]);

  // ── Beneish M-Score — forensic earnings manipulation detector (Loop 10) ──
  const beneishMScore = useMemo(() => {
    const years=Object.keys(history.revenue||{}).sort();
    if(years.length<2)return null;
    const cy=years[years.length-1], py=years[years.length-2];
    const g=(key:string,y:string)=>history[key]?.[y]??null;
    const rev_t=g("revenue",cy), rev_p=g("revenue",py);
    const ar_t=g("accounts_receivable",cy), ar_p=g("accounts_receivable",py);
    const gp_t=g("gross_profit",cy), gp_p=g("gross_profit",py);
    const ppe_t=g("ppe_net",cy), ppe_p=g("ppe_net",py);
    const ca_t=g("current_assets",cy), ca_p=g("current_assets",py);
    const ta_t=g("total_assets",cy), ta_p=g("total_assets",py);
    const da_t=g("da_expense",cy), da_p=g("da_expense",py);
    const sga_t=g("sga_expense",cy), sga_p=g("sga_expense",py);
    const ni_t=g("net_income",cy);
    const ocf_t=g("operating_cf",cy);
    const ltd_t=g("long_term_debt",cy), ltd_p=g("long_term_debt",py);
    const cl_t=g("current_liabilities",cy), cl_p=g("current_liabilities",py);
    if(!rev_t||!rev_p||!ta_t)return null;
    const DSRI=ar_t&&rev_t&&ar_p&&rev_p&&rev_p>0?(ar_t/rev_t)/(ar_p/rev_p):null;
    const GMI=gp_t&&rev_t&&gp_p&&rev_p&&gp_t>0?(gp_p/rev_p)/(gp_t/rev_t):null;
    const AQI=ca_t&&ppe_t&&ta_t&&ca_p&&ppe_p&&ta_p?(1-(ca_t+ppe_t)/ta_t)/(1-(ca_p+ppe_p)/ta_p):null;
    const SGI=rev_t&&rev_p&&rev_p>0?rev_t/rev_p:null;
    const DEPI=da_t&&ppe_t&&da_p&&ppe_p&&da_t>0?(da_p/(da_p+ppe_p))/(da_t/(da_t+ppe_t)):null;
    const SGAI=sga_t&&rev_t&&sga_p&&rev_p&&sga_p>0?(sga_t/rev_t)/(sga_p/rev_p):null;
    const LVGI=ltd_t!=null&&cl_t!=null&&ta_t&&ltd_p!=null&&cl_p!=null&&ta_p?((ltd_t+cl_t)/ta_t)/((ltd_p+cl_p)/ta_p):null;
    const TATA=ni_t!=null&&ocf_t!=null&&ta_t?(ni_t-ocf_t)/ta_t:null;
    const parts:[string,string,number,number|null,number,boolean][]=[
      ["DSRI","Days Sales Recv. Index", 0.920,DSRI, 1.10,true],
      ["GMI", "Gross Margin Index",     0.528,GMI,  1.00,true],
      ["AQI", "Asset Quality Index",    0.404,AQI,  1.00,true],
      ["SGI", "Sales Growth Index",     0.892,SGI,  1.60,true],
      ["DEPI","Depreciation Index",     0.115,DEPI, 1.00,true],
      ["SGAI","SG&A Index",            -0.172,SGAI, 1.10,true],
      ["TATA","Total Accruals/Assets",  4.679,TATA, 0.05,true],
      ["LVGI","Leverage Index",        -0.327,LVGI, 1.10,true],
    ];
    const valid=parts.filter(p=>p[3]!=null);
    if(valid.length<4)return null;
    let m=-4.84;
    for(const[,,w,v] of valid)m+=w*(v??0);
    return{
      score:parseFloat(m.toFixed(2)),
      zone:m>-1.78?"HIGH RISK" as const:m>-2.22?"GRAY ZONE" as const:"LOW RISK" as const,
      color:m>-1.78?RED:m>-2.22?AMBER:GREEN,
      components:valid.map(p=>({
        key:p[0],name:p[1],weight:p[2],value:p[3]??0,threshold:p[4],
        contribution:p[2]*(p[3]??0),
        isFlag:(p[3]??0)>p[4],
      })),
      flagCount:valid.filter(p=>(p[3]??0)>p[4]).length,
    };
  }, [history]);

  // ── Scenario DCF pricing (Loop 11) ───────────────────────────────────────
  const scenarioPrices = useMemo(() => {
    const compute=(p:{revCAGR:number;exitMargin:number;exitMultiple:number;wacc:number})=>{
      const rev=facts.revenue, sh=facts.shares_diluted_wtd;
      if(!rev||!sh)return null;
      const fcfM=facts.free_cash_flow&&facts.revenue&&facts.revenue>0?facts.free_cash_flow/facts.revenue:0.15;
      const netD=(facts.long_term_debt??0)-(facts.cash??0);
      let cum=0, cr=rev;
      for(let yr=1;yr<=5;yr++){cr*=(1+p.revCAGR/100);cum+=cr*fcfM/Math.pow(1+p.wacc/100,yr);}
      const tv=cr*(p.exitMargin/100)*p.exitMultiple/Math.pow(1+p.wacc/100,5);
      return Math.max(0,cum+tv-netD)/sh;
    };
    const current=facts.stock_price||(facts.market_cap&&facts.shares_diluted_wtd?facts.market_cap/facts.shares_diluted_wtd:0);
    return{bull:compute(scenarios.bull),base:compute(scenarios.base),bear:compute(scenarios.bear),current};
  },[scenarios,facts]);

  // ── Football Field methods (Loop 11) ─────────────────────────────────────
  const footballFieldMethods = useMemo(()=>{
    const sh=facts.shares_diluted_wtd??0;
    const medArr=(arr:(number|null)[])=>{const v=arr.filter((x):x is number=>x!=null).sort((a,b)=>a-b);return v.length?v[Math.floor(v.length/2)]:null;};
    const peerPE=medArr(peers.map(p=>p.pe));
    const peerEV=medArr(peers.map(p=>p.ev_ebitda));
    const netD=(facts.long_term_debt??0)-(facts.cash??0);
    const ms:{label:string;lo:number;hi:number;color:string}[]=[];
    const add=(label:string,lo:number,hi:number,color:string)=>{if(lo>0&&hi>=lo)ms.push({label,lo,hi,color});};
    if(scenarioPrices.bear!=null&&scenarioPrices.bull!=null&&scenarioPrices.base!=null){
      add("DCF Bear",scenarioPrices.bear*0.9,scenarioPrices.bear*1.1,RED);
      add("DCF Base",scenarioPrices.base*0.95,scenarioPrices.base*1.05,BLUE);
      add("DCF Bull",scenarioPrices.bull*0.9,scenarioPrices.bull*1.1,GREEN);
    }
    const eps=facts.eps_diluted??(facts.net_income&&sh?facts.net_income/sh:null);
    if(eps&&eps>0&&peerPE)add("P/E Relative",eps*(peerPE*0.75),eps*(peerPE*1.25),PURPLE);
    if(facts.ebitda&&peerEV&&sh){
      const lo=facts.ebitda*(peerEV*0.75)-netD, hi=facts.ebitda*(peerEV*1.25)-netD;
      if(lo>0)add("EV/EBITDA Rel.",lo/sh,hi/sh,TEAL);
    }
    if(monteCarloResults.p5!=null&&monteCarloResults.p95!=null)
      add("Monte Carlo",monteCarloResults.p5,monteCarloResults.p95,AMBER);
    return ms;
  },[scenarioPrices,facts,peers,monteCarloResults]);

  // ── Economic Value Added (EVA) history — Loop 12 ────────────────────────
  const evaHistory = useMemo(() => {
    const WACC = 0.09;
    return asYears.map(y => {
      const oi  = history.operating_income?.[y];
      const ta  = history.total_assets?.[y];
      const cl  = history.current_liabilities?.[y];
      const cash= history.cash?.[y];
      const tax = history.income_tax?.[y];
      const pt  = history.pretax_income?.[y];
      const rev = history.revenue?.[y];
      const cx  = history.capex?.[y];
      if(!oi||!ta)return null;
      const taxRate=pt&&tax?Math.min(0.45,Math.abs(tax/pt)):0.21;
      const nopat=oi*(1-taxRate);
      const ic=Math.max(1,ta-(cl??0)-(cash??0));
      const capitalCharge=WACC*ic;
      const reinvRate=cx&&nopat>0?Math.abs(cx)/nopat*100:null;
      return{
        year:y, eva:nopat-capitalCharge, nopat, capitalCharge, ic,
        roic:nopat/ic*100,
        nopatMargin:rev?nopat/rev*100:null,
        icTurnover:rev?rev/ic:null,
        reinvRate,
      };
    }).filter((x):x is NonNullable<typeof x>=>x!=null);
  },[history,asYears]);

  // ── Working Capital multi-year trend — Loop 12 ───────────────────────────
  const wcTrend = useMemo(()=>asYears.map(y=>{
    const rev=history.revenue?.[y], cogs=history.cost_of_revenue?.[y];
    const ar=history.accounts_receivable?.[y], inv=history.inventory?.[y];
    const ap=history.accounts_payable?.[y];
    return{
      year:y,
      dso:ar&&rev&&rev>0?ar/rev*365:null,
      dio:inv&&cogs&&cogs>0?inv/cogs*365:null,
      dpo:ap&&cogs&&cogs>0?ap/cogs*365:null,
      ccc:ar&&rev&&rev>0&&ap&&cogs&&cogs>0?ar/rev*365+(inv&&cogs>0?inv/cogs*365:0)-ap/cogs*365:null,
    };
  }),[history,asYears]);

  // ── Capital Returns & Shareholder Yield — Loop 13 ───────────────────────
  const capitalReturns = useMemo(()=>{
    const mc=facts.market_cap, sh=facts.shares_diluted_wtd;
    const div=Math.abs(facts.dividends_paid??0);
    const bb=Math.abs(facts.buybacks??0);
    const fcf=facts.free_cash_flow, eps=facts.eps_diluted;
    const divY=mc&&div?div/mc*100:null;
    const bbY=mc&&bb?bb/mc*100:null;
    const totalYield=(divY??0)+(bbY??0);
    const payout=eps&&eps>0&&div&&sh?(div/sh)/eps*100:null;
    const fcfPayout=fcf&&fcf>0&&div?div/fcf*100:null;
    const divVals=Object.entries(history.dividends_paid||{}).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>Math.abs(v)).filter(v=>v>0);
    const divCAGR=divVals.length>=2?(Math.pow(divVals[divVals.length-1]/Math.max(divVals[0],1),1/Math.max(divVals.length-1,1))-1)*100:null;
    // Per-year total shareholder yield
    const yieldByYear=asYears.map(y=>{
      const ymc=facts.market_cap; // approximate — use current mc as base
      const ydiv=Math.abs(history.dividends_paid?.[y]??0);
      const ybb=Math.abs(history.buybacks?.[y]??0);
      return{year:y,divYield:ymc&&ydiv?ydiv/ymc*100:null,bbYield:ymc&&ybb?ybb/ymc*100:null};
    });
    // FCF allocation breakdown (most recent year)
    const cy=asYears[asYears.length-1];
    const alloc=fcf&&fcf>0?{
      capex:Math.abs(history.capex?.[cy]??0),
      dividends:div,
      buybacks:bb,
      debtRepay:Math.max(0,(history.long_term_debt?.[asYears[asYears.length-2]??cy]??0)-(history.long_term_debt?.[cy]??0)),
    }:null;
    return{divYield:divY,buybackYield:bbY,totalYield,payout,fcfPayout,divCAGR,yieldByYear,alloc};
  },[facts,history,asYears]);

  // ── Relative Value vs Peers + PEG + Magic Formula — Loop 13 ─────────────
  const relativeValue = useMemo(()=>{
    const medArr=(arr:(number|null)[])=>{const v=arr.filter((x):x is number=>x!=null).sort((a,b)=>a-b);return v.length?v[Math.floor(v.length/2)]:null;};
    const peerPE=medArr(peers.map(p=>p.pe));
    const peerEV=medArr(peers.map(p=>p.ev_ebitda));
    const peerNM=medArr(peers.map(p=>p.net_margin??null));
    const peerROIC=medArr(peers.map(p=>p.roic??null));
    const peerGM=medArr(peers.map(p=>p.gross_margin??null));
    const pePrem=facts.pe_ratio&&peerPE?(facts.pe_ratio/peerPE-1)*100:null;
    const evPrem=facts.ev_ebitda&&peerEV?(facts.ev_ebitda/peerEV-1)*100:null;
    const nmDiff=facts.net_margin_pct!=null&&peerNM!=null?facts.net_margin_pct-peerNM:null;
    const roicDiff=facts.roic!=null&&peerROIC!=null?facts.roic-peerROIC:null;
    const gmDiff=facts.gross_margin_pct!=null&&peerGM!=null?facts.gross_margin_pct-peerGM:null;
    // PEG ratio: P/E / EPS growth (annualised)
    const peg=facts.pe_ratio&&facts.eps_growth_yoy&&facts.eps_growth_yoy>0?facts.pe_ratio/facts.eps_growth_yoy:null;
    // Magic Formula (Greenblatt): earnings yield (EBIT/EV) + ROIC
    const ev_full=facts.market_cap!=null&&facts.long_term_debt!=null&&facts.cash!=null?facts.market_cap+facts.long_term_debt-facts.cash:null;
    const earningsYield=facts.operating_income&&ev_full&&ev_full>0?facts.operating_income/ev_full*100:null;
    const magicScore=earningsYield!=null&&facts.roic!=null?earningsYield+facts.roic:null;
    // Scorecard table rows
    const rows=[
      {label:"P/E",company:facts.pe_ratio,peer:peerPE,premium:pePrem,unit:"x",lowerBetter:true},
      {label:"EV/EBITDA",company:facts.ev_ebitda,peer:peerEV,premium:evPrem,unit:"x",lowerBetter:true},
      {label:"Gross Margin",company:facts.gross_margin_pct,peer:peerGM,premium:gmDiff,unit:"%",lowerBetter:false},
      {label:"Net Margin",company:facts.net_margin_pct,peer:peerNM,premium:nmDiff,unit:"%",lowerBetter:false},
      {label:"ROIC",company:facts.roic,peer:peerROIC,premium:roicDiff,unit:"%",lowerBetter:false},
    ].filter(r=>r.company!=null&&r.peer!=null);
    return{pePrem,evPrem,nmDiff,roicDiff,gmDiff,peg,earningsYield,magicScore,rows,peerPE,peerEV,peerNM,peerROIC,peerGM};
  },[facts,peers]);

  // ── DCF Sensitivity grid (WACC × terminal growth) ────────────────────────
  const dcfSensitivity = useMemo(() => {
    const fcf = facts.free_cash_flow;
    const shares = facts.shares_diluted_wtd;
    if (!fcf || !shares || fcf <= 0) return null;
    const rev = facts.revenue ?? fcf / 0.15;
    const fcfMargin = facts.revenue ? fcf / facts.revenue : 0.15;
    const netD = (facts.long_term_debt ?? 0) - (facts.cash ?? 0);
    const termMult = facts.ev_ebitda || 15;
    const ebitdaMarg = facts.ebitda && facts.revenue ? facts.ebitda / facts.revenue : 0.25;
    const waccVals = [0.07, 0.08, 0.09, 0.10, 0.11];
    const growthVals = [0.03, 0.05, 0.08, 0.10, 0.12];
    const currentPrice = facts.stock_price || (facts.market_cap && shares ? facts.market_cap / shares : 0);

    const grid = waccVals.map(wacc =>
      growthVals.map(g => {
        let cumFcf = 0, curRev = rev;
        for (let yr = 1; yr <= 5; yr++) {
          curRev *= (1 + g + 0.03);
          cumFcf += curRev * fcfMargin / Math.pow(1 + wacc, yr);
        }
        const termEV = curRev * ebitdaMarg * (termMult * (1 + g * 2)) / Math.pow(1 + wacc, 5);
        const price = Math.max(0, cumFcf + termEV - netD) / shares;
        return parseFloat(price.toFixed(0));
      })
    );
    return { grid, waccVals, growthVals, currentPrice };
  }, [facts]);

  // ── Working Capital metrics ───────────────────────────────────────────────
  const workingCapital = useMemo(() => {
    const rev = facts.revenue;
    const cogs = facts.cost_of_revenue;
    const ar = facts.accounts_receivable;
    const inv = facts.inventory;
    const ap = facts.accounts_payable;
    const ca = facts.current_assets;
    const cl = facts.current_liabilities;
    const dso = ar && rev && rev > 0 ? ar / rev * 365 : null;
    const dio = inv && cogs && cogs > 0 ? inv / cogs * 365 : null;
    const dpo = ap && cogs && cogs > 0 ? ap / cogs * 365 : null;
    const ccc = dso != null && dpo != null ? (dso + (dio ?? 0) - dpo) : null;
    const nwc = ca && cl ? ca - cl : null;
    return { dso, dio, dpo, ccc, nwc };
  }, [facts]);

  // ── Segment data ──────────────────────────────────────────────────────────
  const segmentItems = useMemo(() => {
    if (!segments?.data) return [];
    return Object.entries(segments.data)
      .map(([label, value]) => ({ label, value: value as number }))
      .sort((a, b) => b.value - a.value);
  }, [segments]);

  const geoItems = useMemo(() => {
    if (!geoSegments?.data) return [];
    return Object.entries(geoSegments.data)
      .map(([label, value]) => ({ label, value: value as number }))
      .sort((a, b) => b.value - a.value);
  }, [geoSegments]);

  // ── AI Analysis ──────────────────────────────────────────────────────────

  async function runAI() {
    if (aiRunning) return;
    setAiRunning(true); setAiText("");
    const revCAGRYrs = revYears.length>=2 ? Math.pow(history.revenue?.[revYears[revYears.length-1]]/(history.revenue?.[revYears[0]]||1),1/(revYears.length-1))-1 : 0;
    const payload = {
      ticker,
      customPrompt: `You are the head of equity research at a top-tier hedge fund. Conduct a comprehensive quantitative and qualitative analysis of ${companyName} (${ticker}). Be brutally specific with numbers.

KEY FINANCIAL DATA:
Revenue: ${abbr(facts.revenue||0,"$")} | Net Income: ${abbr(facts.net_income||0,"$")} | FCF: ${abbr(facts.free_cash_flow||0,"$")}
Margins: Gross ${facts.gross_margin_pct?.toFixed(1)??"—"}% | Op ${facts.operating_margin_pct?.toFixed(1)??"—"}% | Net ${facts.net_margin_pct?.toFixed(1)??"—"}%
Valuation: P/E ${facts.pe_ratio?.toFixed(1)??"—"}x | EV/EBITDA ${facts.ev_ebitda?.toFixed(1)??"—"}x | P/FCF ${facts.p_fcf?.toFixed(1)??"—"}x
Rev 5Y CAGR: ${(revCAGRYrs*100).toFixed(1)}% | FCF/NI: ${facts.free_cash_flow&&facts.net_income&&facts.net_income>0?(facts.free_cash_flow/facts.net_income*100).toFixed(0)??"—":0}%
ROIC: ${facts.roic?.toFixed(1)??"—"}% | Market Cap: ${abbr(facts.market_cap||0,"$")} | Sector: ${sector}
Monte Carlo P95/P5: ${monteCarloResults.p95!=null?abbr(monteCarloResults.p95,"$"):"N/A"} / ${monteCarloResults.p5!=null?abbr(monteCarloResults.p5,"$"):"N/A"} | Prob above current: ${monteCarloResults.pUp!=null?monteCarloResults.pUp.toFixed(0)+"%":"N/A"}

EARNINGS EXECUTION:
Beat rate: ${earningsSurprises.length>0?`${earningsStreak.beats}/${earningsStreak.total} (${Math.round(earningsStreak.beats/Math.max(earningsStreak.total,1)*100)}%)`:"-"} | Current streak: ${earningsStreak.streak}× | Avg beat: ${earningsStreak.avgBeatMag!=null?`+${earningsStreak.avgBeatMag.toFixed(1)}%`:"-"}
Recent surprises: ${earningsSurprises.slice(0,4).map(e=>`${e.date?.slice(0,7)??"?"}: ${e.surprise_pct!=null?(e.surprise_pct>0?"+":"")+(e.surprise_pct?.toFixed(1)??"?")+"%":""}`).join(", ")}

PEER COMPARISON (vs ${peers.length} peers):
${peers.slice(0,5).map(p=>`${p.symbol}: P/E ${p.pe?.toFixed(1)??"—"}x | EV/EBITDA ${p.ev_ebitda?.toFixed(1)??"—"}x | GM ${p.gross_margin?.toFixed(1)??"—"}% | ROIC ${p.roic?.toFixed(1)??"—"}% | Rev/Emp $${p.rev_per_emp?.toFixed(0)??"—"}K`).join("\n")}
Subject vs median: GM ${relativeValue.gmDiff!=null?(relativeValue.gmDiff>0?"+":"")+relativeValue.gmDiff.toFixed(1)+"pp":"-"} | P/E premium ${relativeValue.pePrem!=null?(relativeValue.pePrem>0?"+":"")+relativeValue.pePrem.toFixed(0)+"%":"-"}

MARKET POSITIONING:
52W Range: ${facts.week52_low!=null&&facts.week52_high!=null?`$${facts.week52_low?.toFixed(0)}–$${facts.week52_high?.toFixed(0)} | Current $${facts.stock_price?.toFixed(0)} (${facts.week52_low&&facts.week52_high&&facts.stock_price?((facts.stock_price-facts.week52_low)/(facts.week52_high-facts.week52_low)*100).toFixed(0):"?"}th pctile)`:"-"}
Short Interest: ${facts.short_float_pct!=null?`${facts.short_float_pct.toFixed(1)}% of float, ${facts.short_ratio?.toFixed(1)??"?"}d to cover`:"-"}
Analyst PT: ${facts.pt_consensus!=null?`$${facts.pt_consensus.toFixed(0)} (${facts.stock_price?((facts.pt_consensus/facts.stock_price-1)*100).toFixed(0)+"% upside":"-"}) | ${analystRec?`${analystRec.strong_buy+analystRec.buy}B/${analystRec.hold}H/${analystRec.sell+analystRec.strong_sell}S`:"-"}`:"-"}
Insider Activity: ${insiderTrading.length>0?`${insiderTrading.filter(t=>/purchase|buy/i.test(t.transaction||"")).length} buys / ${insiderTrading.filter(t=>/sale|sell/i.test(t.transaction||"")).length} sells (last ${insiderTrading.length} transactions)`:"-"}

Write 7 sections with bold headers:
**PATTERN RECOGNITION** — 3 non-obvious statistical patterns in margins/FCF/growth trajectory
**EARNINGS QUALITY** — FCF/NI, accruals, SBC dilution, earnings surprise trend — score 1-10
**VALUATION** — Fair value range using 3 methods (DCF, relative, reverse DCF). Current implied growth rate.
**COMPETITIVE MOAT** — ROIC vs WACC spread, margin structure vs peers, sustainability
**QUANTITATIVE RISK** — Top 3 specific measurable risk factors with probability and magnitude
**ALPHA TRIGGER** — The single most actionable catalyst in next 12 months
**VERDICT** — BUY / HOLD / AVOID with precise price target and key assumption

Be institutional-grade. Use specific numbers. 700-900 words total.`,
    };
    try {
      const r=await fetch("/api/sec",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if (!r.ok||!r.body) throw new Error(`HTTP ${r.status}`);
      const reader=r.body.getReader();const dec=new TextDecoder();
      while(true){
        const{done,value}=await reader.read();if(done)break;
        for(const line of dec.decode(value,{stream:true}).split("\n")){
          const raw=line.startsWith("data: ")?line.slice(6).trim():null;
          if(!raw||raw==="[DONE]")continue;
          try{const j=JSON.parse(raw);if(j.text)setAiText(p=>p+j.text);}catch{}
        }
      }
    } catch(e){setAiText(`Error: ${e instanceof Error?e.message:"Unknown"}`);
    } finally{setAiRunning(false);}
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between gap-4" style={{background:"linear-gradient(135deg,#071428 0%,#0c1b38 60%,#152a55 100%)"}}>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1">Financial Analytics Suite</p>
          <h3 className="text-[16px] font-bold text-white leading-tight">{companyName}</h3>
          <p className="text-[10.5px] text-white/35 mt-0.5">8 tabs · 60+ charts · EVA Engine · Football Field · 5-Factor Model · Beneish · Magic Formula · Estimate Revisions · Rev/Employee · AI</p>
          {/* Quant scores row */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[8px] font-bold px-2 py-0.5 rounded" style={{background:`rgba(${qualityScore>=70?"16,185,129":qualityScore>=40?"245,158,11":"239,68,68"},0.15)`,color:qualityScore>=70?GREEN:qualityScore>=40?AMBER:RED}}>
              Quality {qualityScore}/100
            </span>
            {piotroski.maxScore>0&&(
              <span className="text-[8px] font-bold px-2 py-0.5 rounded" style={{background:"rgba(255,255,255,0.06)",color:piotroski.score>=7?GREEN:piotroski.score>=4?AMBER:RED}}>
                Piotroski {piotroski.score}/{piotroski.maxScore}
              </span>
            )}
            {altmanZ&&(
              <span className="text-[8px] font-bold px-2 py-0.5 rounded" style={{background:"rgba(255,255,255,0.06)",color:altmanZ.color}}>
                Altman Z {altmanZ.z} · {altmanZ.zone}
              </span>
            )}
            {fmpRating&&(
              <span className="text-[8px] font-bold px-2 py-0.5 rounded" style={{background:"rgba(96,165,250,0.12)",color:"#60a5fa"}}>
                {fmpRating}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {facts.pe_ratio&&<span className="text-[9px] font-bold text-[#60a5fa]">P/E {facts.pe_ratio.toFixed(1)}x · EV/EBITDA {facts.ev_ebitda?.toFixed(1)??"—"}x</span>}
          <button onClick={runAI} disabled={aiRunning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-bold transition-all shrink-0"
            style={{background:aiRunning?"#1e3560":"rgba(96,165,250,0.15)",border:"1px solid rgba(96,165,250,0.3)",color:"#93c5fd"}}>
            {aiRunning
              ?<><span className="w-3 h-3 border border-[#60a5fa] border-t-transparent rounded-full animate-spin"/>Analyzing…</>
              :<><Sparkles size={12}/>Deep AI Analysis</>}
          </button>
        </div>
      </div>

      {/* AI output */}
      {aiText&&(
        <div className="border-b border-[#1e3560] px-5 py-4" style={{background:"#040d1c"}}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#3b82f6]"/>
            <p className="text-[8.5px] font-bold uppercase tracking-widest text-[#60a5fa]">Hedge Fund AI Analysis — {ticker}</p>
          </div>
          <div>
            {aiText.split("\n").map((line,i)=>{
              const t=line.trim();if(!t)return<div key={i} className="h-1.5"/>;
              if(t.startsWith("**")&&t.endsWith("**")&&!t.slice(2,-2).includes("**"))
                return<p key={i} className="text-[9px] font-bold uppercase tracking-widest mt-4 mb-1.5 first:mt-0" style={{color:"#60a5fa"}}>{t.slice(2,-2)}</p>;
              if(t.startsWith("- ")||t.startsWith("• "))
                return<p key={i} className="text-[11.5px] leading-[1.7] pl-3 border-l border-[#1e3560] mb-0.5" style={{color:"#cbd5e1"}}>· {t.slice(2)}</p>;
              return<p key={i} className="text-[11.5px] leading-[1.75]" style={{color:"#cbd5e1"}}>{t}</p>;
            })}
          </div>
        </div>
      )}

      {/* Key Stats Banner */}
      <div className="flex overflow-x-auto gap-0 border-b" style={{background:"#040d1c",borderColor:DARK_BORDER}}>
        {[
          { label:"Rev", value:abbr(facts.revenue||0,"$"), sub:facts.revenue_growth_yoy!=null?`${facts.revenue_growth_yoy>0?"+":""}${facts.revenue_growth_yoy.toFixed(1)}% YoY`:undefined, color:"#ffffff70" },
          { label:"Gross Margin", value:facts.gross_margin_pct!=null?`${facts.gross_margin_pct.toFixed(1)}%`:"—", color:facts.gross_margin_pct&&facts.gross_margin_pct>50?GREEN:AMBER },
          { label:"Op Margin", value:facts.operating_margin_pct!=null?`${facts.operating_margin_pct.toFixed(1)}%`:"—", color:facts.operating_margin_pct&&facts.operating_margin_pct>20?GREEN:facts.operating_margin_pct&&facts.operating_margin_pct>0?AMBER:RED },
          { label:"Net Margin", value:facts.net_margin_pct!=null?`${facts.net_margin_pct.toFixed(1)}%`:"—", color:facts.net_margin_pct&&facts.net_margin_pct>15?GREEN:facts.net_margin_pct&&facts.net_margin_pct>0?AMBER:RED },
          { label:"ROIC", value:facts.roic!=null?`${facts.roic.toFixed(1)}%`:"—", color:facts.roic&&facts.roic>15?GREEN:facts.roic&&facts.roic>9?AMBER:RED },
          { label:"P/E", value:facts.pe_ratio!=null?`${facts.pe_ratio.toFixed(1)}x`:"—", color:"#ffffff70" },
          { label:"EV/EBITDA", value:facts.ev_ebitda!=null?`${facts.ev_ebitda.toFixed(1)}x`:"—", color:"#ffffff70" },
          { label:"P/FCF", value:facts.p_fcf!=null?`${facts.p_fcf.toFixed(1)}x`:"—", color:"#ffffff70" },
          { label:"Mkt Cap", value:abbr(facts.market_cap||0,"$"), color:"#ffffff70" },
          { label:"Beta", value:facts.beta!=null?facts.beta.toFixed(2):"—", color:facts.beta&&facts.beta>1.5?RED:facts.beta&&facts.beta<0.8?GREEN:"#ffffff70" },
          ...(facts.short_float_pct!=null?[{ label:"Short %", value:`${facts.short_float_pct.toFixed(1)}%`, sub:facts.short_ratio!=null?`${facts.short_ratio.toFixed(1)}d cover`:undefined, color:facts.short_float_pct>15?RED:facts.short_float_pct>5?AMBER:"#ffffff70" }]:[]),
          ...(facts.next_earnings_ts?(()=>{const d=Math.ceil((facts.next_earnings_ts*1000-Date.now())/(864e5));return d>0&&d<120?[{label:"Earnings In",value:`${d}d`,color:d<=14?AMBER:BLUE}]:[];})():[]),
          ...(facts.pt_consensus?[{ label:"PT Consensus", value:abbr(facts.pt_consensus,"$"), sub:facts.stock_price?`${((facts.pt_consensus/facts.stock_price-1)*100).toFixed(0)}% upside`:undefined, color:facts.stock_price&&facts.pt_consensus>facts.stock_price?GREEN:RED }]:[]),
        ].map((s,i)=>(
          <div key={i} className="flex flex-col items-center px-3.5 py-2.5 shrink-0 border-r" style={{borderColor:DARK_BORDER}}>
            <p className="text-[7px] font-bold uppercase tracking-widest mb-0.5" style={{color:"#ffffff25"}}>{s.label}</p>
            <p className="text-[11px] font-bold tabular-nums" style={{color:s.color}}>{s.value}</p>
            {s.sub&&<p className="text-[7.5px] mt-0.5" style={{color:"#ffffff30"}}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex overflow-x-auto border-b" style={{background:"#04090f",borderColor:DARK_BORDER}}>
        {CATS.map(cat=>{
          const Icon=cat.icon;const isA=tab===cat.id;
          return(
            <button key={cat.id} onClick={()=>setTab(cat.id)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-[9.5px] font-bold uppercase tracking-wide whitespace-nowrap border-b-2 transition-all"
              style={{borderColor:isA?"#3b82f6":"transparent",color:isA?"#60a5fa":"#ffffff30",background:isA?"rgba(59,130,246,0.07)":"transparent"}}>
              <Icon size={9}/>{cat.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Summary Pill Row ─────────────────────────────────────── */}
      {(()=>{
        type Pill={label:string;value:string;color:string};
        let pills:Pill[]=[];
        if(tab==="growth"){
          const revCAGR5=(()=>{const v=Object.values(history.revenue||{});return v.length>=2?(Math.pow(v[v.length-1]/Math.max(v[0],1),1/Math.max(v.length-1,1))-1)*100:null;})();
          const epsCAGR5=(()=>{const v=Object.values(history.eps_diluted||{}).filter(x=>x>0);return v.length>=2?(Math.pow(v[v.length-1]/Math.max(v[0],0.001),1/Math.max(v.length-1,1))-1)*100:null;})();
          pills=[
            {label:"5Y Rev CAGR",value:revCAGR5!=null?`${revCAGR5>0?"+":""}${revCAGR5.toFixed(1)}%`:"—",color:revCAGR5!=null&&revCAGR5>10?GREEN:AMBER},
            {label:"Rev YoY",value:facts.revenue_growth_yoy!=null?`${facts.revenue_growth_yoy>0?"+":""}${facts.revenue_growth_yoy.toFixed(1)}%`:"—",color:facts.revenue_growth_yoy!=null&&facts.revenue_growth_yoy>10?GREEN:facts.revenue_growth_yoy!=null&&facts.revenue_growth_yoy>0?AMBER:RED},
            {label:"5Y EPS CAGR",value:epsCAGR5!=null?`${epsCAGR5.toFixed(1)}%`:"—",color:epsCAGR5!=null&&epsCAGR5>10?GREEN:AMBER},
            {label:"Beat Rate",value:earningsStreak.total>0?`${earningsStreak.beats}/${earningsStreak.total}Q`:"—",color:earningsStreak.total>0&&earningsStreak.beats/earningsStreak.total>=0.75?GREEN:AMBER},
            {label:"Streak",value:earningsStreak.streak>0?`${earningsStreak.streak}× beat`:"—",color:earningsStreak.streak>=3?GREEN:earningsStreak.streak>=1?AMBER:"#ffffff30"},
          ];
        } else if(tab==="margins"){
          const peerGM=peers.length>0?(peers.map(p=>p.gross_margin??null).filter((v):v is number=>v!=null).sort((a,b)=>a-b)[Math.floor(peers.length/2)]??null):null;
          pills=[
            {label:"Gross Margin",value:facts.gross_margin_pct!=null?`${facts.gross_margin_pct.toFixed(1)}%`:"—",color:facts.gross_margin_pct!=null&&facts.gross_margin_pct>50?GREEN:facts.gross_margin_pct!=null&&facts.gross_margin_pct>30?AMBER:RED},
            {label:"vs Peers",value:peerGM!=null&&facts.gross_margin_pct!=null?`${facts.gross_margin_pct-peerGM>0?"+":""}${(facts.gross_margin_pct-peerGM).toFixed(1)}pp`:"—",color:peerGM!=null&&facts.gross_margin_pct!=null&&facts.gross_margin_pct>peerGM?GREEN:RED},
            {label:"Op Margin",value:facts.operating_margin_pct!=null?`${facts.operating_margin_pct.toFixed(1)}%`:"—",color:facts.operating_margin_pct!=null&&facts.operating_margin_pct>20?GREEN:facts.operating_margin_pct!=null&&facts.operating_margin_pct>0?AMBER:RED},
            {label:"EBITDA Margin",value:facts.ebitda&&facts.revenue?`${(facts.ebitda/facts.revenue*100).toFixed(1)}%`:"—",color:AMBER},
            {label:"SBC Dilution",value:facts.sbc_expense&&facts.revenue?`${(facts.sbc_expense/facts.revenue*100).toFixed(1)}%`:"—",color:facts.sbc_expense&&facts.revenue&&facts.sbc_expense/facts.revenue>0.10?RED:AMBER},
          ];
        } else if(tab==="cashflow"){
          const fcfMargin=facts.free_cash_flow&&facts.revenue?facts.free_cash_flow/facts.revenue*100:null;
          const fcfYield=facts.free_cash_flow&&facts.market_cap?facts.free_cash_flow/facts.market_cap*100:null;
          const ocfNI=facts.operating_cf&&facts.net_income&&facts.net_income>0?facts.operating_cf/facts.net_income:null;
          pills=[
            {label:"FCF Margin",value:fcfMargin!=null?`${fcfMargin.toFixed(1)}%`:"—",color:fcfMargin!=null&&fcfMargin>15?GREEN:fcfMargin!=null&&fcfMargin>5?AMBER:RED},
            {label:"FCF Yield",value:fcfYield!=null?`${fcfYield.toFixed(1)}%`:"—",color:fcfYield!=null&&fcfYield>4?GREEN:AMBER},
            {label:"OCF/NI",value:ocfNI!=null?`${ocfNI.toFixed(2)}x`:"—",color:ocfNI!=null&&ocfNI>=0.9?GREEN:ocfNI!=null&&ocfNI>=0.6?AMBER:RED},
            {label:"CapEx %",value:facts.capex&&facts.revenue?`${(Math.abs(facts.capex)/facts.revenue*100).toFixed(1)}%`:"—",color:BLUE},
            {label:"SH Yield",value:capitalReturns.totalYield>0?`${capitalReturns.totalYield.toFixed(1)}%`:"—",color:capitalReturns.totalYield>4?GREEN:capitalReturns.totalYield>2?TEAL:AMBER},
          ];
        } else if(tab==="balance"){
          const netDebtB=(facts.long_term_debt??0)-(facts.cash??0);
          const ndEbitda=facts.ebitda&&facts.ebitda>0?netDebtB/facts.ebitda:null;
          const cr=facts.current_assets&&facts.current_liabilities&&facts.current_liabilities>0?facts.current_assets/facts.current_liabilities:null;
          pills=[
            {label:"Net Debt",value:netDebtB>=0?abbr(netDebtB,"$"):`Net Cash ${abbr(-netDebtB,"$")}`,color:netDebtB<0?GREEN:netDebtB>facts.ebitda*3?RED:AMBER},
            {label:"ND/EBITDA",value:ndEbitda!=null?`${ndEbitda.toFixed(1)}x`:"—",color:ndEbitda!=null&&ndEbitda<2?GREEN:ndEbitda!=null&&ndEbitda<4?AMBER:RED},
            {label:"Current Ratio",value:cr!=null?`${cr.toFixed(2)}x`:"—",color:cr!=null&&cr>2?GREEN:cr!=null&&cr>1?AMBER:RED},
            {label:"Altman Z",value:altmanZ?`${altmanZ.z} (${altmanZ.zone})`:"—",color:altmanZ?.color??AMBER},
          ];
        } else if(tab==="multiples"){
          pills=[
            {label:"P/E",value:facts.pe_ratio!=null?`${facts.pe_ratio.toFixed(1)}x`:"—",color:"#ffffff70"},
            {label:"EV/EBITDA",value:facts.ev_ebitda!=null?`${facts.ev_ebitda.toFixed(1)}x`:"—",color:"#ffffff70"},
            {label:"FCF Yield",value:facts.free_cash_flow&&facts.market_cap?`${(facts.free_cash_flow/facts.market_cap*100).toFixed(1)}%`:"—",color:facts.free_cash_flow&&facts.market_cap&&facts.free_cash_flow/facts.market_cap>0.04?GREEN:AMBER},
            {label:"PEG",value:relativeValue.peg!=null?`${relativeValue.peg.toFixed(2)}x`:"—",color:relativeValue.peg!=null&&relativeValue.peg<1?GREEN:relativeValue.peg!=null&&relativeValue.peg<2?AMBER:RED},
            {label:"Implied Growth",value:reverseDCF?`${reverseDCF.impliedGrowth}%`:"—",color:BLUE},
          ];
        } else if(tab==="quality"){
          pills=[
            {label:"Quality Score",value:`${qualityScore}/100`,color:qualityScore>=70?GREEN:qualityScore>=40?AMBER:RED},
            {label:"Piotroski",value:`${piotroski.score}/${piotroski.maxScore}`,color:piotroski.score>=7?GREEN:piotroski.score>=4?AMBER:RED},
            {label:"ROIC",value:facts.roic!=null?`${facts.roic.toFixed(1)}%`:"—",color:facts.roic!=null&&facts.roic>15?GREEN:facts.roic!=null&&facts.roic>9?AMBER:RED},
            {label:"Avg Beat",value:earningsStreak.avgBeatMag!=null?`+${earningsStreak.avgBeatMag.toFixed(1)}%`:"—",color:earningsStreak.avgBeatMag!=null&&earningsStreak.avgBeatMag>3?GREEN:AMBER},
          ];
        } else if(tab==="quant"){
          const monteP=monteCarloResults.pUp!=null?monteCarloResults.pUp:null;
          pills=[
            {label:"Factor Score",value:`${factorScores.overall}/100`,color:factorScores.overall>=70?GREEN:factorScores.overall>=40?AMBER:RED},
            {label:"Mkt-Implied Rev CAGR",value:reverseDCF?`${reverseDCF.impliedGrowth}%`:"—",color:BLUE},
            {label:"Monte Carlo P(Up)",value:monteP!=null?`${monteP.toFixed(0)}%`:"—",color:monteP!=null&&monteP>60?GREEN:monteP!=null&&monteP>40?AMBER:RED},
            {label:"Beneish M",value:beneishMScore?`${beneishMScore.score.toFixed(2)}`:"—",color:beneishMScore?.color??AMBER},
          ];
        } else if(tab==="signals"){
          const tripwireGreen=8-[...Array(8)].filter((_,i)=>false).length; // computed inline below
          const insidNetBuys=(insiderTrading.filter(t=>/purchase|buy/i.test(t.transaction||"")).length)-(insiderTrading.filter(t=>/sale|sell/i.test(t.transaction||"")).length);
          pills=[
            {label:"Verdict",value:investmentThesis.verdict,color:investmentThesis.verdictColor},
            {label:"Factor Score",value:`${investmentThesis.score}/100`,color:investmentThesis.verdictColor},
            {label:"Beat Streak",value:earningsStreak.streak>0?`${earningsStreak.streak}× consec`:"0×",color:earningsStreak.streak>=3?GREEN:earningsStreak.streak>=1?TEAL:RED},
            {label:"Insider",value:insiderTrading.length>0?(insidNetBuys>0?`+${insidNetBuys} net buy`:insidNetBuys<0?`${insidNetBuys} net sell`:"neutral"):"—",color:insidNetBuys>1?GREEN:insidNetBuys<-1?RED:AMBER},
          ];
        }
        if(!pills.length) return null;
        return(
          <div className="flex items-center gap-0 overflow-x-auto border-b px-4 py-1.5" style={{background:"rgba(4,13,28,0.9)",borderColor:DARK_BORDER}}>
            {pills.map((p,i)=>(
              <div key={i} className="flex items-center gap-2 shrink-0 pr-4 mr-4 border-r last:border-r-0" style={{borderColor:DARK_BORDER}}>
                <span className="text-[7px] uppercase font-bold tracking-widest" style={{color:"#ffffff20"}}>{p.label}</span>
                <span className="text-[9px] font-bold tabular-nums" style={{color:p.color}}>{p.value}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Charts */}
      <div className="p-4" style={{background:DARK_BG}}>

        {/* ── Revenue & Growth ──────────────────────────────────────── */}
        {tab==="growth"&&(
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Card title="Revenue — 5-Year" sub="Annual | YoY growth labels" badge="5Y CAGR">
              <BarChart data={H("revenue",revYears)} color={BLUE} showGrowth/>
            </Card>
            <Card title="EPS Diluted" sub="Earnings per share | growth">
              <BarChart data={H("eps_diluted",epsYears)} color={AMBER} showGrowth/>
            </Card>
            <Card title="Revenue vs Op Income Growth" sub="Operating leverage signal">
              <GroupedBar
                groups={revYears.slice(1)}
                series={[
                  {name:"Rev %",values:revGrowth,color:BLUE},
                  {name:"Op Inc %",values:oiGrowth,color:GREEN},
                ]}
                pct
              />
            </Card>
            <Card title="Gross Profit vs COGS" sub="Revenue decomposition">
              <StackedBar
                labels={revYears}
                series={[
                  {name:"Gross Profit",values:revYears.map(y=>history.gross_profit?.[y]??0),color:TEAL},
                  {name:"COGS",values:revYears.map(y=>history.cost_of_revenue?.[y]??0),color:"#1e3560"},
                ]}
              />
            </Card>
            <Card title="OpEx Breakdown" sub="R&D + SG&A + SBC stacked">
              <StackedBar
                labels={opexYears}
                series={[
                  {name:"R&D",values:opexYears.map(y=>history.rd_expense?.[y]??0),color:BLUE},
                  {name:"SG&A",values:opexYears.map(y=>history.sga_expense?.[y]??0),color:TEAL},
                  {name:"SBC",values:opexYears.map(y=>history.sbc_expense?.[y]??0),color:PURPLE},
                ]}
              />
            </Card>
            <Card title="Q Run-Rate vs Annual" sub="Quarterly×4 implied vs last 10-K">
              <BarChart
                data={[
                  {label:"10-K Annual",value:facts.revenue??0},
                  {label:"Q×4 Implied",value:(quarterly.revenue??0)*4,highlight:true},
                ]}
                color={BLUE}
              />
            </Card>
            {quarterlyTrends.length>=4&&(
              <Card title="8-Quarter Revenue Trend" sub="Sequential quarterly revenue | seasonal pattern" badge="QoQ">
                <BarChart
                  data={quarterlyTrends.map(q=>({label:q.date?.slice(0,7)??"",value:q.revenue??0}))}
                  color={BLUE} showGrowth
                />
              </Card>
            )}
            {quarterlyTrends.length>=4&&(
              <Card title="Quarterly Margin Trend" sub="Gross / Op / Net margins per quarter">
                <LineChart
                  labels={quarterlyTrends.map(q=>q.date?.slice(0,7)??"" )}
                  series={[
                    {name:"Gross %",values:quarterlyTrends.map(q=>q.gross_margin_pct??null),color:TEAL},
                    {name:"Op %",values:quarterlyTrends.map(q=>q.operating_margin_pct??null),color:BLUE},
                    {name:"Net %",values:quarterlyTrends.map(q=>q.net_margin_pct??null),color:GREEN},
                  ]}
                  pct
                />
              </Card>
            )}
            {quarterlyTrends.length>=4&&(
              <Card title="Quarterly EPS Diluted" sub="Per-share earnings cadence">
                <BarChart
                  data={quarterlyTrends.map(q=>({label:q.date?.slice(0,7)??"",value:q.eps_diluted??0}))}
                  color={AMBER} showGrowth
                />
              </Card>
            )}
            {/* ══ Quarterly YoY Growth Acceleration ══ */}
            {quarterlyTrends.length>=8&&(()=>{
              const sorted=[...quarterlyTrends].sort((a,b)=>a.date.localeCompare(b.date));
              // YoY: compare to same quarter last year (4 periods back)
              const yoyData=sorted.slice(4).map((q,i)=>{
                const prev=sorted[i]; // 4 quarters back
                const revYoY=q.revenue&&prev.revenue&&prev.revenue>0?(q.revenue-prev.revenue)/prev.revenue*100:null;
                const gmYoY=q.gross_margin_pct!=null&&prev.gross_margin_pct!=null?q.gross_margin_pct-prev.gross_margin_pct:null;
                return{date:q.date?.slice(0,7)??"",revYoY,gmYoY};
              });
              const allRevYoY=yoyData.map(d=>d.revYoY).filter((v):v is number=>v!=null);
              const isAccelerating=allRevYoY.length>=2&&allRevYoY[allRevYoY.length-1]>allRevYoY[allRevYoY.length-2];
              const W=320, H=110;
              const vals=yoyData.map(d=>d.revYoY);
              const validVals=vals.filter((v):v is number=>v!=null);
              if(validVals.length<2) return null;
              const minV=Math.min(...validVals), maxV=Math.max(...validVals);
              const pad={t:18,b:22,l:30,r:10};
              const toX=(i:number)=>pad.l+(i/(yoyData.length-1||1))*(W-pad.l-pad.r);
              const toY=(v:number)=>pad.t+((maxV-v)/(maxV-minV||1))*(H-pad.t-pad.b);
              const zero=toY(Math.max(0,minV));
              const pts=yoyData.map((d,i)=>d.revYoY!=null?`${toX(i)},${toY(d.revYoY)}`:"").filter(Boolean).join(" ");
              return(
              <Card title="Quarterly YoY Revenue Growth Rate" sub="Same-quarter vs prior year — watch for acceleration/deceleration" badge={isAccelerating?"ACCELERATING ▲":"DECELERATING ▼"}>
                <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
                  {/* Zero line */}
                  <line x1={pad.l} x2={W-pad.r} y1={zero} y2={zero} stroke={DARK_BORDER} strokeWidth="0.8" strokeDasharray="3,2"/>
                  {/* Shaded area under curve */}
                  {validVals.length>=2&&(
                    <polygon
                      points={`${pts} ${toX(yoyData.length-1)},${zero} ${toX(0)},${zero}`}
                      fill={isAccelerating?GREEN:RED} fillOpacity="0.08"
                    />
                  )}
                  {/* Line */}
                  <polyline points={pts} fill="none" stroke={isAccelerating?GREEN:AMBER} strokeWidth="1.5" strokeLinejoin="round"/>
                  {/* Data points */}
                  {yoyData.map((d,i)=>d.revYoY!=null&&(
                    <g key={i}>
                      <circle cx={toX(i)} cy={toY(d.revYoY)} r={i===yoyData.length-1?3.5:2} fill={d.revYoY>0?GREEN:RED}/>
                      {i===yoyData.length-1&&<text x={toX(i)} y={toY(d.revYoY)-5} textAnchor="middle" fontSize="7" fill={AMBER}>{d.revYoY.toFixed(1)}%</text>}
                    </g>
                  ))}
                  {/* X-axis labels */}
                  {yoyData.filter((_,i)=>i%2===0||i===yoyData.length-1).map((d,_,arr)=>{
                    const origIdx=yoyData.indexOf(d);
                    return<text key={origIdx} x={toX(origIdx)} y={H-5} textAnchor="middle" fontSize="5.5" fill="#ffffff25">{d.date}</text>;
                  })}
                  {/* Y-axis */}
                  {[minV,0,maxV].map((v,i)=>(
                    <text key={i} x={pad.l-3} y={toY(v)+3} textAnchor="end" fontSize="5.5" fill="#ffffff25">{v.toFixed(0)}%</text>
                  ))}
                </svg>
                {/* Gross margin trend overlay note */}
                {yoyData.some(d=>d.gmYoY!=null)&&(()=>{
                  const lastGmYoY=yoyData[yoyData.length-1].gmYoY;
                  return lastGmYoY!=null&&<p className="text-[7px] mt-1" style={{color:lastGmYoY>0?GREEN:RED}}>Gross margin {lastGmYoY>0?"expanded":"contracted"} {Math.abs(lastGmYoY).toFixed(1)}pp YoY in last quarter</p>;
                })()}
              </Card>
              );
            })()}

            {/* ══ LOOP 19: Forward Estimates Bridge ══ */}
            {analystEstimates.length>0&&(()=>{
              const sortedEst=[...analystEstimates].sort((a,b)=>a.date.localeCompare(b.date));
              const histRevYears=revYears.slice(-3);
              const histRevData=histRevYears.map(y=>({label:y.slice(0,4),value:history.revenue?.[y]??0,historical:true}));
              const fwdRevData=sortedEst.map(e=>({label:e.date?.slice(0,7)??"",value:e.rev_avg??0,historical:false}));
              const allRevData=[...histRevData,...fwdRevData].filter(d=>d.value>0);
              const maxRevVal=Math.max(...allRevData.map(d=>d.value));
              const W=320, H=150;
              const bw=Math.max(10,Math.floor((W-PAD.l-PAD.r)/Math.max(allRevData.length,1)-4));
              const step=(W-PAD.l-PAD.r)/Math.max(allRevData.length,1);
              const toX=(i:number)=>PAD.l+i*step+step/2;
              const toY=(v:number)=>PAD.t+(1-(v/maxRevVal))*(H-PAD.t-PAD.b);
              return(
              <Card title="Revenue: Actuals → Forward Consensus" sub="3Y history + analyst estimates (lighter = forward)" badge="CONSENSUS">
                <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
                  <line x1={PAD.l} x2={W-PAD.r} y1={H-PAD.b} y2={H-PAD.b} stroke={DARK_BORDER} strokeWidth="0.8"/>
                  {/* Divider: historical vs forward */}
                  {histRevData.length>0&&fwdRevData.length>0&&(
                    <line x1={toX(histRevData.length-1)+bw/2+4} x2={toX(histRevData.length-1)+bw/2+4} y1={PAD.t} y2={H-PAD.b} stroke={AMBER} strokeWidth="0.8" strokeDasharray="3,3" opacity="0.5"/>
                  )}
                  {allRevData.map((d,i)=>{
                    const x=toX(i)-bw/2, y=toY(d.value), barH=H-PAD.b-y;
                    const col=d.historical?BLUE:TEAL;
                    return(
                      <g key={i}>
                        <rect x={x} y={y} width={bw} height={barH} fill={col} opacity={d.historical?0.8:0.4} rx="1.5"/>
                        <text x={x+bw/2} y={H-PAD.b+11} textAnchor="middle" fontSize="6" fill="#ffffff40">{d.label}</text>
                        <text x={x+bw/2} y={y-2} textAnchor="middle" fontSize="6.5" fill={col} opacity={d.historical?0.9:0.7}>{d.value>=1e9?`$${(d.value/1e9).toFixed(1)}B`:d.value>=1e6?`$${(d.value/1e6).toFixed(0)}M`:""}</text>
                      </g>
                    );
                  })}
                  <text x={toX(0)} y={PAD.t-4} textAnchor="middle" fontSize="6" fill={BLUE} opacity="0.7">Actual</text>
                  {fwdRevData.length>0&&<text x={toX(histRevData.length)} y={PAD.t-4} textAnchor="middle" fontSize="6" fill={TEAL} opacity="0.7">Consensus</text>}
                </svg>
              </Card>
              );
            })()}
            {analystEstimates.length>0&&(()=>{
              const sortedEst=[...analystEstimates].sort((a,b)=>a.date.localeCompare(b.date));
              const histEpsYears=epsYears.slice(-3);
              const histEpsData=histEpsYears.map(y=>({label:y.slice(0,4),value:history.eps_diluted?.[y]??0,historical:true}));
              const fwdEpsData=sortedEst.filter(e=>e.eps_avg!=null).map(e=>({label:e.date?.slice(0,7)??"",value:e.eps_avg!,historical:false}));
              const allEpsData=[...histEpsData,...fwdEpsData].filter(d=>d.value!==0);
              if(!allEpsData.length) return null;
              const maxEpsVal=Math.max(...allEpsData.map(d=>Math.abs(d.value)),0.01);
              const W=320, H=150;
              const bw=Math.max(10,Math.floor((W-PAD.l-PAD.r)/Math.max(allEpsData.length,1)-4));
              const step=(W-PAD.l-PAD.r)/Math.max(allEpsData.length,1);
              const toX=(i:number)=>PAD.l+i*step+step/2;
              const toY=(v:number)=>PAD.t+(1-(v/maxEpsVal))*(H-PAD.t-PAD.b);
              return(
              <Card title="EPS: Actuals → Forward Consensus" sub="3Y EPS history + analyst estimates" badge="EPS BRIDGE">
                <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
                  <line x1={PAD.l} x2={W-PAD.r} y1={H-PAD.b} y2={H-PAD.b} stroke={DARK_BORDER} strokeWidth="0.8"/>
                  {histEpsData.length>0&&fwdEpsData.length>0&&(
                    <line x1={toX(histEpsData.length-1)+bw/2+4} x2={toX(histEpsData.length-1)+bw/2+4} y1={PAD.t} y2={H-PAD.b} stroke={AMBER} strokeWidth="0.8" strokeDasharray="3,3" opacity="0.5"/>
                  )}
                  {allEpsData.map((d,i)=>{
                    const x=toX(i)-bw/2, y=toY(Math.max(0,d.value)), barH=H-PAD.b-y;
                    const col=d.historical?AMBER:PURPLE;
                    return(
                      <g key={i}>
                        <rect x={x} y={y} width={bw} height={Math.max(1,barH)} fill={col} opacity={d.historical?0.8:0.4} rx="1.5"/>
                        <text x={x+bw/2} y={H-PAD.b+11} textAnchor="middle" fontSize="6" fill="#ffffff40">{d.label}</text>
                        <text x={x+bw/2} y={y-2} textAnchor="middle" fontSize="6.5" fill={col} opacity={d.historical?0.9:0.7}>{d.value>=0?`$${d.value.toFixed(2)}`:""}</text>
                      </g>
                    );
                  })}
                </svg>
              </Card>
              );
            })()}
          </div>
        )}

        {/* ── Profitability ─────────────────────────────────────────── */}
        {tab==="margins"&&(
          <div className="space-y-3">
          {/* ══ LOOP 14: Quarterly Earnings Heat Table ══ */}
          {quarterlyTrends.length>=4&&(
            <div className="rounded-lg overflow-hidden border" style={{background:CARD_BG,borderColor:DARK_BORDER}}>
              <div className="px-3 py-2 border-b flex items-center justify-between" style={{borderColor:DARK_BORDER}}>
                <div>
                  <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff45"}}>Quarterly Earnings Cadence</p>
                  <p className="text-[7.5px] mt-0.5" style={{color:"#ffffff20"}}>8-quarter heat map · Green = QoQ acceleration · Amber = most recent quarter · Arrow = QoQ change</p>
                </div>
                <span className="text-[7px] px-1.5 py-0.5 rounded font-bold" style={{background:"rgba(20,184,166,0.15)",color:TEAL,border:"1px solid rgba(20,184,166,0.25)"}}>HEAT MAP</span>
              </div>
              <div className="px-3 py-3">
                <QuarterlyHeatTable data={quarterlyTrends}/>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Card title="Margin Evolution" sub="Gross / Operating / Net (%)">
              <LineChart labels={revYears} series={[{name:"Gross %",values:gMarg,color:TEAL},{name:"Op %",values:oMarg,color:BLUE},{name:"Net %",values:nMarg,color:GREEN}]} pct/>
            </Card>
            <Card title="EBITDA Margin" sub="EBITDA / Revenue (%)">
              <AreaChart values={eMarg} labels={revYears} color={AMBER}/>
            </Card>
            <Card title="Net Income" sub="Absolute | YoY growth">
              <BarChart data={H("net_income",niYears)} color={GREEN} showGrowth/>
            </Card>
            {dolData.length>=2?(()=>{
              const validDOL=dolData.filter(d=>d.dol!=null&&isFinite(d.dol!)&&Math.abs(d.dol!)<20);
              const validIM=dolData.filter(d=>d.incrMargin!=null&&isFinite(d.incrMargin!));
              return(
              <Card title="Operating Leverage" sub="Incremental EBIT margin & Degree of Operating Leverage per year" badge="OPEX LEVERAGE">
                {validIM.length>=2&&(
                  <div className="mb-3">
                    <p className="text-[7px] font-bold uppercase tracking-widest mb-1.5" style={{color:"#ffffff25"}}>Incremental EBIT Margin (ΔProfit / ΔRevenue)</p>
                    <div className="flex items-end gap-1" style={{height:60}}>
                      {validIM.map((d,i)=>{
                        const pct=d.incrMargin!;const maxAbs=Math.max(...validIM.map(x=>Math.abs(x.incrMargin!)),1);
                        const barH=Math.max(2,Math.abs(pct)/maxAbs*52);
                        return(
                          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                            <span className="text-[6px] tabular-nums font-bold" style={{color:pct>50?GREEN:pct>0?TEAL:RED}}>{pct>0?"+":""}{pct.toFixed(0)}%</span>
                            <div style={{height:barH,width:"100%",background:pct>50?GREEN:pct>0?TEAL:RED,borderRadius:2,opacity:0.8}}/>
                            <span className="text-[6px]" style={{color:"#ffffff25"}}>{d.year}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {validDOL.length>=2&&(
                  <div>
                    <p className="text-[7px] font-bold uppercase tracking-widest mb-1" style={{color:"#ffffff25"}}>Degree of Operating Leverage (DOL = ΔOI% / ΔRev%)</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {validDOL.map((d,i)=>(
                        <div key={i} className="text-center">
                          <span className="text-[9px] font-bold tabular-nums" style={{color:d.dol!>2?GREEN:d.dol!>1?TEAL:d.dol!>0?AMBER:RED}}>{d.dol!.toFixed(1)}x</span>
                          <p className="text-[6px]" style={{color:"#ffffff25"}}>{d.year}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[6.5px] mt-1.5" style={{color:"#ffffff20"}}>{"DOL >2x = high operating leverage (fixed-cost business scales well)"}</p>
                  </div>
                )}
              </Card>
              );
            })():null}
            <Card title="Effective Tax Rate" sub="Income tax / pre-tax income (%)">
              <LineChart
                labels={revYears}
                series={[{name:"Tax %",values:revYears.map(y=>{const tx=history.income_tax?.[y];const pt=history.pretax_income?.[y];return tx&&pt&&pt>0?tx/Math.abs(pt)*100:null;}),color:RED}]}
                pct
              />
            </Card>
            <Card title="Shareholder Returns" sub="Buybacks + dividends">
              <GroupedBar
                groups={retYears}
                series={[
                  {name:"Buybacks",values:bbVals,color:BLUE},
                  {name:"Dividends",values:divVals,color:PURPLE},
                ]}
              />
            </Card>
            {revYears.some(y=>history.rd_expense?.[y]||history.capex?.[y])&&(
              <Card title="Total Reinvestment Rate" sub="(CapEx + R&D) / Revenue — growth investment intensity" badge="REINVEST">
                <LineChart
                  labels={revYears}
                  series={[{
                    name:"CapEx+R&D %",
                    values:revYears.map(y=>{
                      const capex=Math.abs(history.capex?.[y]??0);
                      const rd=history.rd_expense?.[y]??0;
                      const rev=history.revenue?.[y];
                      return rev&&rev>0?(capex+rd)/rev*100:null;
                    }),
                    color:PURPLE
                  }]}
                  pct
                />
              </Card>
            )}
            {revYears.some(y=>history.sbc_expense?.[y])&&(
              <Card title="SBC Dilution Cost" sub="Stock-based comp as % of revenue — shareholder value transfer" badge="DILUTION">
                <LineChart
                  labels={revYears}
                  series={[{name:"SBC %",values:sbcPct,color:ORANGE}]}
                  pct
                />
              </Card>
            )}
          </div>
          </div>
        )}

        {/* ── Cash Flow ─────────────────────────────────────────────── */}
        {tab==="cashflow"&&(
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Card title="OCF vs CapEx" sub="Cash generation vs reinvestment">
              <GroupedBar
                groups={cfYears}
                series={[
                  {name:"OCF",values:cfYears.map(y=>history.operating_cf?.[y]??0),color:GREEN},
                  {name:"CapEx",values:cfYears.map(y=>Math.abs(history.capex?.[y]??0)),color:RED},
                ]}
              />
            </Card>
            <Card title="Free Cash Flow" sub="5-year trend | YoY growth">
              <BarChart data={H("free_cash_flow",cfYears)} color={TEAL} showGrowth/>
            </Card>
            <Card title="FCF Margin %" sub="Free cash flow / revenue">
              <AreaChart
                values={revYears.map(y=>{const f=history.free_cash_flow?.[y];const r=history.revenue?.[y];return f!=null&&r&&r>0?f/r*100:null;})}
                labels={revYears} color={TEAL}
              />
            </Card>
            <Card title="FCF Conversion" sub="FCF / Net Income — quality signal">
              <AreaChart values={fcfConv} labels={revYears} color={GREEN}/>
            </Card>
            <Card title="Revenue → FCF Bridge" sub="Waterfall decomposition">
              <Waterfall items={bridgeItems.slice(0,8)}/>
            </Card>
            <Card title="CapEx Intensity" sub="CapEx as % of revenue">
              <LineChart
                labels={revYears}
                series={[{name:"CapEx %",values:capexPct,color:ORANGE}]}
                pct
              />
            </Card>

            <Card title="FCF/Share vs EPS" sub="Per-share cash value vs accounting earnings">
              {facts.shares_diluted_wtd!=null&&facts.shares_diluted_wtd>0?(
                <LineChart
                  labels={cfYears}
                  series={[
                    {name:"FCF/sh",values:cfYears.map(y=>{const f=history.free_cash_flow?.[y];const sh=facts.shares_diluted_wtd;return f!=null&&sh&&sh>0?f/sh:null;}),color:TEAL},
                    {name:"EPS",values:cfYears.map(y=>history.eps_diluted?.[y]??null),color:AMBER},
                  ]}
                />
              ):<NoData W={320} H={160}/>}
            </Card>

            {/* ══ LOOP 13: Capital Returns & Shareholder Yield ══ */}
            <Card title="Total Shareholder Yield" sub="Dividend yield + buyback yield (vs current market cap)" badge="TSY">
              {capitalReturns.yieldByYear.some(y=>y.divYield!=null||y.bbYield!=null)?(
                <GroupedBar
                  groups={capitalReturns.yieldByYear.map(y=>y.year)}
                  series={[
                    {name:"Div Yield %",values:capitalReturns.yieldByYear.map(y=>y.divYield??0),color:TEAL},
                    {name:"Buyback Yield %",values:capitalReturns.yieldByYear.map(y=>y.bbYield??0),color:PURPLE},
                  ]}
                  pct
                />
              ):<NoData W={320} H={160}/>}
            </Card>
            <Card title="Capital Returns Summary" sub="Shareholder yield metrics (LTM)" badge="RETURNS">
              <div className="space-y-2 py-1">
                <div className="grid grid-cols-2 gap-2">
                  <Pill label="Div Yield" value={capitalReturns.divYield!=null?`${capitalReturns.divYield.toFixed(1)}%`:"—"} color={TEAL}/>
                  <Pill label="Buyback Yield" value={capitalReturns.buybackYield!=null?`${capitalReturns.buybackYield.toFixed(1)}%`:"—"} color={PURPLE}/>
                  <Pill label="Total Yield" value={capitalReturns.totalYield>0?`${capitalReturns.totalYield.toFixed(1)}%`:"—"} color={capitalReturns.totalYield>4?GREEN:capitalReturns.totalYield>2?AMBER:RED}/>
                  <Pill label="Div CAGR" value={capitalReturns.divCAGR!=null?`${capitalReturns.divCAGR.toFixed(1)}%`:"—"} color={GREEN}/>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="rounded p-2" style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${DARK_BORDER}`}}>
                    <p className="text-[7px]" style={{color:"#ffffff25"}}>Payout Ratio (EPS)</p>
                    <p className="text-[12px] font-bold" style={{color:capitalReturns.payout!=null&&capitalReturns.payout<60?GREEN:capitalReturns.payout!=null&&capitalReturns.payout<90?AMBER:RED}}>
                      {capitalReturns.payout!=null?`${capitalReturns.payout.toFixed(0)}%`:"—"}
                    </p>
                    <p className="text-[6.5px] mt-0.5" style={{color:"#ffffff15"}}>Div/sh ÷ EPS</p>
                  </div>
                  <div className="rounded p-2" style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${DARK_BORDER}`}}>
                    <p className="text-[7px]" style={{color:"#ffffff25"}}>FCF Payout</p>
                    <p className="text-[12px] font-bold" style={{color:capitalReturns.fcfPayout!=null&&capitalReturns.fcfPayout<60?GREEN:capitalReturns.fcfPayout!=null&&capitalReturns.fcfPayout<90?AMBER:RED}}>
                      {capitalReturns.fcfPayout!=null?`${capitalReturns.fcfPayout.toFixed(0)}%`:"—"}
                    </p>
                    <p className="text-[6.5px] mt-0.5" style={{color:"#ffffff15"}}>Div ÷ Free Cash Flow</p>
                  </div>
                </div>
                {capitalReturns.alloc&&(()=>{
                  const total=Object.values(capitalReturns.alloc).reduce((s,v)=>s+v,0);
                  if(total<=0)return null;
                  return(
                    <div>
                      <p className="text-[7px] font-bold uppercase tracking-wider mt-2 mb-1" style={{color:"#ffffff25"}}>FCF Allocation (LTM)</p>
                      {Object.entries(capitalReturns.alloc).map(([k,v],i)=>(
                        <div key={k} className="flex items-center gap-2 mb-0.5">
                          <span className="text-[7.5px] capitalize" style={{color:"#ffffff40",width:60}}>{k}</span>
                          <div className="flex-1 h-1.5 rounded overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
                            <div style={{width:`${Math.min(100,v/total*100)}%`,height:"100%",background:PALETTE[i],borderRadius:999}}/>
                          </div>
                          <span className="text-[7.5px] tabular-nums" style={{color:"#ffffff30",width:28,textAlign:"right"}}>{abbr(v,"$")}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </Card>
            {/* Share count dilution history */}
            {revYears.some(y=>history.shares_diluted_wtd?.[y])&&(()=>{
              const shYears=revYears.filter(y=>history.shares_diluted_wtd?.[y]);
              const shVals=shYears.map(y=>history.shares_diluted_wtd![y]!);
              const baseShares=shVals[0];
              const latestShares=shVals[shVals.length-1];
              const totalDilution=baseShares>0?(latestShares-baseShares)/baseShares*100:null;
              return(
              <Card title="Share Count History" sub="Diluted share count — net dilution from SBC & issuances vs buybacks" badge={totalDilution!=null?totalDilution<0?"NET BUYBACK":"NET DILUTION":"SHARES"}>
                <BarChart
                  data={shYears.map(y=>({label:y.slice(0,4),value:history.shares_diluted_wtd![y]!}))}
                  color={totalDilution!=null&&totalDilution<0?GREEN:RED}
                />
                {totalDilution!=null&&(
                  <p className="text-[7px] mt-1.5" style={{color:totalDilution<0?GREEN:RED}}>
                    {totalDilution<0
                      ?`Net buyback: share count reduced ${Math.abs(totalDilution).toFixed(1)}% since ${shYears[0].slice(0,4)} — EPS accretive`
                      :`Net dilution: share count expanded ${totalDilution.toFixed(1)}% since ${shYears[0].slice(0,4)} — EPS headwind`
                    }
                  </p>
                )}
              </Card>
              );
            })()}
          </div>
        )}

        {/* ── Balance Sheet ─────────────────────────────────────────── */}
        {tab==="balance"&&(
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Card title="Net Debt Evolution" sub="Long-term debt minus cash">
              <BarChart data={netDebt} color={RED}/>
            </Card>
            <Card title="Cash vs Long-Term Debt" sub="Liquidity vs leverage">
              <GroupedBar
                groups={asYears}
                series={[
                  {name:"Cash",values:asYears.map(y=>history.cash?.[y]??0),color:GREEN},
                  {name:"LT Debt",values:asYears.map(y=>history.long_term_debt?.[y]??0),color:RED},
                ]}
              />
            </Card>
            <Card title="Total Assets Growth" sub="Asset base expansion">
              <BarChart data={H("total_assets",asYears)} color={BLUE} showGrowth/>
            </Card>
            <Card title="Debt / Equity Ratio" sub="Financial leverage trend">
              <AreaChart values={deRatio} labels={asYears} color={RED}/>
            </Card>
            <Card title="Current Ratio" sub="Short-term liquidity coverage">
              <LineChart labels={asYears} series={[{name:"Current Ratio",values:crVals,color:TEAL}]}/>
            </Card>
            <Card title="Interest Coverage Ratio" sub="EBIT / Interest Expense — debt service ability">
              <LineChart
                labels={asYears}
                series={[{name:"Coverage",values:asYears.map(y=>{
                  const ei=history.operating_income?.[y];const ie=history.interest_expense?.[y];
                  return ei&&ie&&ie>0?ei/ie:null;
                }),color:TEAL}]}
              />
            </Card>
            <Card title="Equity & Retained Earnings" sub="Book value expansion">
              <GroupedBar
                groups={asYears}
                series={[
                  {name:"Equity",values:asYears.map(y=>history.equity?.[y]??0),color:BLUE},
                  {name:"Retained E",values:asYears.map(y=>history.retained_earnings?.[y]??0),color:PURPLE},
                ]}
              />
            </Card>
            {/* ══ LOOP 12: WC multi-year trend ══ */}
            <Card title="Cash Conversion Cycle Trend" sub="DSO · DIO · DPO over time — working capital velocity" badge="WC TREND">
              {wcTrend.some(w=>w.ccc!=null)?(
                <LineChart
                  labels={wcTrend.map(w=>w.year)}
                  series={[
                    {name:"CCC",values:wcTrend.map(w=>w.ccc),color:BLUE},
                    {name:"DSO",values:wcTrend.map(w=>w.dso),color:AMBER},
                    {name:"DPO",values:wcTrend.map(w=>w.dpo),color:TEAL},
                  ]}
                />
              ):<NoData W={320} H={160}/>}
            </Card>
            <Card title="Working Capital Efficiency" sub="DSO / DIO / DPO / Cash Conversion Cycle" badge="WC">
              <div className="py-2 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Pill label="DSO (days)" value={workingCapital.dso!=null?workingCapital.dso.toFixed(0):"—"} color={workingCapital.dso!=null&&workingCapital.dso<45?GREEN:AMBER}/>
                  <Pill label="DIO (days)" value={workingCapital.dio!=null?workingCapital.dio.toFixed(0):"—"} color={workingCapital.dio!=null&&workingCapital.dio<60?GREEN:AMBER}/>
                  <Pill label="DPO (days)" value={workingCapital.dpo!=null?workingCapital.dpo.toFixed(0):"—"} color={workingCapital.dpo!=null&&workingCapital.dpo>30?GREEN:AMBER}/>
                  <Pill label="CCC (days)" value={workingCapital.ccc!=null?workingCapital.ccc.toFixed(0):"—"} color={workingCapital.ccc!=null&&workingCapital.ccc<30?GREEN:workingCapital.ccc!=null&&workingCapital.ccc<60?AMBER:RED}/>
                </div>
                <div className="rounded p-2 space-y-1" style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${DARK_BORDER}`}}>
                  {[
                    {k:"Days Sales Outstanding",v:workingCapital.dso,unit:"d",formula:"AR / Revenue × 365"},
                    {k:"Days Inventory Outstanding",v:workingCapital.dio,unit:"d",formula:"Inv / COGS × 365"},
                    {k:"Days Payable Outstanding",v:workingCapital.dpo,unit:"d",formula:"AP / COGS × 365"},
                    {k:"Net Working Capital",v:workingCapital.nwc!=null?workingCapital.nwc/1e9:null,unit:"B",formula:"Current Assets – Current Liab."},
                  ].map((r,i)=>(
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <p className="text-[8px]" style={{color:"#ffffff40"}}>{r.k}</p>
                        <p className="text-[6.5px]" style={{color:"#ffffff20"}}>{r.formula}</p>
                      </div>
                      <span className="text-[9px] font-bold tabular-nums" style={{color:"#ffffff60"}}>{r.v!=null?`${r.v.toFixed(1)}${r.unit}`:"—"}</span>
                    </div>
                  ))}
                </div>
                {workingCapital.ccc!=null&&(
                  <div className="rounded p-2 text-center" style={{background:workingCapital.ccc<0?"rgba(16,185,129,0.1)":"rgba(245,158,11,0.08)",border:`1px solid ${workingCapital.ccc<0?GREEN:DARK_BORDER}`}}>
                    <p className="text-[8px] font-bold" style={{color:workingCapital.ccc<0?GREEN:AMBER}}>
                      {workingCapital.ccc<0?"Negative CCC: Company collects before paying suppliers — strong working capital position"
                       :workingCapital.ccc<30?"Short CCC: Efficient cash cycle management"
                       :`CCC ${workingCapital.ccc.toFixed(0)} days — monitor AR/inventory efficiency`}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ── Valuation ────────────────────────────────────────────── */}
        {tab==="multiples"&&(
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Card title="P/E Multiple History" sub={kmHistory.length>0?"FMP key-metrics data":"Derived from financials"}>
              {kmPE.some(v=>v!=null)
                ?<LineChart labels={kmDates} series={[{name:"P/E",values:kmPE,color:BLUE}]}/>
                :<div className="py-6 text-center"><p className="text-[10px] text-white/20">Price data required for PE history</p></div>}
            </Card>
            <Card title="EV/EBITDA History" sub="Enterprise value multiple">
              {kmEV.some(v=>v!=null)
                ?<LineChart labels={kmDates} series={[{name:"EV/EBITDA",values:kmEV,color:AMBER}]}/>
                :<div className="py-6 text-center"><p className="text-[10px] text-white/20">Requires price history</p></div>}
            </Card>
            <Card title="ROIC History" sub={kmHistory.length>0?"FMP data":"Derived: NOPAT / IC"}>
              <LineChart labels={kmDates} series={[{name:"ROIC %",values:kmROIC,color:GREEN}]} pct/>
            </Card>
            <Card title="Current Ratio History" sub="Liquidity multiple trend">
              <LineChart labels={kmDates} series={[{name:"CR",values:kmCR,color:TEAL}]}/>
            </Card>
            <Card title="D/E History" sub="Financial leverage trend">
              <LineChart labels={kmDates} series={[{name:"D/E",values:kmDE,color:RED}]}/>
            </Card>
            {kmPFCF.some(v=>v!=null)&&(
              <Card title="P/FCF Multiple History" sub="Price / Free Cash Flow — cash-based valuation trend">
                <LineChart labels={kmDates} series={[{name:"P/FCF",values:kmPFCF,color:TEAL}]}/>
              </Card>
            )}
            <Card title="EPS Surprise %" sub="Beat/miss vs consensus — streak and magnitude">
              {earningsSurprises.length>0
                ?<BeatMiss data={earningsSurprises}/>
                :<div className="py-6 text-center"><p className="text-[10px] text-white/20">Earnings surprise data not available</p></div>}
            </Card>
            {earningsSurprises.filter(e=>e.eps_actual!=null&&e.eps_est!=null).length>=2&&(
              <Card title="EPS Actual vs Estimate" sub="Street estimate vs delivered — management execution track record" badge={`${earningsStreak.streak}× BEAT`}>
                <GroupedBar
                  groups={earningsSurprises.filter(e=>e.eps_actual!=null&&e.eps_est!=null).slice(0,8).reverse().map(e=>e.date?.slice(0,7)??"" )}
                  series={[
                    {name:"Estimate",values:earningsSurprises.filter(e=>e.eps_actual!=null&&e.eps_est!=null).slice(0,8).reverse().map(e=>e.eps_est!),color:"#ffffff20"},
                    {name:"Actual",values:earningsSurprises.filter(e=>e.eps_actual!=null&&e.eps_est!=null).slice(0,8).reverse().map(e=>e.eps_actual!),color:AMBER},
                  ]}
                />
              </Card>
            )}

            {/* ══ LOOP 14: Historical Multiple Range Bands ══ */}
            {(kmPE.some(v=>v!=null)||kmEV.some(v=>v!=null))&&(
              <div className="rounded-lg overflow-hidden border col-span-2 lg:col-span-3" style={{background:CARD_BG,borderColor:DARK_BORDER}}>
                <div className="px-3 py-2 border-b flex items-center justify-between" style={{borderColor:DARK_BORDER}}>
                  <div>
                    <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff45"}}>Historical Multiple Range Analysis</p>
                    <p className="text-[7.5px] mt-0.5" style={{color:"#ffffff20"}}>Current multiple vs {kmPE.filter(v=>v!=null).length}-year trading range · IQR box · Avg dashed · NOW in amber</p>
                  </div>
                  <span className="text-[7px] px-1.5 py-0.5 rounded font-bold" style={{background:"rgba(245,158,11,0.15)",color:AMBER,border:"1px solid rgba(245,158,11,0.25)"}}>HIST RANGE</span>
                </div>
                <div className="px-3 py-3 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <p className="text-[7.5px] font-bold uppercase tracking-widest mb-3" style={{color:"#ffffff30"}}>P/E Multiple — Where It Trades</p>
                    <MultipleRangeBand values={kmPE} current={facts.pe_ratio??null} color={BLUE}/>
                  </div>
                  <div>
                    <p className="text-[7.5px] font-bold uppercase tracking-widest mb-3" style={{color:"#ffffff30"}}>EV/EBITDA — Where It Trades</p>
                    <MultipleRangeBand values={kmEV} current={facts.ev_ebitda??null} color={AMBER}/>
                  </div>
                </div>
                <div className="px-3 py-2 border-t" style={{borderColor:DARK_BORDER}}>
                  <p className="text-[7px]" style={{color:"#ffffff20"}}>IQR box = 25th–75th percentile range · Dashed line = historical average · NOW marker = current multiple from FMP key-metrics</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Quality & Peers ───────────────────────────────────────── */}
        {tab==="quality"&&(
          <div className="space-y-3">
            {/* Comparable Company Analysis table */}
            <div className="rounded-lg overflow-hidden border" style={{background:CARD_BG,borderColor:DARK_BORDER}}>
              <div className="px-3 py-2 border-b flex items-center justify-between" style={{borderColor:DARK_BORDER}}>
                <div>
                  <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff45"}}>Comparable Company Analysis</p>
                  <p className="text-[7.5px] mt-0.5" style={{color:"#ffffff20"}}>Sorted by market cap | Subject highlighted</p>
                </div>
                <span className="text-[7px] px-1.5 py-0.5 rounded font-bold" style={{background:"rgba(59,130,246,0.15)",color:"#60a5fa",border:"1px solid rgba(59,130,246,0.2)"}}>COMPS TABLE</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{fontSize:8.5}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${DARK_BORDER}`}}>
                      {["Company","Mkt Cap","Rev Growth","Gross Margin","P/E","EV/EBITDA","EV/G","ROIC","Net Margin","Rev/Emp $K"].map(h=>(
                        <th key={h} className="px-3 py-2 text-right first:text-left font-bold uppercase tracking-wider" style={{color:"#ffffff25",fontSize:7}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allPeers.sort((a,b)=>(b.market_cap??0)-(a.market_cap??0)).map((p,i)=>{
                      const isSubject=p.symbol===ticker;
                      const rowBg=isSubject?"rgba(59,130,246,0.1)":"transparent";
                      const rowBorder=isSubject?`1px solid rgba(59,130,246,0.25)`:undefined;
                      const fmt=(v:number|null,suf="",dec=1)=>v!=null?`${v.toFixed(dec)}${suf}`:"—";
                      // EV/G = EV/EBITDA ÷ Rev Growth (growth-adjusted multiple)
                      const evg=p.ev_ebitda!=null&&p.rev_growth!=null&&p.rev_growth>0?p.ev_ebitda/p.rev_growth:null;
                      return(
                        <tr key={i} style={{background:rowBg,borderBottom:`1px solid ${DARK_BORDER}`,outline:rowBorder}}>
                          <td className="px-3 py-2">
                            <span className="font-bold" style={{color:isSubject?"#93c5fd":"#ffffff70"}}>{p.symbol}</span>
                            {p.name&&<span className="ml-1.5 text-[7.5px]" style={{color:"#ffffff25"}}>{p.name.length>20?p.name.slice(0,20)+"…":p.name}</span>}
                            {isSubject&&<span className="ml-1.5 text-[7px] px-1 py-0.5 rounded" style={{background:"rgba(59,130,246,0.2)",color:"#60a5fa"}}>YOU</span>}
                          </td>
                          <td className="px-3 py-2 text-right" style={{color:"#ffffff50"}}>{p.market_cap?abbr(p.market_cap,"$"):"—"}</td>
                          <td className="px-3 py-2 text-right font-bold" style={{color:p.rev_growth!=null&&p.rev_growth>15?GREEN:p.rev_growth!=null&&p.rev_growth>0?AMBER:RED}}>
                            {p.rev_growth!=null?`${p.rev_growth>0?"+":""}${p.rev_growth.toFixed(1)}%`:"—"}
                          </td>
                          <td className="px-3 py-2 text-right font-bold" style={{color:p.gross_margin!=null?p.gross_margin>60?GREEN:p.gross_margin>35?AMBER:RED:"#ffffff40"}}>{p.gross_margin!=null?p.gross_margin.toFixed(1)+"%":"—"}</td>
                          <td className="px-3 py-2 text-right" style={{color:"#ffffff60"}}>{fmt(p.pe,"x")}</td>
                          <td className="px-3 py-2 text-right" style={{color:"#ffffff60"}}>{fmt(p.ev_ebitda,"x")}</td>
                          <td className="px-3 py-2 text-right font-bold" style={{color:evg!=null?evg<0.5?GREEN:evg<1?AMBER:RED:"#ffffff40"}}>{evg!=null?evg.toFixed(2):"—"}</td>
                          <td className="px-3 py-2 text-right font-bold" style={{color:p.roic>15?GREEN:p.roic>9?AMBER:RED}}>{fmt(p.roic,"%")}</td>
                          <td className="px-3 py-2 text-right font-bold" style={{color:p.net_margin>20?GREEN:p.net_margin>5?AMBER:RED}}>{fmt(p.net_margin,"%")}</td>
                          <td className="px-3 py-2 text-right" style={{color:p.rev_per_emp!=null?p.rev_per_emp>500?GREEN:p.rev_per_emp>250?AMBER:RED:"#ffffff40"}}>{p.rev_per_emp!=null?`$${p.rev_per_emp.toFixed(0)}K`:"—"}</td>
                        </tr>
                      );
                    })}
                    {/* Median row */}
                    {allPeers.length>1&&(()=>{
                      const nonSubject=allPeers.filter(p=>p.symbol!==ticker);
                      const med=(arr:(number|null)[])=>{const v=arr.filter((x):x is number=>x!=null).sort((a,b)=>a-b);return v.length?v[Math.floor(v.length/2)]:null;};
                      return(
                        <tr style={{borderTop:`2px solid ${DARK_BORDER}`,background:"rgba(255,255,255,0.02)"}}>
                          <td className="px-3 py-1.5 font-bold text-[7.5px] uppercase" style={{color:"#ffffff25"}}>Peer Median</td>
                          <td className="px-3 py-1.5 text-right" style={{color:"#ffffff30"}}>—</td>
                          <td className="px-3 py-1.5 text-right font-bold" style={{color:"#ffffff35",fontSize:8}}>{(v=>v!=null?v.toFixed(1)+"%":"—")(med(nonSubject.map(p=>p.rev_growth??null)))}</td>
                          <td className="px-3 py-1.5 text-right font-bold" style={{color:"#ffffff35",fontSize:8}}>{(v=>v!=null?v.toFixed(1)+"%":"—")(med(nonSubject.map(p=>p.gross_margin??null)))}</td>
                          <td className="px-3 py-1.5 text-right font-bold" style={{color:"#ffffff35",fontSize:8}}>{(v=>v!=null?v.toFixed(1)+"x":"—")(med(nonSubject.map(p=>p.pe)))}</td>
                          <td className="px-3 py-1.5 text-right font-bold" style={{color:"#ffffff35",fontSize:8}}>{(v=>v!=null?v.toFixed(1)+"x":"—")(med(nonSubject.map(p=>p.ev_ebitda)))}</td>
                          <td className="px-3 py-1.5 text-right font-bold" style={{color:"#ffffff35",fontSize:8}}>{(v=>v!=null?v.toFixed(2):"—")(med(nonSubject.map(p=>p.ev_ebitda!=null&&p.rev_growth!=null&&p.rev_growth>0?p.ev_ebitda/p.rev_growth:null)))}</td>
                          <td className="px-3 py-1.5 text-right font-bold" style={{color:"#ffffff35",fontSize:8}}>{(v=>v!=null?v.toFixed(1)+"%":"—")(med(nonSubject.map(p=>p.roic)))}</td>
                          <td className="px-3 py-1.5 text-right font-bold" style={{color:"#ffffff35",fontSize:8}}>{(v=>v!=null?v.toFixed(1)+"%":"—")(med(nonSubject.map(p=>p.net_margin)))}</td>
                          <td className="px-3 py-1.5 text-right font-bold" style={{color:"#ffffff35",fontSize:8}}>{(v=>v!=null?`$${v.toFixed(0)}K`:"—")(med(nonSubject.map(p=>p.rev_per_emp??null)))}</td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Card title="Accruals Ratio" sub="(NI−OCF)/Assets — earnings quality" badge="QUALITY">
                <AreaChart values={accruals} labels={revYears} color={AMBER}/>
              </Card>
              <Card title="SBC % of Revenue" sub="Stock compensation dilution">
                <LineChart labels={revYears} series={[{name:"SBC %",values:sbcPct,color:PINK}]} pct/>
              </Card>
              <Card title="DuPont ROE Decomposition" sub="Net margin × asset TO × leverage">
                <StackedBar
                  labels={dupontHist.map(d=>d.label)}
                  series={[
                    {name:"Net Margin %",values:dupontHist.map(d=>d.netMargin),color:GREEN},
                    {name:"Asset TO ×10",values:dupontHist.map(d=>d.assetTO*10),color:BLUE},
                    {name:"Leverage ×5",values:dupontHist.map(d=>d.leverage*5),color:PURPLE},
                  ]}
                />
              </Card>
              <Card title="Peer P/E vs ROIC Scatter" sub="Quality vs price quadrant analysis">
                {allPeers.filter(p=>p.pe!=null).length>=2
                  ?<Scatter
                    points={allPeers.filter(p=>p.pe!=null).map(p=>({label:p.symbol,x:p.roic??0,y:p.pe!,highlight:p.symbol===ticker}))}
                    xLabel="ROIC %" yLabel="P/E x"
                  />
                  :<div className="py-8 text-center"><p className="text-[10px] text-white/20">Need ≥2 peers with P/E data</p></div>}
              </Card>
              <Card title="Peer Rev Growth vs Margin" sub="Growth quality scatter">
                {allPeers.filter(p=>p.rev_growth!=null).length>=2
                  ?<Scatter
                    points={allPeers.filter(p=>p.rev_growth!=null).map(p=>({label:p.symbol,x:p.rev_growth!,y:p.net_margin??0,highlight:p.symbol===ticker}))}
                    xLabel="Rev Growth %" yLabel="Net Margin %"
                  />
                  :<NoData W={320} H={160}/>}
              </Card>
              <Card title="EV/EBITDA vs Rev Growth" sub="Growth-justified valuation — premium/discount vs peers" badge="KEY COMPS">
                {allPeers.filter(p=>p.ev_ebitda!=null&&p.rev_growth!=null).length>=2
                  ?<Scatter
                    points={allPeers.filter(p=>p.ev_ebitda!=null&&p.rev_growth!=null).map(p=>({label:p.symbol,x:p.rev_growth!,y:p.ev_ebitda!,highlight:p.symbol===ticker}))}
                    xLabel="Rev Growth %" yLabel="EV/EBITDA x"
                  />
                  :<NoData W={320} H={160}/>}
              </Card>
              <Card title="SBC-Adjusted FCF" sub="True FCF after stock comp cost">
                <BarChart
                  data={revYears.map(y=>({
                    label:y,
                    value:(history.free_cash_flow?.[y]??0)-(history.sbc_expense?.[y]??0),
                  }))}
                  color={TEAL}
                  showGrowth
                />
              </Card>
              <Card title="ROIC / ROE / ROA History" sub="Returns on capital — trend analysis">
                <LineChart
                  labels={asYears}
                  series={[
                    {name:"ROIC",values:asYears.map(y=>{
                      const oi=history.operating_income?.[y];const ta=history.total_assets?.[y];const cl=history.current_liabilities?.[y];const cash=history.cash?.[y];const tr=history.income_tax?.[y];const pt=history.pretax_income?.[y];
                      const taxR=pt&&tr?tr/Math.abs(pt):0.21;const ic=ta&&cl&&cash!=null?ta-cl-cash:null;
                      return oi&&ic&&ic>0?oi*(1-taxR)/ic*100:null;
                    }),color:GREEN},
                    {name:"ROE",values:asYears.map(y=>{const ni=history.net_income?.[y];const eq=history.equity?.[y];return ni&&eq&&eq>0?ni/eq*100:null;}),color:BLUE},
                    {name:"ROA",values:asYears.map(y=>{const ni=history.net_income?.[y];const ta=history.total_assets?.[y];return ni&&ta&&ta>0?ni/ta*100:null;}),color:TEAL},
                  ]}
                  pct
                />
              </Card>
              {/* ══ LOOP 19: Peer Gross Margin + Rev/Employee ══ */}
              {allPeers.some(p=>p.gross_margin!=null)&&(
                <Card title="Peer Gross Margin Comparison" sub="Business model quality — higher = better unit economics" badge="EFFICIENCY">
                  <HBar
                    data={allPeers.filter(p=>p.gross_margin!=null).sort((a,b)=>(b.gross_margin??0)-(a.gross_margin??0)).map(p=>({label:p.symbol,value:p.gross_margin!,highlight:p.symbol===ticker}))}
                    suffix="%" color={TEAL}
                  />
                </Card>
              )}
              {allPeers.some(p=>p.rev_per_emp!=null)&&(
                <Card title="Revenue per Employee ($K)" sub="Labor efficiency — higher = more scalable business model" badge="EFFICIENCY">
                  <HBar
                    data={allPeers.filter(p=>p.rev_per_emp!=null).sort((a,b)=>(b.rev_per_emp??0)-(a.rev_per_emp??0)).map(p=>({label:p.symbol,value:p.rev_per_emp!,highlight:p.symbol===ticker}))}
                    suffix="K" color={PURPLE}
                  />
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ── Quant & Scenarios ────────────────────────────────────── */}
        {tab==="quant"&&(
          <div className="space-y-4">

            {/* ══ LOOP 11: Football Field + Interactive Scenario Builder ══ */}
            <div className="rounded-lg overflow-hidden border" style={{background:CARD_BG,borderColor:DARK_BORDER}}>
              <div className="px-3 py-2 border-b flex items-center justify-between" style={{borderColor:DARK_BORDER}}>
                <div>
                  <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff45"}}>Football Field Valuation</p>
                  <p className="text-[7.5px] mt-0.5" style={{color:"#ffffff20"}}>Range of value by method — bear / base / bull · P/E rel · EV/EBITDA · Monte Carlo</p>
                </div>
                <span className="text-[7px] px-1.5 py-0.5 rounded font-bold" style={{background:"rgba(245,158,11,0.15)",color:AMBER,border:"1px solid rgba(245,158,11,0.25)"}}>IB STANDARD</span>
              </div>
              <div className="px-3 py-3">
                <FootballFieldChart methods={footballFieldMethods} currentPrice={scenarioPrices.current} H={footballFieldMethods.length>3?200:150}/>
              </div>
            </div>

            {/* Scenario Builder */}
            <div className="rounded-lg overflow-hidden border" style={{background:CARD_BG,borderColor:DARK_BORDER}}>
              <div className="px-3 py-2 border-b" style={{borderColor:DARK_BORDER}}>
                <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff45"}}>Interactive Scenario Builder</p>
                <p className="text-[7.5px] mt-0.5" style={{color:"#ffffff20"}}>Adjust assumptions — 5-year DCF per scenario, terminal EV/EBITDA exit</p>
              </div>
              <div className="px-3 py-4">
                {/* Implied prices row */}
                <div className="grid grid-cols-4 gap-2 mb-5">
                  <Pill label="Current" value={scenarioPrices.current>0?`$${scenarioPrices.current.toFixed(0)}`:"—"} color={AMBER}/>
                  <Pill label="Bear Case" value={scenarioPrices.bear!=null?`$${scenarioPrices.bear.toFixed(0)}`:"—"} color={RED}/>
                  <Pill label="Base Case" value={scenarioPrices.base!=null?`$${scenarioPrices.base.toFixed(0)}`:"—"} color={BLUE}/>
                  <Pill label="Bull Case" value={scenarioPrices.bull!=null?`$${scenarioPrices.bull.toFixed(0)}`:"—"} color={GREEN}/>
                </div>
                {/* Upside/downside row */}
                {scenarioPrices.current>0&&(
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {(["bear","base","bull"] as const).map(k=>{
                      const price=scenarioPrices[k];
                      const upside=price!=null&&scenarioPrices.current>0?((price-scenarioPrices.current)/scenarioPrices.current*100):null;
                      const col=k==="bull"?GREEN:k==="base"?BLUE:RED;
                      return(
                        <div key={k} className="rounded p-2 text-center" style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${DARK_BORDER}`}}>
                          <p className="text-[7px] uppercase font-bold" style={{color:col}}>{k} implied</p>
                          <p className="text-[13px] font-bold tabular-nums" style={{color:upside!=null&&upside>=0?GREEN:RED}}>
                            {upside!=null?(upside>=0?"+":"")+upside.toFixed(0)+"%":"—"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Sliders */}
                <div className="grid grid-cols-3 gap-4">
                  {(["bear","base","bull"] as const).map((scenario,si)=>{
                    const col=[RED,BLUE,GREEN][si];
                    const params=scenarios[scenario];
                    type ScenKey="revCAGR"|"exitMargin"|"exitMultiple"|"wacc";
                    const sliders:[string,ScenKey,number,number,number,string][]=[
                      ["Rev CAGR %","revCAGR",-5,50,1,"%"],
                      ["Exit Margin %","exitMargin",5,50,1,"%"],
                      ["Exit EV/EBITDA","exitMultiple",4,40,1,"×"],
                      ["WACC %","wacc",6,18,0.5,"%"],
                    ];
                    return(
                      <div key={scenario}>
                        <p className="text-[8.5px] font-bold uppercase tracking-wider mb-3" style={{color:col}}>{scenario} case</p>
                        <div className="space-y-3">
                          {sliders.map(([label,field,min,max,step,unit])=>(
                            <div key={field}>
                              <div className="flex justify-between mb-1">
                                <span className="text-[7.5px]" style={{color:"#ffffff35"}}>{label}</span>
                                <span className="text-[8px] font-bold tabular-nums" style={{color:col}}>{params[field]}{unit}</span>
                              </div>
                              <input type="range" min={min} max={max} step={step}
                                value={params[field]}
                                onChange={e=>setScenarios(prev=>({...prev,[scenario]:{...prev[scenario],[field]:parseFloat(e.target.value)}}))}
                                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                                style={{accentColor:col,background:`linear-gradient(to right, ${col} ${(params[field]-min)/(max-min)*100}%, rgba(255,255,255,0.08) 0%)`}}
                              />
                              <div className="flex justify-between mt-0.5">
                                <span className="text-[6px]" style={{color:"#ffffff15"}}>{min}{unit}</span>
                                <span className="text-[6px]" style={{color:"#ffffff15"}}>{max}{unit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Monte Carlo summary pills */}
            {monteCarloResults.sims.length>0&&(
              <div className="grid grid-cols-5 gap-2">
                <Pill label="Current" value={abbr(monteCarloResults.price||0,"$")} color={AMBER}/>
                <Pill label="P5 Bear" value={abbr(monteCarloResults.p5||0,"$")} color={RED}/>
                <Pill label="Median" value={abbr(monteCarloResults.median||0,"$")} color={BLUE}/>
                <Pill label="P95 Bull" value={abbr(monteCarloResults.p95||0,"$")} color={GREEN}/>
                <Pill label="Prob Upside" value={`${monteCarloResults.pUp?.toFixed(0)??"—"}%`} color={monteCarloResults.pUp&&monteCarloResults.pUp>50?GREEN:RED}/>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Card title="Monte Carlo DCF" sub={`5,000 simulations · 5-year horizon | ${monteCarloResults.sims.length} runs`} badge="MC">
                <MonteCarloChart simulations={monteCarloResults.sims} current={monteCarloResults.price||0}/>
              </Card>
              <Card title="Rule of 40" sub="Rev growth % + FCF margin % per year" badge="R40">
                {r40Points.length>=2
                  ?<Scatter points={r40Points.map(p=>({...p,highlight:p===r40Points[r40Points.length-1]}))} xLabel="Revenue Growth %" yLabel="FCF Margin %"/>
                  :<div className="py-8 text-center"><p className="text-[10px] text-white/20">Insufficient growth history</p></div>}
              </Card>
              <Card title="Revenue → FCF Bridge" sub="Income statement waterfall">
                <Waterfall items={bridgeItems}/>
              </Card>
              <Card title="ROIC vs Cost of Capital" sub="Value creation spread over time">
                <LineChart
                  labels={asYears}
                  series={[
                    {name:"Derived ROIC",values:asYears.map(y=>{const oi=history.operating_income?.[y];const ta=history.total_assets?.[y];const cl=history.current_liabilities?.[y];const cash=history.cash?.[y];const tr=history.income_tax?.[y];const pt=history.pretax_income?.[y];const taxR=pt&&tr?tr/Math.abs(pt):0.21;const ic=ta&&cl&&cash!=null?ta-cl-cash:null;return oi&&ic&&ic>0?oi*(1-taxR)/ic*100:null;}),color:GREEN},
                    {name:"Assumed WACC",values:asYears.map(()=>9),color:RED},
                  ]}
                  pct
                />
              </Card>
              <Card title="Peer Scatter: P/E vs ROIC" sub="Value vs quality quadrant">
                {allPeers.filter(p=>p.pe!=null).length>=2
                  ?<Scatter
                    points={allPeers.filter(p=>p.pe!=null).map(p=>({label:p.symbol,x:p.roic??0,y:p.pe!,highlight:p.symbol===ticker}))}
                    xLabel="ROIC %" yLabel="P/E x"
                  />
                  :<div className="py-8 text-center"><p className="text-[10px] text-white/20">Need ≥2 peers with P/E data</p></div>}
              </Card>
              <Card title="Growth Quality" sub="EPS vs Revenue growth correlation" badge="QUANT">
                <GroupedBar
                  groups={niYears.slice(1)}
                  series={[
                    {name:"Rev Growth %",values:revGrowth.slice(-Math.max(0,niYears.length-1)),color:BLUE},
                    {name:"NI Growth %",values:niGrowth,color:GREEN},
                  ]}
                  pct
                />
              </Card>
            </div>

            {/* DCF Sensitivity Table */}
            {/* ══ LOOP 12: EVA + ROIC Decomposition ══ */}
            {evaHistory.length>=2&&(
              <div className="space-y-3">
                <div className="rounded-lg overflow-hidden border" style={{background:CARD_BG,borderColor:DARK_BORDER}}>
                  <div className="px-3 py-2 border-b flex items-center justify-between" style={{borderColor:DARK_BORDER}}>
                    <div>
                      <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff45"}}>Economic Value Added (EVA)</p>
                      <p className="text-[7.5px] mt-0.5" style={{color:"#ffffff20"}}>NOPAT minus WACC × Invested Capital — positive = shareholder wealth creation</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[7px] px-1.5 py-0.5 rounded font-bold" style={{background:`rgba(${evaHistory.filter(e=>e.eva>0).length>evaHistory.length/2?"16,185,129":"239,68,68"},0.15)`,color:evaHistory.filter(e=>e.eva>0).length>evaHistory.length/2?GREEN:RED}}>
                        {evaHistory.filter(e=>e.eva>0).length}/{evaHistory.length} YRS +EVA
                      </span>
                    </div>
                  </div>
                  <div className="px-3 py-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[7px] font-bold uppercase tracking-wider mb-2" style={{color:"#ffffff25"}}>Annual EVA (NOPAT − Capital Charge)</p>
                      <BarChart data={evaHistory.map(e=>({label:e.year,value:e.eva,highlight:false}))} color={GREEN}/>
                    </div>
                    <div>
                      <p className="text-[7px] font-bold uppercase tracking-wider mb-2" style={{color:"#ffffff25"}}>NOPAT vs Capital Charge (WACC × IC)</p>
                      <GroupedBar
                        groups={evaHistory.map(e=>e.year)}
                        series={[
                          {name:"NOPAT",values:evaHistory.map(e=>e.nopat),color:GREEN},
                          {name:"Capital Charge",values:evaHistory.map(e=>e.capitalCharge),color:RED},
                        ]}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <Card title="NOPAT Margin Trend" sub="Operating profit after tax / Revenue" badge="ROIC">
                    <LineChart
                      labels={evaHistory.map(e=>e.year)}
                      series={[{name:"NOPAT Margin %",values:evaHistory.map(e=>e.nopatMargin),color:TEAL}]}
                      pct
                    />
                  </Card>
                  <Card title="IC Turnover Trend" sub="Revenue ÷ Invested Capital — asset efficiency">
                    <LineChart
                      labels={evaHistory.map(e=>e.year)}
                      series={[{name:"IC Turnover ×",values:evaHistory.map(e=>e.icTurnover),color:PURPLE}]}
                    />
                  </Card>
                  <Card title="Reinvestment Rate" sub="CapEx / NOPAT — growth investment intensity">
                    <BarChart
                      data={evaHistory.filter(e=>e.reinvRate!=null).map(e=>({label:e.year,value:e.reinvRate!}))}
                      color={AMBER}
                      pct
                    />
                  </Card>
                </div>
              </div>
            )}

            {dcfSensitivity&&(
              <Card title="DCF Sensitivity — Price per Share" sub="WACC (rows) × Terminal Growth Rate (cols) | current highlighted" badge="SENSITIVITY">
                <div className="overflow-x-auto mt-1">
                  <table className="w-full border-collapse text-[8px]">
                    <thead>
                      <tr>
                        <td className="px-1.5 py-1 text-right" style={{color:"#ffffff25",fontSize:7}}>WACC ↓ / g →</td>
                        {dcfSensitivity.growthVals.map(g=>(
                          <td key={g} className="px-2 py-1 text-center font-bold" style={{color:"#ffffff45",borderLeft:`1px solid ${DARK_BORDER}`}}>{(g*100).toFixed(0)}%</td>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dcfSensitivity.grid.map((row, wi)=>{
                        const wacc=dcfSensitivity.waccVals[wi];
                        return(
                          <tr key={wi} style={{borderTop:`1px solid ${DARK_BORDER}`}}>
                            <td className="px-1.5 py-1.5 text-right font-bold" style={{color:"#ffffff40",fontSize:7}}>{(wacc*100).toFixed(0)}%</td>
                            {row.map((price, gi)=>{
                              const cp=dcfSensitivity.currentPrice;
                              const pct=cp>0?(price-cp)/cp:0;
                              const bg=pct>0.15?"rgba(16,185,129,0.25)":pct>0?"rgba(16,185,129,0.10)":pct>-0.15?"rgba(245,158,11,0.15)":"rgba(239,68,68,0.20)";
                              const col=pct>0.15?GREEN:pct>0?GREEN:pct>-0.15?AMBER:RED;
                              const isMid=wi===2&&gi===2;
                              return(
                                <td key={gi} className="px-2 py-1.5 text-center font-bold tabular-nums" style={{
                                  background:isMid?"rgba(59,130,246,0.2)":bg,
                                  color:isMid?"#93c5fd":col,
                                  border:isMid?`1px solid #3b82f6`:`1px solid ${DARK_BORDER}`,
                                  fontSize:8.5,
                                }}>
                                  ${price.toLocaleString()}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-[7px] mt-1.5 text-right" style={{color:"#ffffff20"}}>
                    Current price: ${dcfSensitivity.currentPrice>0?dcfSensitivity.currentPrice.toFixed(0):"—"} · Base case (9% WACC, 8% g) highlighted blue · WACC=9%, EV/EBITDA terminal
                  </p>
                </div>
              </Card>
            )}

            {/* ══ LOOP 14: Revenue × Margin Sensitivity Grid ══ */}
            {revMarginSensitivity&&(
              <div className="rounded-lg overflow-hidden border" style={{background:CARD_BG,borderColor:DARK_BORDER}}>
                <div className="px-3 py-2 border-b flex items-center justify-between" style={{borderColor:DARK_BORDER}}>
                  <div>
                    <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff45"}}>Revenue Growth × EBITDA Margin — Implied Price</p>
                    <p className="text-[7.5px] mt-0.5" style={{color:"#ffffff20"}}>Current EV/EBITDA applied to forward EBITDA · Rows = 1Y rev growth · Cols = EBITDA margin delta vs today ({revMarginSensitivity.curMarginPct.toFixed(1)}%)</p>
                  </div>
                  <span className="text-[7px] px-1.5 py-0.5 rounded font-bold" style={{background:"rgba(16,185,129,0.15)",color:GREEN,border:"1px solid rgba(16,185,129,0.25)"}}>2-WAY SENSI</span>
                </div>
                <div className="px-3 py-3 overflow-x-auto">
                  <table className="border-collapse text-[8px]" style={{minWidth:"100%"}}>
                    <thead>
                      <tr>
                        <td className="px-2 py-1 text-right" style={{color:"#ffffff20",fontSize:7}}>Rev g ↓ / Margin Δ →</td>
                        {revMarginSensitivity.mDs.map(md=>(
                          <td key={md} className="px-2 py-1 text-center font-bold" style={{color:md===0?AMBER:"#ffffff35",borderLeft:`1px solid ${DARK_BORDER}`,fontSize:7,background:md===0?"rgba(245,158,11,0.05)":"transparent"}}>
                            {md===0?"Base":`${md>0?"+":""}${(md*100).toFixed(0)}pp`}
                          </td>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {revMarginSensitivity.grid.map((row,ri)=>{
                        const rg=revMarginSensitivity.revGs[ri];
                        const cp=revMarginSensitivity.currentPrice;
                        return(
                          <tr key={ri} style={{borderTop:`1px solid ${DARK_BORDER}`}}>
                            <td className="px-2 py-1.5 text-right font-bold" style={{color:"#ffffff35",fontSize:7}}>{rg===0?"Flat":rg>0?`+${(rg*100).toFixed(0)}%`:`${(rg*100).toFixed(0)}%`}</td>
                            {row.map((price,mi)=>{
                              const pct=cp>0?(price-cp)/cp:0;
                              const md=revMarginSensitivity.mDs[mi];
                              const isBase=rg===0&&md===0;
                              const bg=pct>0.15?"rgba(16,185,129,0.28)":pct>0.05?"rgba(16,185,129,0.14)":pct>-0.05?"rgba(245,158,11,0.12)":pct>-0.15?"rgba(239,68,68,0.14)":"rgba(239,68,68,0.28)";
                              const col=pct>0?GREEN:pct>-0.10?AMBER:RED;
                              return(
                                <td key={mi} className="px-2 py-1.5 text-center font-bold tabular-nums" style={{
                                  background:isBase?"rgba(245,158,11,0.18)":bg,
                                  color:isBase?AMBER:col,
                                  border:isBase?`1px solid rgba(245,158,11,0.4)`:`1px solid ${DARK_BORDER}`,
                                  fontSize:8.5,
                                }}>
                                  ${price.toLocaleString()}
                                  {cp>0&&!isBase&&<div style={{fontSize:6,color:pct>0?`${GREEN}bb`:`${RED}bb`}}>{pct>=0?"+":""}{(pct*100).toFixed(0)}%</div>}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-[7px] mt-2" style={{color:"#ffffff20"}}>
                    Assumes current EV/EBITDA ({facts.ev_ebitda?.toFixed(1)??"—"}x) held constant · Net debt: ${facts.long_term_debt&&facts.cash?abbr((facts.long_term_debt-facts.cash),""):"-"} · Current: ${revMarginSensitivity.currentPrice} · Base cell highlighted amber
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Signals & Scores ──────────────────────────────────── */}
        {tab==="signals"&&(
          <div className="space-y-4">

            {/* ══ LOOP 20: Financial Health Tripwires ══ */}
            {(()=>{
              const lastYear=revYears[revYears.length-1];const prevYear=revYears[revYears.length-2];
              const lastRev=history.revenue?.[lastYear]??0;const prevRev=history.revenue?.[prevYear]??1;
              const lastAR=history.accounts_receivable?.[lastYear]??0;const prevAR=history.accounts_receivable?.[prevYear]??1;
              const lastInv=history.inventory?.[lastYear]??null;const prevInv=history.inventory?.[prevYear]??null;
              const lastGM=history.gross_profit?.[lastYear]&&lastRev?history.gross_profit[lastYear]!/lastRev*100:null;
              const prevGM=history.gross_profit?.[prevYear]&&prevRev?history.gross_profit[prevYear]!/prevRev*100:null;
              const lastROIC=facts.roic;
              const prevROICFromHist=kmHistory.length>=2?kmHistory[kmHistory.length-2]?.roic:null;
              const fcfNi=facts.free_cash_flow&&facts.net_income&&facts.net_income>0?facts.free_cash_flow/facts.net_income:null;
              const sbcPctVal=facts.sbc_expense&&lastRev?facts.sbc_expense/lastRev*100:null;
              const netDebtEBITDA=facts.long_term_debt&&facts.cash&&facts.ebitda&&facts.ebitda>0?(facts.long_term_debt-facts.cash)/facts.ebitda:null;
              const revGrowthRate=lastRev&&prevRev?((lastRev-prevRev)/prevRev*100):null;
              const prevRevGrowth=prevYear&&revYears.length>=3?(()=>{const py2=revYears[revYears.length-3];const r2=history.revenue?.[py2]??1;return prevRev&&r2?((prevRev-r2)/r2*100):null;})():null;
              const arGrowthVsRev=lastAR&&prevAR&&lastRev&&prevRev?((lastAR-prevAR)/prevAR*100)-((lastRev-prevRev)/prevRev*100):null;
              const invGrowthVsRev=lastInv&&prevInv&&lastRev&&prevRev?((lastInv-prevInv)/Math.abs(prevInv)*100)-((lastRev-prevRev)/prevRev*100):null;
              type TW={label:string;ok:boolean|null;warning:string;clean:string;value:string};
              const tripwires:TW[]=[
                {label:"Earnings Quality",ok:fcfNi!=null?fcfNi>=0.7:null,warning:`FCF/NI ${fcfNi!=null?fcfNi.toFixed(2):"?"} — earnings may exceed cash`,clean:`FCF/NI ${fcfNi!=null?fcfNi.toFixed(2):"?"} — strong cash conversion`,value:fcfNi!=null?fcfNi.toFixed(2):"—"},
                {label:"Gross Margin Trend",ok:lastGM!=null&&prevGM!=null?lastGM>=prevGM-0.5:null,warning:`Gross margin compressing ${lastGM?.toFixed(1)??"-"}% vs ${prevGM?.toFixed(1)??"-"}%`,clean:`Gross margin stable/expanding at ${lastGM?.toFixed(1)??"-"}%`,value:lastGM!=null&&prevGM!=null?(lastGM-prevGM>0?"+":"")+((lastGM??0)-(prevGM??0)).toFixed(1)+"pp":"—"},
                {label:"AR vs Rev Growth",ok:arGrowthVsRev!=null?arGrowthVsRev<10:null,warning:`AR growing ${arGrowthVsRev!=null?arGrowthVsRev.toFixed(1):"?"}pp faster than rev — collection risk`,clean:`AR in line with revenue growth`,value:arGrowthVsRev!=null?(arGrowthVsRev>0?"+":"")+arGrowthVsRev.toFixed(1)+"pp":"—"},
                {label:"Inventory Quality",ok:lastInv==null||(invGrowthVsRev!=null?invGrowthVsRev<15:true),warning:`Inventory growing ${invGrowthVsRev!=null?invGrowthVsRev.toFixed(1):"?"}pp faster than rev`,clean:`Inventory in line with sales`,value:invGrowthVsRev!=null?(invGrowthVsRev>0?"+":"")+invGrowthVsRev.toFixed(1)+"pp":lastInv==null?"N/A":"—"},
                {label:"SBC Dilution",ok:sbcPctVal!=null?sbcPctVal<10:null,warning:`SBC ${sbcPctVal?.toFixed(1)??"-"}% of revenue — elevated dilution`,clean:`SBC ${sbcPctVal?.toFixed(1)??"-"}% of revenue — within range`,value:sbcPctVal!=null?sbcPctVal.toFixed(1)+"%":"—"},
                {label:"Leverage",ok:netDebtEBITDA!=null?netDebtEBITDA<3:null,warning:`Net Debt/EBITDA ${netDebtEBITDA?.toFixed(1)??"-"}x — elevated leverage`,clean:`Net Debt/EBITDA ${netDebtEBITDA?.toFixed(1)??"-"}x — manageable`,value:netDebtEBITDA!=null?netDebtEBITDA.toFixed(1)+"x":facts.cash&&facts.long_term_debt&&facts.cash>facts.long_term_debt?"Net Cash":"—"},
                {label:"Revenue Momentum",ok:revGrowthRate!=null&&prevRevGrowth!=null?revGrowthRate>prevRevGrowth-5:revGrowthRate!=null?revGrowthRate>0:null,warning:`Revenue decelerating: ${revGrowthRate?.toFixed(1)??"-"}% vs ${prevRevGrowth?.toFixed(1)??"-"}% prior`,clean:`Revenue momentum: ${revGrowthRate?.toFixed(1)??"-"}% YoY`,value:revGrowthRate!=null?(revGrowthRate>0?"+":"")+revGrowthRate.toFixed(1)+"%":"—"},
                {label:"ROIC Trend",ok:lastROIC!=null&&prevROICFromHist!=null?lastROIC>=prevROICFromHist-1:lastROIC!=null?lastROIC>10:null,warning:`ROIC declining: ${lastROIC?.toFixed(1)??"-"}% (was ${prevROICFromHist?.toFixed(1)??"-"}%)`,clean:`ROIC ${lastROIC?.toFixed(1)??"-"}% — capital efficient`,value:lastROIC!=null?lastROIC.toFixed(1)+"%":"—"},
              ];
              const greenCount=tripwires.filter(t=>t.ok===true).length;
              const redCount=tripwires.filter(t=>t.ok===false).length;
              return(
              <div className="rounded-lg overflow-hidden border" style={{background:CARD_BG,borderColor:DARK_BORDER}}>
                <div className="px-3 py-2 border-b flex items-center justify-between" style={{borderColor:DARK_BORDER}}>
                  <div>
                    <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff45"}}>Financial Health Tripwires</p>
                    <p className="text-[7.5px] mt-0.5" style={{color:"#ffffff20"}}>8 fundamental analyst checks · Earnings quality · Leverage · Growth quality · Dilution</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[7px] px-1.5 py-0.5 rounded font-bold" style={{background:"rgba(16,185,129,0.12)",color:GREEN,border:"1px solid rgba(16,185,129,0.2)"}}>{greenCount} CLEAR</span>
                    {redCount>0&&<span className="text-[7px] px-1.5 py-0.5 rounded font-bold" style={{background:"rgba(239,68,68,0.12)",color:RED,border:"1px solid rgba(239,68,68,0.2)"}}>{redCount} FLAG</span>}
                  </div>
                </div>
                <div className="px-3 py-2 grid grid-cols-2 lg:grid-cols-4 gap-1.5">
                  {tripwires.map((tw,i)=>(
                    <div key={i} className="rounded p-2" style={{background:tw.ok===false?"rgba(239,68,68,0.06)":tw.ok===true?"rgba(16,185,129,0.04)":"rgba(255,255,255,0.02)",border:`1px solid ${tw.ok===false?"rgba(239,68,68,0.2)":tw.ok===true?"rgba(16,185,129,0.15)":DARK_BORDER}`}}>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-[7px] font-bold uppercase tracking-wider" style={{color:"#ffffff35"}}>{tw.label}</p>
                        <span style={{color:tw.ok===false?RED:tw.ok===true?GREEN:"#ffffff30",fontSize:9}}>
                          {tw.ok===false?"⚠":"✓"}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold tabular-nums" style={{color:tw.ok===false?RED:tw.ok===true?GREEN:AMBER}}>{tw.value}</p>
                      <p className="text-[6.5px] mt-0.5 leading-tight" style={{color:tw.ok===false?"rgba(239,68,68,0.7)":tw.ok===true?"rgba(16,185,129,0.6)":"#ffffff20"}}>
                        {tw.ok===false?tw.warning:tw.ok===true?tw.clean:"No data"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              );
            })()}

            {/* ══ LOOP 14: Investment Thesis Card ══ */}
            <div className="rounded-lg overflow-hidden border" style={{background:investmentThesis.verdictBg,borderColor:investmentThesis.verdictColor+"44"}}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{borderColor:investmentThesis.verdictColor+"33"}}>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-black tracking-widest" style={{color:investmentThesis.verdictColor}}>{investmentThesis.verdict}</span>
                  <span className="text-[8px] text-white/40">·</span>
                  <span className="text-[8.5px] font-bold" style={{color:"#ffffff50"}}>Factor Score {investmentThesis.score}/100 · {companyName} ({ticker})</span>
                </div>
                <span className="text-[7px] px-2 py-0.5 rounded font-bold" style={{background:"rgba(255,255,255,0.08)",color:"#ffffff40",border:"1px solid rgba(255,255,255,0.12)"}}>ER ANALYST BRIEF</span>
              </div>
              <div className="px-4 py-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Bull case */}
                <div>
                  <p className="text-[7.5px] font-bold uppercase tracking-widest mb-2" style={{color:GREEN}}>▲ Bull Case — Top Strengths</p>
                  <div className="space-y-1.5">
                    {investmentThesis.bullSubs.length>0?investmentThesis.bullSubs.map((s,i)=>(
                      <div key={i} className="flex items-start gap-2 rounded px-2 py-1.5" style={{background:"rgba(16,185,129,0.07)",border:"1px solid rgba(16,185,129,0.15)"}}>
                        <span className="text-[8px] font-bold tabular-nums shrink-0 mt-0.5" style={{color:GREEN}}>{s.score}</span>
                        <div>
                          <span className="text-[8px] font-bold" style={{color:"#ffffff65"}}>{s.name}</span>
                          <span className="text-[7.5px] ml-1.5" style={{color:"#ffffff35"}}>{s.detail}</span>
                        </div>
                      </div>
                    )):<p className="text-[8px]" style={{color:"#ffffff25"}}>Insufficient data for bull signals</p>}
                  </div>
                </div>
                {/* Bear case */}
                <div>
                  <p className="text-[7.5px] font-bold uppercase tracking-widest mb-2" style={{color:RED}}>▼ Bear Case — Key Risks</p>
                  <div className="space-y-1.5">
                    {investmentThesis.bearSubs.length>0?investmentThesis.bearSubs.map((s,i)=>(
                      <div key={i} className="flex items-start gap-2 rounded px-2 py-1.5" style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.15)"}}>
                        <span className="text-[8px] font-bold tabular-nums shrink-0 mt-0.5" style={{color:RED}}>{s.score}</span>
                        <div>
                          <span className="text-[8px] font-bold" style={{color:"#ffffff65"}}>{s.name}</span>
                          <span className="text-[7.5px] ml-1.5" style={{color:"#ffffff35"}}>{s.detail}</span>
                        </div>
                      </div>
                    )):<p className="text-[8px]" style={{color:"#ffffff25"}}>No significant bear signals detected</p>}
                  </div>
                </div>
              </div>
              {/* Bottom context bar */}
              <div className="px-4 py-2 border-t flex flex-wrap items-center gap-x-5 gap-y-1" style={{borderColor:investmentThesis.verdictColor+"22",background:"rgba(0,0,0,0.15)"}}>
                {investmentThesis.currPE!=null&&investmentThesis.avgPE!=null&&(
                  <div className="flex items-center gap-1.5">
                    <span className="text-[7px] font-bold uppercase" style={{color:"#ffffff25"}}>P/E vs Hist</span>
                    <span className="text-[8px] font-bold" style={{color:investmentThesis.peVsHist!=null&&investmentThesis.peVsHist>0?RED:GREEN}}>
                      {investmentThesis.currPE.toFixed(1)}x {investmentThesis.peVsHist!=null?(investmentThesis.peVsHist>0?"+":"")+investmentThesis.peVsHist.toFixed(0)+"% vs "+investmentThesis.avgPE.toFixed(1)+"x avg":""}
                    </span>
                  </div>
                )}
                {investmentThesis.currEV!=null&&investmentThesis.avgEV!=null&&(
                  <div className="flex items-center gap-1.5">
                    <span className="text-[7px] font-bold uppercase" style={{color:"#ffffff25"}}>EV/EBITDA vs Hist</span>
                    <span className="text-[8px] font-bold" style={{color:investmentThesis.evVsHist!=null&&investmentThesis.evVsHist>0?RED:GREEN}}>
                      {investmentThesis.currEV.toFixed(1)}x {investmentThesis.evVsHist!=null?(investmentThesis.evVsHist>0?"+":"")+investmentThesis.evVsHist.toFixed(0)+"% vs "+investmentThesis.avgEV.toFixed(1)+"x avg":""}
                    </span>
                  </div>
                )}
                {reverseDCF&&(
                  <div className="flex items-center gap-1.5">
                    <span className="text-[7px] font-bold uppercase" style={{color:"#ffffff25"}}>Mkt Implies</span>
                    <span className="text-[8px] font-bold" style={{color:BLUE}}>{reverseDCF.impliedGrowth}% rev CAGR</span>
                  </div>
                )}
                {scenarioPrices.base!=null&&scenarioPrices.current>0&&(
                  <div className="flex items-center gap-1.5">
                    <span className="text-[7px] font-bold uppercase" style={{color:"#ffffff25"}}>Base DCF</span>
                    <span className="text-[8px] font-bold" style={{color:scenarioPrices.base>scenarioPrices.current?GREEN:RED}}>
                      ${Math.round(scenarioPrices.base)} ({((scenarioPrices.base-scenarioPrices.current)/scenarioPrices.current*100).toFixed(0)}%)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ══ LOOP 16: Price Position Card ══ */}
            {(facts.week52_high||facts.pt_consensus)&&(()=>{
              const price=facts.stock_price;
              const lo=facts.week52_low, hi=facts.week52_high;
              const ptLo=facts.pt_low, ptHi=facts.pt_high, ptMid=facts.pt_consensus;
              const toX=(v:number,min:number,max:number)=>Math.max(0,Math.min(100,((v-min)/(max-min||1))*100));
              const pctFrom52Lo=lo!=null&&hi!=null&&price!=null?((price-lo)/((hi-lo)||1)*100):null;
              const ptUpsidePct=ptMid&&price?((ptMid-price)/price*100):null;
              const totalSYield=capitalReturns.totalYield>0?capitalReturns.totalYield:null;
              const nextEarningsDate=facts.next_earnings_ts?new Date(facts.next_earnings_ts*1000).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):null;
              const daysToEarnings=facts.next_earnings_ts?Math.ceil((facts.next_earnings_ts*1000-Date.now())/(1000*60*60*24)):null;
              return(
              <div className="rounded-lg overflow-hidden border" style={{background:CARD_BG,borderColor:DARK_BORDER}}>
                <div className="px-3 py-2 border-b flex items-center justify-between" style={{borderColor:DARK_BORDER}}>
                  <div>
                    <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff45"}}>Price Position</p>
                    <p className="text-[7.5px] mt-0.5" style={{color:"#ffffff20"}}>52-week range · Analyst price target distribution · Shareholder yield</p>
                  </div>
                  <span className="text-[7px] px-1.5 py-0.5 rounded font-bold" style={{background:"rgba(59,130,246,0.15)",color:BLUE,border:`1px solid rgba(59,130,246,0.25)`}}>MARKET CONTEXT</span>
                </div>
                <div className="px-4 py-3 space-y-4">
                  {/* 52-week range */}
                  {lo!=null&&hi!=null&&price!=null&&(
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[7.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff30"}}>52-Week Range</span>
                        <span className="text-[8px] font-bold" style={{color:"#ffffff50"}}>${price.toFixed(2)} — {pctFrom52Lo!=null?`${pctFrom52Lo.toFixed(0)}% above 52W low`:""}</span>
                      </div>
                      <div className="relative h-4 rounded" style={{background:"rgba(255,255,255,0.06)"}}>
                        <div className="absolute inset-y-0 left-0 rounded" style={{width:`${toX(price,lo,hi)}%`,background:`linear-gradient(90deg,rgba(59,130,246,0.3),rgba(59,130,246,0.5))`}}/>
                        {/* Current price marker */}
                        <div className="absolute top-0 bottom-0 w-0.5 rounded" style={{left:`${toX(price,lo,hi)}%`,background:AMBER,transform:"translateX(-50%)"}}/>
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[7px]" style={{color:"#ffffff25"}}>${lo.toFixed(0)} 52W Low</span>
                        <span className="text-[7px]" style={{color:"#ffffff25"}}>${hi.toFixed(0)} 52W High</span>
                      </div>
                    </div>
                  )}
                  {/* Analyst PT range */}
                  {ptMid!=null&&price!=null&&(()=>{
                    const rangeMin=Math.min(lo??price,ptLo??ptMid*0.8,price)*0.97;
                    const rangeMax=Math.max(hi??price,ptHi??ptMid*1.2,price)*1.03;
                    return(
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[7.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff30"}}>Analyst Price Target</span>
                        <span className="text-[8px] font-bold" style={{color:ptUpsidePct!=null&&ptUpsidePct>0?GREEN:RED}}>
                          ${ptMid.toFixed(0)} consensus {ptUpsidePct!=null?`(${ptUpsidePct>0?"+":""}${ptUpsidePct.toFixed(1)}% vs current)`:""}
                          {facts.num_analysts!=null?` · ${Math.round(facts.num_analysts)} analysts`:""}
                        </span>
                      </div>
                      <div className="relative h-4 rounded" style={{background:"rgba(255,255,255,0.06)"}}>
                        {/* PT range band */}
                        {ptLo!=null&&ptHi!=null&&(
                          <div className="absolute inset-y-0 rounded" style={{
                            left:`${toX(ptLo,rangeMin,rangeMax)}%`,
                            width:`${toX(ptHi,rangeMin,rangeMax)-toX(ptLo,rangeMin,rangeMax)}%`,
                            background:"rgba(16,185,129,0.2)",border:"1px solid rgba(16,185,129,0.3)"
                          }}/>
                        )}
                        {/* PT consensus marker */}
                        <div className="absolute top-0 bottom-0 w-0.5 rounded" style={{left:`${toX(ptMid,rangeMin,rangeMax)}%`,background:GREEN,transform:"translateX(-50%)"}}/>
                        {/* Current price marker */}
                        <div className="absolute top-0 bottom-0 w-0.5 rounded" style={{left:`${toX(price,rangeMin,rangeMax)}%`,background:AMBER,transform:"translateX(-50%)"}}/>
                      </div>
                      <div className="flex justify-between mt-0.5">
                        {ptLo!=null&&<span className="text-[7px]" style={{color:"#ffffff25"}}>${ptLo.toFixed(0)} PT Low</span>}
                        {ptHi!=null&&<span className="text-[7px]" style={{color:"#ffffff25"}}>${ptHi.toFixed(0)} PT High</span>}
                      </div>
                    </div>
                    );
                  })()}
                  {/* Analyst recommendation distribution */}
                  {analystRec&&analystRec.total>0&&(()=>{
                    const bullish=analystRec.strong_buy+analystRec.buy;
                    const bearish=analystRec.sell+analystRec.strong_sell;
                    const bullPct=bullish/analystRec.total*100;
                    const holdPct=analystRec.hold/analystRec.total*100;
                    const bearPct=bearish/analystRec.total*100;
                    return(
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[7.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff30"}}>Analyst Ratings ({analystRec.total} analysts)</span>
                        <span className="text-[8px] font-bold" style={{color:bullPct>60?GREEN:bearPct>40?RED:AMBER}}>
                          {Math.round(bullPct)}% Buy · {Math.round(holdPct)}% Hold · {Math.round(bearPct)}% Sell
                        </span>
                      </div>
                      <div className="flex h-3 rounded overflow-hidden">
                        <div style={{width:`${bullPct}%`,background:GREEN,opacity:0.75}}/>
                        <div style={{width:`${holdPct}%`,background:"#ffffff20"}}/>
                        <div style={{width:`${bearPct}%`,background:RED,opacity:0.75}}/>
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[7px]" style={{color:GREEN}}>{bullish} Buy/Strong Buy</span>
                        <span className="text-[7px]" style={{color:"#ffffff25"}}>{analystRec.hold} Hold</span>
                        <span className="text-[7px]" style={{color:RED}}>{bearish} Sell</span>
                      </div>
                    </div>
                    );
                  })()}

                  {/* Key metrics row */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t" style={{borderColor:DARK_BORDER}}>
                    {facts.short_float_pct!=null&&(
                      <div>
                        <p className="text-[7px] uppercase tracking-widest" style={{color:"#ffffff25"}}>Short Interest</p>
                        <p className="text-[9px] font-bold" style={{color:facts.short_float_pct>10?RED:AMBER}}>{facts.short_float_pct.toFixed(1)}% of float</p>
                        {facts.short_ratio!=null&&<p className="text-[7px]" style={{color:"#ffffff25"}}>{facts.short_ratio.toFixed(1)}d to cover</p>}
                      </div>
                    )}
                    {totalSYield!=null&&(
                      <div>
                        <p className="text-[7px] uppercase tracking-widest" style={{color:"#ffffff25"}}>Total Shareholder Yield</p>
                        <p className="text-[9px] font-bold" style={{color:GREEN}}>{totalSYield.toFixed(1)}%</p>
                        <p className="text-[7px]" style={{color:"#ffffff25"}}>
                          {capitalReturns.buybackYield!=null?`${capitalReturns.buybackYield.toFixed(1)}% bb`:""}
                          {capitalReturns.buybackYield!=null&&capitalReturns.divYield!=null?" + ":""}
                          {capitalReturns.divYield!=null?`${capitalReturns.divYield.toFixed(1)}% div`:""}
                        </p>
                      </div>
                    )}
                    {facts.pt_last_quarter!=null&&facts.pt_consensus!=null&&(
                      <div>
                        <p className="text-[7px] uppercase tracking-widest" style={{color:"#ffffff25"}}>PT Revision (QoQ)</p>
                        <p className="text-[9px] font-bold" style={{color:facts.pt_consensus>facts.pt_last_quarter?GREEN:RED}}>
                          {facts.pt_consensus>facts.pt_last_quarter?"+":""}${(facts.pt_consensus-facts.pt_last_quarter).toFixed(0)}
                        </p>
                        <p className="text-[7px]" style={{color:"#ffffff25"}}>vs prior qtr avg</p>
                      </div>
                    )}
                    {nextEarningsDate!=null&&daysToEarnings!=null&&daysToEarnings>0&&(
                      <div>
                        <p className="text-[7px] uppercase tracking-widest" style={{color:"#ffffff25"}}>Next Earnings</p>
                        <p className="text-[9px] font-bold" style={{color:daysToEarnings<=14?AMBER:BLUE}}>{nextEarningsDate}</p>
                        <p className="text-[7px]" style={{color:daysToEarnings<=14?AMBER+"99":"#ffffff25"}}>{daysToEarnings}d away</p>
                      </div>
                    )}
                    {facts.beta!=null&&(
                      <div>
                        <p className="text-[7px] uppercase tracking-widest" style={{color:"#ffffff25"}}>Beta (5Y Monthly)</p>
                        <p className="text-[9px] font-bold" style={{color:facts.beta>1.5?RED:facts.beta>1?AMBER:GREEN}}>{facts.beta.toFixed(2)}</p>
                        <p className="text-[7px]" style={{color:"#ffffff25"}}>vs S&P 500</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              );
            })()}

            {/* ══ LOOP 18: Estimate Revision Tracker ══ */}
            {analystEstimates&&analystEstimates.length>=2&&(()=>{
              const sorted=[...analystEstimates].sort((a,b)=>a.date.localeCompare(b.date));
              const latest=sorted[sorted.length-1];const prior=sorted[sorted.length-2];
              const epsDelta=latest.eps_avg!=null&&prior.eps_avg!=null&&prior.eps_avg!==0?((latest.eps_avg-prior.eps_avg)/Math.abs(prior.eps_avg)*100):null;
              const revDelta=latest.rev_avg!=null&&prior.rev_avg!=null&&prior.rev_avg!==0?((latest.rev_avg-prior.rev_avg)/Math.abs(prior.rev_avg)*100):null;
              const ebitDelta=latest.ebitda_avg!=null&&prior.ebitda_avg!=null&&prior.ebitda_avg!==0?((latest.ebitda_avg-prior.ebitda_avg)/Math.abs(prior.ebitda_avg)*100):null;
              // Count consecutive EPS beats from earningsSurprises
              let beatStreak=0;let totalBeats=0;
              for(const s of [...earningsSurprises].sort((a,b)=>b.date.localeCompare(a.date))){
                const beat=(s.surprise_pct??0)>0;
                if(beat){totalBeats++;if(beatStreak===totalBeats)beatStreak++;}
              }
              const beatPct=earningsSurprises.length>0?earningsSurprises.filter(s=>(s.surprise_pct??0)>0).length/earningsSurprises.length*100:null;
              const revisionUp=(epsDelta??0)>0&&(revDelta??0)>0;
              const revisionBias=epsDelta!=null&&revDelta!=null?(epsDelta+revDelta)/2:null;
              return(
              <div className="rounded-lg overflow-hidden border" style={{background:CARD_BG,borderColor:DARK_BORDER}}>
                <div className="px-3 py-2 border-b flex items-center justify-between" style={{borderColor:DARK_BORDER}}>
                  <div>
                    <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff45"}}>Estimate Revision Tracker</p>
                    <p className="text-[7.5px] mt-0.5" style={{color:"#ffffff20"}}>Consensus revision direction · Beat rate · QoQ EPS & Rev estimate changes</p>
                  </div>
                  <span className="text-[7px] px-1.5 py-0.5 rounded font-bold" style={{
                    background:revisionBias!=null?revisionBias>1?"rgba(16,185,129,0.15)":revisionBias<-1?"rgba(239,68,68,0.15)":"rgba(245,158,11,0.15)":"rgba(255,255,255,0.06)",
                    color:revisionBias!=null?revisionBias>1?GREEN:revisionBias<-1?RED:AMBER:"#ffffff40",
                    border:`1px solid ${revisionBias!=null?revisionBias>1?"rgba(16,185,129,0.3)":revisionBias<-1?"rgba(239,68,68,0.3)":"rgba(245,158,11,0.3)":"rgba(255,255,255,0.1)"}`
                  }}>{revisionBias!=null?revisionBias>1?"ESTIMATES ↑":"ESTIMATES ↓":"ESTIMATES →"}</span>
                </div>
                <div className="px-3 py-3">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                    {/* EPS revision */}
                    <div className="rounded p-2.5" style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${DARK_BORDER}`}}>
                      <p className="text-[7px] uppercase font-bold tracking-widest mb-1" style={{color:"#ffffff25"}}>EPS Est. Revision</p>
                      <p className="text-[16px] font-bold tabular-nums leading-none" style={{color:epsDelta!=null?epsDelta>0?GREEN:epsDelta<0?RED:AMBER:"#ffffff40"}}>
                        {epsDelta!=null?`${epsDelta>0?"+":""}${epsDelta.toFixed(1)}%`:"—"}
                      </p>
                      <p className="text-[7px] mt-0.5" style={{color:"#ffffff25"}}>
                        {latest.eps_avg!=null?`Now $${latest.eps_avg.toFixed(2)}`:""}
                        {prior.eps_avg!=null?` vs $${prior.eps_avg.toFixed(2)}`:""}
                      </p>
                    </div>
                    {/* Rev revision */}
                    <div className="rounded p-2.5" style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${DARK_BORDER}`}}>
                      <p className="text-[7px] uppercase font-bold tracking-widest mb-1" style={{color:"#ffffff25"}}>Rev Est. Revision</p>
                      <p className="text-[16px] font-bold tabular-nums leading-none" style={{color:revDelta!=null?revDelta>0?GREEN:revDelta<0?RED:AMBER:"#ffffff40"}}>
                        {revDelta!=null?`${revDelta>0?"+":""}${revDelta.toFixed(1)}%`:"—"}
                      </p>
                      <p className="text-[7px] mt-0.5" style={{color:"#ffffff25"}}>
                        {latest.rev_avg!=null?`Now ${latest.rev_avg>=1e9?`$${(latest.rev_avg/1e9).toFixed(1)}B`:latest.rev_avg>=1e6?`$${(latest.rev_avg/1e6).toFixed(0)}M`:latest.rev_avg.toFixed(0)}`:""}
                      </p>
                    </div>
                    {/* Beat rate */}
                    <div className="rounded p-2.5" style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${DARK_BORDER}`}}>
                      <p className="text-[7px] uppercase font-bold tracking-widest mb-1" style={{color:"#ffffff25"}}>Beat Rate (6Q)</p>
                      <p className="text-[16px] font-bold tabular-nums leading-none" style={{color:beatPct!=null?beatPct>=75?GREEN:beatPct>=50?AMBER:RED:"#ffffff40"}}>
                        {beatPct!=null?`${beatPct.toFixed(0)}%`:"—"}
                      </p>
                      <p className="text-[7px] mt-0.5" style={{color:"#ffffff25"}}>{earningsSurprises.filter(s=>(s.surprise_pct??0)>0).length}/{earningsSurprises.length} beats</p>
                    </div>
                    {/* EBITDA revision */}
                    <div className="rounded p-2.5" style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${DARK_BORDER}`}}>
                      <p className="text-[7px] uppercase font-bold tracking-widest mb-1" style={{color:"#ffffff25"}}>EBITDA Est. Revision</p>
                      <p className="text-[16px] font-bold tabular-nums leading-none" style={{color:ebitDelta!=null?ebitDelta>0?GREEN:ebitDelta<0?RED:AMBER:"#ffffff40"}}>
                        {ebitDelta!=null?`${ebitDelta>0?"+":""}${ebitDelta.toFixed(1)}%`:"—"}
                      </p>
                      <p className="text-[7px] mt-0.5" style={{color:"#ffffff25"}}>
                        {latest.num_analysts!=null?`${latest.num_analysts} analysts`:""}
                        {latest.date?` · ${latest.date.slice(0,7)}`:""}
                      </p>
                    </div>
                  </div>
                  {/* Estimate trend sparkline */}
                  <div>
                    <p className="text-[7px] uppercase font-bold tracking-widest mb-1.5" style={{color:"#ffffff20"}}>Forward EPS Estimate Trend</p>
                    <svg viewBox="0 0 320 50" style={{width:"100%",height:50}}>
                      {sorted.map((e,i)=>{
                        const xStep=sorted.length>1?280/(sorted.length-1):0;
                        const x=20+i*xStep;
                        const allEps=sorted.map(s=>s.eps_avg).filter((v):v is number=>v!=null);
                        const minE=Math.min(...allEps)*0.98, maxE=Math.max(...allEps)*1.02;
                        const y=e.eps_avg!=null?40-((e.eps_avg-minE)/(maxE-minE||1))*30:null;
                        return y!=null?(
                          <g key={i}>
                            {i>0&&sorted[i-1].eps_avg!=null&&(()=>{
                              const prevX=20+(i-1)*xStep;
                              const prevEps=sorted[i-1].eps_avg!;
                              const prevY=40-((prevEps-minE)/(maxE-minE||1))*30;
                              const col=e.eps_avg!>prevEps?GREEN:RED;
                              return<line x1={prevX} y1={prevY} x2={x} y2={y} stroke={col} strokeWidth="1.5" strokeOpacity="0.7"/>;
                            })()}
                            <circle cx={x} cy={y} r={3} fill={i===sorted.length-1?AMBER:"#ffffff30"}/>
                            <text x={x} y={y-5} textAnchor="middle" fontSize="6" fill="#ffffff40">{e.eps_avg!=null?`$${e.eps_avg.toFixed(2)}`:""}</text>
                            <text x={x} y={48} textAnchor="middle" fontSize="6" fill="#ffffff25">{e.date?.slice(0,7)??""}</text>
                          </g>
                        ):null;
                      })}
                    </svg>
                  </div>
                </div>
              </div>
              );
            })()}

            {/* ══ Beat Magnitude Trend ══ */}
            {earningsSurprises.filter(e=>e.surprise_pct!=null).length>=3&&(()=>{
              const sorted8=[...earningsSurprises].sort((a,b)=>a.date.localeCompare(b.date)).slice(-8);
              const vals=sorted8.map(e=>e.surprise_pct??null);
              const maxAbs=Math.max(...vals.filter((v):v is number=>v!=null).map(Math.abs),1);
              const firstHalf=vals.slice(0,Math.floor(vals.length/2)).filter((v):v is number=>v!=null);
              const secondHalf=vals.slice(Math.floor(vals.length/2)).filter((v):v is number=>v!=null);
              const avgFirst=firstHalf.length?firstHalf.reduce((a,b)=>a+b,0)/firstHalf.length:null;
              const avgSecond=secondHalf.length?secondHalf.reduce((a,b)=>a+b,0)/secondHalf.length:null;
              const trend=avgFirst!=null&&avgSecond!=null?avgSecond-avgFirst:null;
              return(
              <div className="rounded-lg overflow-hidden border" style={{background:CARD_BG,borderColor:DARK_BORDER}}>
                <div className="px-3 py-2 border-b flex items-center justify-between" style={{borderColor:DARK_BORDER}}>
                  <div>
                    <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff45"}}>EPS Beat Magnitude Trend</p>
                    <p className="text-[7.5px] mt-0.5" style={{color:"#ffffff20"}}>Surprise % per quarter — shrinking beats signal estimate catch-up risk</p>
                  </div>
                  <span className="text-[7px] px-1.5 py-0.5 rounded font-bold" style={{
                    background:trend!=null?trend>0?"rgba(16,185,129,0.15)":trend<-1?"rgba(239,68,68,0.15)":"rgba(245,158,11,0.15)":"rgba(255,255,255,0.06)",
                    color:trend!=null?trend>0?GREEN:trend<-1?RED:AMBER:"#ffffff40",
                    border:`1px solid ${trend!=null?trend>0?"rgba(16,185,129,0.3)":trend<-1?"rgba(239,68,68,0.3)":"rgba(245,158,11,0.3)":"rgba(255,255,255,0.1)"}`
                  }}>{trend!=null?trend>1?"BEATS EXPANDING ▲":trend<-1?"BEATS SHRINKING ▼":"BEATS STABLE →":"EPS SURPRISE"}</span>
                </div>
                <div className="px-3 py-3">
                  <div className="flex items-center gap-1 mb-2" style={{height:70}}>
                    {sorted8.map((e,i)=>{
                      const v=e.surprise_pct;
                      const isPos=v!=null&&v>0;
                      const barH=v!=null?Math.max(4,Math.abs(v)/maxAbs*58):4;
                      return(
                        <div key={i} className="flex-1 flex flex-col items-center" style={{gap:0}}>
                          {/* Positive bar goes up from midpoint */}
                          <div style={{height:34,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
                            {isPos&&<div style={{height:barH,width:"100%",background:GREEN,borderRadius:"2px 2px 0 0",opacity:i===sorted8.length-1?1:0.65}}/>}
                          </div>
                          {/* Baseline */}
                          <div style={{height:1,width:"100%",background:DARK_BORDER}}/>
                          {/* Negative bar goes down */}
                          <div style={{height:34,display:"flex",flexDirection:"column",justifyContent:"flex-start"}}>
                            {!isPos&&v!=null&&<div style={{height:barH,width:"100%",background:RED,borderRadius:"0 0 2px 2px",opacity:i===sorted8.length-1?1:0.65}}/>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-1">
                    {sorted8.map((e,i)=>(
                      <div key={i} className="flex-1 text-center">
                        <div className="text-[7px] font-bold tabular-nums" style={{color:(e.surprise_pct??0)>0?GREEN:RED}}>
                          {e.surprise_pct!=null?`${e.surprise_pct>0?"+":""}${e.surprise_pct.toFixed(1)}%`:"—"}
                        </div>
                        <div className="text-[5.5px] truncate" style={{color:"#ffffff20"}}>{e.date?.slice(0,7)??"" }</div>
                      </div>
                    ))}
                  </div>
                  {trend!=null&&(
                    <p className="text-[7px] mt-2" style={{color:trend>0?GREEN:trend<-1?RED:AMBER}}>
                      {trend>0?`Beat magnitude expanding: more recent beats average ${avgSecond?.toFixed(1)}% vs ${avgFirst?.toFixed(1)}% earlier — positive estimate revision signal`
                      :trend<-1?`Beat magnitude shrinking: recent beats only ${avgSecond?.toFixed(1)}% vs ${avgFirst?.toFixed(1)}% earlier — estimates may be catching up to reality`
                      :`Beat magnitude stable around ${earningsStreak.avgBeatMag?.toFixed(1)??"—"}% avg`}
                    </p>
                  )}
                </div>
              </div>
              );
            })()}

            {/* ══ LOOP 9: Multi-Factor Score Engine ══ */}
            <div className="rounded-lg overflow-hidden border" style={{background:CARD_BG,borderColor:DARK_BORDER}}>
              <div className="px-3 py-2 border-b flex items-center justify-between" style={{borderColor:DARK_BORDER}}>
                <div>
                  <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff45"}}>Multi-Factor Score Engine</p>
                  <p className="text-[7.5px] mt-0.5" style={{color:"#ffffff20"}}>Institutional quantitative factor model — Value · Quality · Momentum · Safety · Growth</p>
                </div>
                <span className="text-[7px] px-1.5 py-0.5 rounded font-bold" style={{background:"rgba(167,139,250,0.15)",color:PURPLE,border:`1px solid rgba(167,139,250,0.25)`}}>
                  FACTOR SCORE {factorScores.overall}
                </span>
              </div>
              <div className="px-3 py-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                  {/* Radar chart */}
                  <div>
                    <RadarChart
                      scores={[factorScores.value,factorScores.growth,factorScores.momentum,factorScores.safety,factorScores.quality]}
                      labels={[
                        {text:"VALUE",color:AMBER},
                        {text:"GROWTH",color:PURPLE},
                        {text:"MOMENTUM",color:BLUE},
                        {text:"SAFETY",color:TEAL},
                        {text:"QUALITY",color:GREEN},
                      ]}
                    />
                  </div>
                  {/* Sub-factor breakdown */}
                  <div className="space-y-3">
                    {([
                      {key:"value",label:"Value",color:AMBER,subs:factorScores.subs.value,score:factorScores.value},
                      {key:"quality",label:"Quality",color:GREEN,subs:factorScores.subs.quality,score:factorScores.quality},
                      {key:"momentum",label:"Momentum",color:BLUE,subs:factorScores.subs.momentum,score:factorScores.momentum},
                      {key:"safety",label:"Safety",color:TEAL,subs:factorScores.subs.safety,score:factorScores.safety},
                      {key:"growth",label:"Growth",color:PURPLE,subs:factorScores.subs.growth,score:factorScores.growth},
                    ] as const).map(f=>(
                      <div key={f.key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[8px] font-bold uppercase tracking-wider" style={{color:f.color}}>{f.label}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.07)"}}>
                              <div style={{width:`${f.score}%`,height:"100%",background:f.color,borderRadius:999}}/>
                            </div>
                            <span className="text-[8px] font-bold tabular-nums" style={{color:f.color,width:20,textAlign:"right"}}>{f.score}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                          {(f.subs as {name:string;score:number;detail:string}[]).map((s,si)=>(
                            <div key={si} className="flex items-center justify-between gap-1">
                              <span className="text-[7px]" style={{color:"#ffffff30",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span>
                              <span className="text-[7px] font-mono shrink-0" style={{color:"#ffffff20"}}>{s.detail}</span>
                              <span className="text-[7px] font-bold tabular-nums shrink-0" style={{color:s.score>=70?GREEN:s.score>=40?AMBER:RED,width:18,textAlign:"right"}}>{s.score}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Quality composite banner */}
            <div className="rounded-lg p-4 flex items-center gap-6 border" style={{background:"rgba(59,130,246,0.06)",borderColor:DARK_BORDER}}>
              <div className="text-center shrink-0">
                <p className="text-[7px] font-bold uppercase tracking-widest mb-1" style={{color:"#ffffff30"}}>Quality Score</p>
                <p className="text-[40px] font-bold tabular-nums leading-none" style={{color:qualityScore>=70?GREEN:qualityScore>=40?AMBER:RED}}>{qualityScore}</p>
                <p className="text-[8px] mt-1" style={{color:"#ffffff30"}}>out of 100</p>
              </div>
              <div className="flex-1 grid grid-cols-4 gap-3">
                <Pill label="Piotroski" value={`${piotroski.score}/${piotroski.maxScore}`} color={piotroski.score>=7?GREEN:piotroski.score>=4?AMBER:RED}/>
                <Pill label="Altman Z" value={altmanZ?`${altmanZ.z}`:"—"} color={altmanZ?.color??AMBER}/>
                <Pill label="Imp. Growth" value={reverseDCF?`${reverseDCF.impliedGrowth}%`:"—"} color={BLUE}/>
                <Pill label="Beat Streak" value={`${earningsStreak.streak}×`} color={earningsStreak.streak>=3?GREEN:earningsStreak.streak>=1?AMBER:RED}/>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {/* Piotroski F-Score detail */}
              <Card title="Piotroski F-Score" sub="9-factor fundamental quality" badge={`${piotroski.score}/${piotroski.maxScore}`}>
                <div className="space-y-1.5 py-1">
                  {piotroski.criteria.map((c,i)=>(
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold" style={{color:c.pass?GREEN:RED}}>{c.pass?"✓":"✗"}</span>
                        <span className="text-[9px]" style={{color:"#ffffff55"}}>{c.label}</span>
                      </div>
                      <span className="text-[8px] font-mono" style={{color:"#ffffff30"}}>{c.desc}</span>
                    </div>
                  ))}
                  {piotroski.criteria.length===0&&<p className="text-[10px] text-center py-4" style={{color:"#ffffff20"}}>Insufficient history for F-Score</p>}
                </div>
              </Card>

              {/* Altman Z-Score */}
              <Card title="Altman Z-Score" sub="Financial distress predictor" badge={altmanZ?.zone??"N/A"}>
                {altmanZ?(
                  <div>
                    <GaugeBar
                      value={altmanZ.z}
                      min={-1} max={5}
                      zones={[
                        {from:-1,to:1.81,color:RED,label:"Distress"},
                        {from:1.81,to:2.99,color:AMBER,label:"Gray Zone"},
                        {from:2.99,to:5,color:GREEN,label:"Safe"},
                      ]}
                    />
                    <div className="mt-2 space-y-1">
                      {[
                        {k:"X1 = WC/TA",v:altmanZ.x1,w:"1.2"},
                        {k:"X2 = RE/TA",v:altmanZ.x2,w:"1.4"},
                        {k:"X3 = EBIT/TA",v:altmanZ.x3,w:"3.3"},
                        {k:"X4 = MC/TL",v:altmanZ.x4,w:"0.6"},
                        {k:"X5 = Rev/TA",v:altmanZ.x5,w:"1.0"},
                      ].map((r,i)=>(
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-[8px]" style={{color:"#ffffff35"}}>{r.k} <span style={{color:"#ffffff20"}}>w={r.w}</span></span>
                          <span className="text-[8px] font-mono" style={{color:"#ffffff55"}}>{r.v.toFixed(3)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ):(
                  <div className="py-6 text-center"><p className="text-[10px]" style={{color:"#ffffff20"}}>Missing balance sheet data</p></div>
                )}
              </Card>

              {/* Reverse DCF */}
              <Card title="Reverse DCF" sub="Growth implied by current price" badge="WACC 9%">
                {reverseDCF?(
                  <div className="py-2 space-y-3">
                    <div className="text-center">
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{color:"#ffffff30"}}>Implied 5Y Rev CAGR</p>
                      <p className="text-[32px] font-bold tabular-nums leading-none" style={{color:reverseDCF.impliedGrowth>20?GREEN:reverseDCF.impliedGrowth>5?BLUE:RED}}>
                        {reverseDCF.impliedGrowth}%
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Pill label="FCF Yield" value={`${reverseDCF.fcfYield}%`} color={reverseDCF.fcfYield>4?GREEN:reverseDCF.fcfYield>2?AMBER:RED}/>
                      <Pill label="Hist CAGR" value={reverseDCF.histCAGR!=null?`${reverseDCF.histCAGR}%`:"—"} color={TEAL}/>
                    </div>
                    {reverseDCF.histCAGR!=null&&(
                      <div className="rounded p-2 text-center" style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${DARK_BORDER}`}}>
                        <p className="text-[9px]" style={{color:"#ffffff40"}}>
                          {reverseDCF.impliedGrowth > reverseDCF.histCAGR
                            ? `Priced at ${(reverseDCF.impliedGrowth - reverseDCF.histCAGR).toFixed(1)}pp above historical trend`
                            : `Priced ${(reverseDCF.histCAGR - reverseDCF.impliedGrowth).toFixed(1)}pp below historical trend`}
                        </p>
                      </div>
                    )}
                  </div>
                ):(
                  <div className="py-6 text-center"><p className="text-[10px]" style={{color:"#ffffff20"}}>Need FCF and market cap</p></div>
                )}
              </Card>

              {/* Revenue Segments */}
              {segmentItems.length>0?(
                <Card title="Revenue Segments" sub={segments?.date??"Product breakdown"} badge="BREAKDOWN">
                  <DonutChart data={segmentItems}/>
                </Card>
              ):(
                <Card title="Revenue Segments" sub="Not available from FMP">
                  <NoData W={320} H={120}/>
                </Card>
              )}

              {/* Geographic Revenue */}
              {geoItems.length>0?(
                <Card title="Geographic Revenue" sub={geoSegments?.date??"By region"} badge="GEO">
                  <DonutChart data={geoItems}/>
                </Card>
              ):(
                <Card title="Geographic Revenue" sub="Not available from FMP">
                  <NoData W={320} H={120}/>
                </Card>
              )}

              {/* ══ LOOP 21: Segment Revenue Trend (mix shift over time) ══ */}
              {segmentHistory.length>=2&&(()=>{
                // Collect all segment names
                const allSegs=Array.from(new Set(segmentHistory.flatMap(p=>Object.keys(p.data)))).slice(0,6);
                const labels=segmentHistory.map(p=>p.date.slice(0,7));
                return(
                <Card title="Segment Revenue Trend" sub="Business mix evolution — which segments are gaining/losing share" badge="MIX SHIFT">
                  <StackedBar
                    labels={labels}
                    series={allSegs.map((seg,i)=>({
                      name:seg.length>20?seg.slice(0,20)+"…":seg,
                      values:segmentHistory.map(p=>p.data[seg]??0),
                      color:PALETTE[i%PALETTE.length],
                    }))}
                  />
                </Card>
                );
              })()}

              {geoSegmentHistory.length>=2&&(()=>{
                const allGeos=Array.from(new Set(geoSegmentHistory.flatMap(p=>Object.keys(p.data)))).slice(0,6);
                const labels=geoSegmentHistory.map(p=>p.date.slice(0,7));
                return(
                <Card title="Geographic Revenue Trend" sub="Regional mix shift — identifying growth markets and concentration risk" badge="GEO SHIFT">
                  <StackedBar
                    labels={labels}
                    series={allGeos.map((geo,i)=>({
                      name:geo.length>20?geo.slice(0,20)+"…":geo,
                      values:geoSegmentHistory.map(p=>p.data[geo]??0),
                      color:PALETTE[i%PALETTE.length],
                    }))}
                  />
                </Card>
                );
              })()}

              {/* Analyst Forward Estimates */}
              <Card title="Analyst Forward Estimates" sub="Consensus revenue forecast">
                {analystEstimates.length>0?(
                  <div className="space-y-2">
                    {analystEstimates.slice(0,4).map((e,i)=>{
                      const curRev=facts.revenue??0;
                      const fwdRev=e.rev_avg??0;
                      const implG=curRev&&fwdRev?((fwdRev-curRev)/curRev*100):null;
                      return(
                        <div key={i} className="rounded p-2" style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${DARK_BORDER}`}}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[8.5px] font-bold" style={{color:"#ffffff50"}}>{e.date?.slice(0,7)??""}</span>
                            {e.num_analysts&&<span className="text-[7.5px]" style={{color:"#ffffff25"}}>{Math.round(e.num_analysts)} analysts</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            {e.rev_avg!=null&&(
                              <div>
                                <p className="text-[7px]" style={{color:"#ffffff25"}}>Revenue Est</p>
                                <p className="text-[11px] font-bold" style={{color:BLUE}}>{abbr(e.rev_avg,"$")}</p>
                                {implG!=null&&<p className="text-[8px]" style={{color:implG>=0?GREEN:RED}}>{implG>=0?"+":""}{implG.toFixed(1)}% YoY</p>}
                              </div>
                            )}
                            {e.eps_avg!=null&&(
                              <div>
                                <p className="text-[7px]" style={{color:"#ffffff25"}}>EPS Est</p>
                                <p className="text-[11px] font-bold" style={{color:TEAL}}>${e.eps_avg.toFixed(2)}</p>
                              </div>
                            )}
                            {e.ebitda_avg!=null&&(
                              <div>
                                <p className="text-[7px]" style={{color:"#ffffff25"}}>EBITDA Est</p>
                                <p className="text-[11px] font-bold" style={{color:AMBER}}>{abbr(e.ebitda_avg,"$")}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ):(
                  <div className="py-6 text-center"><p className="text-[10px]" style={{color:"#ffffff20"}}>No analyst estimates available</p></div>
                )}
              </Card>

              {/* ══ LOOP 10: Beneish M-Score ══ */}
              <Card title="Beneish M-Score" sub="Forensic earnings manipulation detector (8-factor)" badge={beneishMScore?.zone??"N/A"}>
                {beneishMScore?(
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="text-center shrink-0">
                        <p className="text-[28px] font-bold tabular-nums leading-none" style={{color:beneishMScore.color}}>{beneishMScore.score}</p>
                        <p className="text-[7px] font-bold uppercase mt-0.5" style={{color:beneishMScore.color}}>{beneishMScore.zone}</p>
                      </div>
                      <div className="flex-1 space-y-1">
                        <GaugeBar value={beneishMScore.score} min={-4} max={1}
                          zones={[
                            {from:-4,to:-2.22,color:GREEN,label:"Clean"},
                            {from:-2.22,to:-1.78,color:AMBER,label:"Gray"},
                            {from:-1.78,to:1,color:RED,label:"Risk"},
                          ]}
                          H={38}
                        />
                        <p className="text-[7px] text-center" style={{color:"#ffffff25"}}>
                          {beneishMScore.flagCount} of {beneishMScore.components.length} flags raised · threshold −1.78
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1 mt-1">
                      {beneishMScore.components.map((c,i)=>(
                        <div key={i} className="flex items-center justify-between gap-1">
                          <span className="text-[7.5px] font-bold" style={{color:c.isFlag?RED:"#ffffff25",width:36}}>{c.key}</span>
                          <span className="text-[7px] flex-1" style={{color:"#ffffff25",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                          <span className="text-[7px] font-mono tabular-nums" style={{color:"#ffffff35",width:32,textAlign:"right"}}>{c.value.toFixed(2)}</span>
                          <span className="text-[7px] font-bold" style={{color:c.isFlag?RED:GREEN,width:6}}>{c.isFlag?"⚑":""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ):(
                  <div className="py-6 text-center"><p className="text-[10px]" style={{color:"#ffffff20"}}>Need 2+ years of financial history</p></div>
                )}
              </Card>

              {/* ══ LOOP 13: Relative Value Scorecard ══ */}
              <Card title="Relative Value Scorecard" sub="Premium / discount vs peer median — valuation context" badge="REL VAL">
                {relativeValue.rows.length>0?(
                  <div className="space-y-2 py-1">
                    <div className="space-y-1">
                      {relativeValue.rows.map((r,i)=>{
                        const isGood=r.lowerBetter?(r.premium??0)<0:(r.premium??0)>0;
                        const prem=r.premium;
                        return(
                          <div key={i} className="rounded p-2" style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${DARK_BORDER}`}}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[8px] font-bold" style={{color:"#ffffff50"}}>{r.label}</span>
                              <span className="text-[7px] font-bold" style={{color:isGood?GREEN:RED}}>
                                {prem!=null?(prem>=0?"+":"")+prem.toFixed(1)+"% vs peers":"—"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold" style={{color:isGood?GREEN:AMBER}}>{r.company?.toFixed(1)}{r.unit}</span>
                              <span className="text-[7px]" style={{color:"#ffffff25"}}>vs peer {r.peer?.toFixed(1)}{r.unit}</span>
                            </div>
                            {prem!=null&&(
                              <div className="mt-1.5 h-1 rounded overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
                                <div style={{
                                  width:`${Math.min(100,Math.abs(prem)*2)}%`,
                                  height:"100%",
                                  background:isGood?GREEN:RED,
                                  marginLeft:prem<0?"0":`${50}%`,
                                  maxWidth:"50%",
                                  borderRadius:999,
                                }}/>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ):(
                  <div className="py-6 text-center"><p className="text-[10px]" style={{color:"#ffffff20"}}>Need peer data for relative scoring</p></div>
                )}
              </Card>

              {/* ══ LOOP 13: PEG + Magic Formula ══ */}
              <Card title="PEG Ratio & Magic Formula" sub="Growth-adjusted value + Greenblatt earnings yield + ROIC" badge="QUANT">
                <div className="space-y-3 py-1">
                  {/* PEG Ratio */}
                  <div className="rounded p-3" style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${DARK_BORDER}`}}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8px] font-bold uppercase tracking-wider" style={{color:"#ffffff35"}}>PEG Ratio</span>
                      <span className="text-[7px]" style={{color:"#ffffff20"}}>P/E ÷ EPS Growth %</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-[28px] font-bold tabular-nums" style={{color:relativeValue.peg!=null?relativeValue.peg<1?GREEN:relativeValue.peg<2?AMBER:RED:AMBER}}>
                        {relativeValue.peg!=null?relativeValue.peg.toFixed(2):"—"}
                      </p>
                      <div>
                        <p className="text-[8px]" style={{color:relativeValue.peg!=null&&relativeValue.peg<1?GREEN:relativeValue.peg!=null&&relativeValue.peg<2?AMBER:RED}}>
                          {relativeValue.peg!=null?(relativeValue.peg<1?"Potentially undervalued":relativeValue.peg<2?"Fair value":"Growth priced in"):facts.eps_growth_yoy!=null&&facts.eps_growth_yoy<=0?"Negative EPS growth — PEG undefined":"EPS growth or P/E unavailable"}
                        </p>
                        <p className="text-[7px] mt-0.5" style={{color:"#ffffff20"}}>&lt;1 = cheap · 1–2 = fair · &gt;2 = expensive</p>
                        <p className="text-[7px]" style={{color:"#ffffff20"}}>P/E {facts.pe_ratio?.toFixed(1)??"—"}x ÷ EPS g {facts.eps_growth_yoy?.toFixed(1)??"—"}%</p>
                      </div>
                    </div>
                  </div>
                  {/* Magic Formula */}
                  <div className="rounded p-3" style={{background:"rgba(167,139,250,0.06)",border:"1px solid rgba(167,139,250,0.15)"}}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8px] font-bold uppercase tracking-wider" style={{color:PURPLE}}>Magic Formula Score</span>
                      <span className="text-[7px]" style={{color:"#ffffff20"}}>Greenblatt: EY + ROIC</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-[28px] font-bold tabular-nums" style={{color:relativeValue.magicScore!=null?relativeValue.magicScore>40?GREEN:relativeValue.magicScore>20?AMBER:RED:PURPLE}}>
                        {relativeValue.magicScore!=null?relativeValue.magicScore.toFixed(1):"—"}
                      </p>
                      <div>
                        <p className="text-[8px]" style={{color:"#ffffff40"}}>Earnings Yield + ROIC composite</p>
                        <p className="text-[7px] mt-0.5" style={{color:"#ffffff20"}}>EY: {relativeValue.earningsYield!=null?relativeValue.earningsYield.toFixed(1)+"%":"—"} · ROIC: {facts.roic!=null?facts.roic.toFixed(1)+"%":"—"}</p>
                        <p className="text-[7px]" style={{color:"#ffffff20"}}>&gt;40 = top decile · &gt;20 = above avg</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* ══ LOOP 15: Transcript Intelligence ══ */}
              {transcriptData&&(
                <div className="rounded-lg overflow-hidden border col-span-2 lg:col-span-3" style={{background:CARD_BG,borderColor:DARK_BORDER}}>
                  <div className="px-3 py-2 border-b flex items-center justify-between" style={{borderColor:DARK_BORDER}}>
                    <div>
                      <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff45"}}>Earnings Call Intelligence</p>
                      <p className="text-[7.5px] mt-0.5" style={{color:"#ffffff20"}}>Management guidance · Analyst Q&A themes · Auto-extracted from most recent transcript ({Math.round(transcriptData.totalLength/1000)}k chars)</p>
                    </div>
                    <span className="text-[7px] px-1.5 py-0.5 rounded font-bold" style={{background:"rgba(167,139,250,0.15)",color:PURPLE,border:`1px solid rgba(167,139,250,0.25)`}}>TRANSCRIPT</span>
                  </div>
                  {/* Sentiment Score Row */}
                  {transcriptData.sentiment&&(
                    <div className="px-3 py-2 border-b flex items-center gap-4" style={{borderColor:DARK_BORDER,background:"rgba(255,255,255,0.02)"}}>
                      <div className="flex items-center gap-2">
                        <span className="text-[7px] uppercase font-bold tracking-widest" style={{color:"#ffffff25"}}>Tone Score</span>
                        <span className="text-[13px] font-bold tabular-nums" style={{color:transcriptData.sentiment.score>=60?GREEN:transcriptData.sentiment.score>=40?AMBER:RED}}>
                          {transcriptData.sentiment.score}/100
                        </span>
                        <span className="text-[7px] font-bold px-1.5 py-0.5 rounded" style={{background:transcriptData.sentiment.score>=60?"rgba(16,185,129,0.12)":transcriptData.sentiment.score>=40?"rgba(245,158,11,0.12)":"rgba(239,68,68,0.12)",color:transcriptData.sentiment.score>=60?GREEN:transcriptData.sentiment.score>=40?AMBER:RED,border:`1px solid ${transcriptData.sentiment.score>=60?"rgba(16,185,129,0.25)":transcriptData.sentiment.score>=40?"rgba(245,158,11,0.25)":"rgba(239,68,68,0.25)"}`}}>
                          {transcriptData.sentiment.score>=60?"BULLISH TONE":transcriptData.sentiment.score>=40?"NEUTRAL":"CAUTIOUS TONE"}
                        </span>
                      </div>
                      <div className="flex-1 h-2 rounded overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
                        <div style={{width:`${transcriptData.sentiment.score}%`,height:"100%",background:`linear-gradient(90deg,${transcriptData.sentiment.score>=60?GREEN:transcriptData.sentiment.score>=40?AMBER:RED},${GREEN})`,borderRadius:999,transition:"width 0.3s"}}/>
                      </div>
                      <div className="flex items-center gap-3 text-[7px]" style={{color:"#ffffff25"}}>
                        {transcriptData.sentiment.topBull&&<span style={{color:GREEN}}>▲ {transcriptData.sentiment.topBull}</span>}
                        {transcriptData.sentiment.topBear&&<span style={{color:RED}}>▼ {transcriptData.sentiment.topBear}</span>}
                      </div>
                    </div>
                  )}
                  <div className="px-3 py-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Guidance */}
                    <div>
                      <p className="text-[7.5px] font-bold uppercase tracking-widest mb-2" style={{color:TEAL}}>Management Guidance & Outlook</p>
                      {transcriptData.guidance.length>0?(
                        <div className="space-y-2">
                          {transcriptData.guidance.map((g,i)=>(
                            <div key={i} className="rounded px-2 py-1.5 text-[8px] leading-relaxed" style={{background:"rgba(20,184,166,0.06)",border:"1px solid rgba(20,184,166,0.15)",color:"#ffffff60"}}>
                              "{g.length>300?g.slice(0,300)+"…":g}"
                            </div>
                          ))}
                        </div>
                      ):<p className="text-[8px]" style={{color:"#ffffff20"}}>No forward-looking guidance statements found</p>}
                    </div>
                    {/* Q&A themes + numbers */}
                    <div className="space-y-3">
                      {transcriptData.hasQA&&transcriptData.questions.length>0&&(
                        <div>
                          <p className="text-[7.5px] font-bold uppercase tracking-widest mb-2" style={{color:BLUE}}>Analyst Q&A — Key Questions</p>
                          <div className="space-y-1.5">
                            {transcriptData.questions.map((q,i)=>(
                              <div key={i} className="rounded px-2 py-1.5 flex items-start gap-2" style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.15)"}}>
                                <span className="text-[7px] font-bold shrink-0 mt-0.5" style={{color:"#60a5fa"}}>Q{i+1}</span>
                                <p className="text-[7.5px] leading-snug" style={{color:"#ffffff55"}}>{q.length>220?q.slice(0,220)+"…":q}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {transcriptData.keyNumbers.length>0&&(
                        <div>
                          <p className="text-[7.5px] font-bold uppercase tracking-widest mb-1.5" style={{color:AMBER}}>Key Numbers Cited</p>
                          <div className="flex flex-wrap gap-1.5">
                            {transcriptData.keyNumbers.slice(0,10).map((n,i)=>(
                              <span key={i} className="text-[8px] font-bold tabular-nums rounded px-1.5 py-0.5" style={{background:"rgba(245,158,11,0.12)",color:AMBER,border:"1px solid rgba(245,158,11,0.2)"}}>{n}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {/* ══ LOOP 17: Insider Trading Activity ══ */}
              {insiderTrading.length>0&&(()=>{
                // Summarize: net buy/sell count and value
                const buys=insiderTrading.filter(t=>/P-Purchase|buy|acquired/i.test(t.transaction||""));
                const sells=insiderTrading.filter(t=>/S-Sale|sell|sold|disposed/i.test(t.transaction||""));
                const netBuys=buys.length-sells.length;
                const netVal=(buys.reduce((s,t)=>s+(t.value??0),0))-(sells.reduce((s,t)=>s+(t.value??0),0));
                const sentiment=netBuys>2?GREEN:netBuys<-2?RED:AMBER;
                const abbr2=(v:number|null|undefined)=>v==null?"—":Math.abs(v)>=1e6?`$${(Math.abs(v)/1e6).toFixed(1)}M`:Math.abs(v)>=1e3?`$${(Math.abs(v)/1e3).toFixed(0)}K`:`$${Math.abs(v).toFixed(0)}`;
                return(
                <div className="rounded-lg overflow-hidden border" style={{background:CARD_BG,borderColor:DARK_BORDER}}>
                  <div className="px-3 py-2 border-b flex items-center justify-between" style={{borderColor:DARK_BORDER}}>
                    <div>
                      <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff45"}}>Insider Activity (Form 4)</p>
                      <p className="text-[7.5px] mt-0.5" style={{color:"#ffffff20"}}>Recent executive and director transactions · Net sentiment: {buys.length}B / {sells.length}S</p>
                    </div>
                    <span className="text-[7px] px-1.5 py-0.5 rounded font-bold" style={{background:sentiment+"25",color:sentiment,border:`1px solid ${sentiment}40`}}>
                      {netBuys>0?`+${netBuys} NET BUY`:netBuys<0?`${netBuys} NET SELL`:"NEUTRAL"}
                    </span>
                  </div>
                  <div className="px-3 py-2">
                    {/* Summary bar */}
                    <div className="grid grid-cols-3 gap-3 mb-3 pb-2 border-b" style={{borderColor:DARK_BORDER}}>
                      <div>
                        <p className="text-[7px] uppercase tracking-widest" style={{color:"#ffffff25"}}>Buys ({buys.length})</p>
                        <p className="text-[9px] font-bold" style={{color:GREEN}}>{abbr2(buys.reduce((s,t)=>s+(t.value??0),0))}</p>
                      </div>
                      <div>
                        <p className="text-[7px] uppercase tracking-widest" style={{color:"#ffffff25"}}>Sells ({sells.length})</p>
                        <p className="text-[9px] font-bold" style={{color:RED}}>{abbr2(sells.reduce((s,t)=>s+(t.value??0),0))}</p>
                      </div>
                      <div>
                        <p className="text-[7px] uppercase tracking-widest" style={{color:"#ffffff25"}}>Net Flow</p>
                        <p className="text-[9px] font-bold" style={{color:netVal>=0?GREEN:RED}}>{netVal>=0?"+":""}{abbr2(netVal)}</p>
                      </div>
                    </div>
                    {/* Transaction rows */}
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {insiderTrading.slice(0,12).map((t,i)=>{
                        const isBuy=/P-Purchase|buy|acquired/i.test(t.transaction||"");
                        const isSell=/S-Sale|sell|sold|disposed/i.test(t.transaction||"");
                        const col=isBuy?GREEN:isSell?RED:AMBER;
                        return(
                          <div key={i} className="flex items-center gap-2 rounded px-2 py-1.5" style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${DARK_BORDER}`}}>
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:col}}/>
                            <div className="flex-1 min-w-0">
                              <span className="text-[8px] font-bold" style={{color:"#ffffff60"}}>{t.name}</span>
                              {t.title&&<span className="text-[7px] ml-1.5" style={{color:"#ffffff25"}}>{t.title.length>25?t.title.slice(0,25)+"…":t.title}</span>}
                            </div>
                            <span className="text-[7.5px] font-bold shrink-0" style={{color:col}}>{t.transaction?.replace("P-Purchase","BUY").replace("S-Sale","SELL")}</span>
                            <span className="text-[7.5px] tabular-nums shrink-0" style={{color:"#ffffff35"}}>{abbr2(t.value)}</span>
                            <span className="text-[7px] tabular-nums shrink-0" style={{color:"#ffffff25"}}>{t.date?.slice(0,7)??""}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                );
              })()}

              {/* Earnings beat/miss detail */}
              <Card title="Earnings Quality" sub="Beat/miss streak + history" badge={earningsStreak.streak>0?`${earningsStreak.streak}-STREAK BEAT`:earningsStreak.total>0?"CHECK":""}>
                <div className="space-y-2 py-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <Pill label="Beat Streak" value={`${earningsStreak.streak}×`} color={earningsStreak.streak>=3?GREEN:earningsStreak.streak>=1?AMBER:RED}/>
                    <Pill label="Beat Rate" value={earningsStreak.total>0?`${Math.round(earningsStreak.beats/earningsStreak.total*100)}%`:"—"} color={BLUE}/>
                    <Pill label="Avg Beat" value={earningsStreak.avgBeatMag!=null?`+${earningsStreak.avgBeatMag.toFixed(1)}%`:"—"} color={TEAL}/>
                    <Pill label="Misses" value={`${earningsStreak.misses}`} color={RED}/>
                  </div>
                  {earningsSurprises.slice(0,8).map((e,i)=>{
                    const s=e.surprise_pct??0;
                    const w=Math.min(Math.abs(s)*3,100);
                    return(
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[7.5px] tabular-nums" style={{color:"#ffffff30",width:48}}>{e.date?.slice(0,7)??""}</span>
                        <div className="flex-1 h-[6px] rounded overflow-hidden" style={{background:"#ffffff08"}}>
                          <div style={{width:`${w}%`,height:"100%",background:s>=0?GREEN:RED,borderRadius:3}}/>
                        </div>
                        <span className="text-[8px] font-mono font-bold tabular-nums" style={{color:s>=0?GREEN:RED,width:36,textAlign:"right"}}>
                          {s>=0?"+":""}{s.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                  {earningsSurprises.length===0&&<p className="text-[10px] text-center py-2" style={{color:"#ffffff20"}}>No earnings surprise data</p>}
                </div>
              </Card>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
