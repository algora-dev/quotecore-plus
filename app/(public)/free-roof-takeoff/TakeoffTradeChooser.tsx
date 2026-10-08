'use client';
import {Icon,ActionLink} from './TakeoffUI';
import type {TakeoffTrade} from './takeoff-report-model';
import s from './TakeoffExperience.module.css';
export function TakeoffTradeChooser({onChoose}:{onChoose:(trade:TakeoffTrade)=>void}){
 const choices=[{trade:'roofing' as const,icon:'roof' as const,title:'Roofing',text:'Roof areas, ridges, hips, valleys and flashings. With roof-pitch calculations.'},
 {trade:'cladding' as const,icon:'wall' as const,title:'Cladding',text:'Wall areas, cladding, building wrap, trims and openings.'},
 {trade:'flooring' as const,icon:'floor' as const,title:'Flooring',text:'Floor coverings, underlay, skirting, scotia and transitions.'}];
 return <div className={`${s.root} ${s.page}`}><div className={s.container}><div className={s.crumb}><a href="/free-tools">Free tools</a><Icon name="chevron"/><span>Digital takeoff</span></div>
  <div className={`${s.launcher} ${s.dark}`}><p className={s.eyebrow}>Free digital takeoff</p><h1>What are you measuring?</h1><p>Start with your trade. Choose your components, add a plan and turn measurements into a free quote.</p></div>
  <div className={s.tradeGrid}>{choices.map(c=><button key={c.trade} className={s.tradeCard} onClick={()=>onChoose(c.trade)}><Icon name={c.icon}/><h2>{c.title}</h2><p>{c.text}</p><span>Start {c.trade}<Icon name="arrow"/></span></button>)}</div>
  <div className={s.launcherFoot}><p><Icon name="check" style={{width:15,height:15,verticalAlign:'middle',marginRight:6}}/>No signup to start · Desktop &amp; mobile · PDF or image plans</p><ActionLink href="/takeoff-demo" target="_blank" rel="noopener noreferrer"><Icon name="play"/>Explore the app demo</ActionLink></div>
 </div></div>;
}
