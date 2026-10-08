'use client';
import {useState} from 'react';
import {FreeTakeoffApp} from './FreeTakeoffApp';
import {TakeoffTradeChooser} from './TakeoffTradeChooser';
import {ROOFING_TAKEOFF_CONFIG,CLADDING_TAKEOFF_CONFIG,FLOORING_TAKEOFF_CONFIG} from './tradeConfig';
import type {TakeoffTrade} from './takeoff-report-model';
const CONFIGS={roofing:ROOFING_TAKEOFF_CONFIG,cladding:CLADDING_TAKEOFF_CONFIG,flooring:FLOORING_TAKEOFF_CONFIG};
export function TakeoffLauncher(){
 const [trade,setTrade]=useState<TakeoffTrade|null>(null);
 return trade?<FreeTakeoffApp key={trade} config={CONFIGS[trade]} onChangeTrade={()=>setTrade(null)}/>:<TakeoffTradeChooser onChoose={setTrade}/>;
}
