'use client';
import {useEffect,useRef,useState} from 'react';
type Recognition = {
 lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;
 onresult:((e:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;
 onerror:((e:{error?:string})=>void)|null;onend:(()=>void)|null;
 start:()=>void;stop:()=>void;abort:()=>void;
};
type SpeechWindow=Window & {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
/** Dictation only: review the transcript before explicitly submitting. */
export function useSpeechInput(onTranscript:(text:string)=>void) {
 const [supported,setSupported]=useState(false),[listening,setListening]=useState(false),[notice,setNotice]=useState('');
 const ref=useRef<Recognition|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),callback=useRef(onTranscript);
 callback.current=onTranscript;
 useEffect(()=>{
  const w=window as SpeechWindow;setSupported(!!(w.SpeechRecognition||w.webkitSpeechRecognition));
  return()=>{if(timer.current)clearTimeout(timer.current);if(ref.current){ref.current.onresult=null;ref.current.onerror=null;ref.current.onend=null;ref.current.abort();ref.current=null;}};
 },[]);
 function stop(){ref.current?.stop();}
 function cancel(){if(timer.current)clearTimeout(timer.current);if(ref.current){ref.current.onresult=null;ref.current.onerror=null;ref.current.onend=null;ref.current.abort();ref.current=null;}setListening(false);setNotice('');}
 function start(){
  if(ref.current)return;
  const w=window as SpeechWindow,Ctor=w.SpeechRecognition||w.webkitSpeechRecognition;
  if(!Ctor){setNotice('Dictation is not available in this browser. Type your question instead.');return;}
  let rec:Recognition;try{rec=new Ctor();}catch{setNotice('Dictation is unavailable here. Type your question instead.');return;}ref.current=rec;rec.lang=document.documentElement.lang||'en';rec.continuous=false;rec.interimResults=false;rec.maxAlternatives=1;
  const finish=()=>{if(ref.current!==rec)return;if(timer.current)clearTimeout(timer.current);rec.onresult=null;rec.onerror=null;rec.onend=null;ref.current=null;setListening(false);};
  rec.onresult=e=>{const text=Array.from(e.results).map(r=>r[0]?.transcript??'').join(' ').trim();if(text){callback.current(text.slice(0,300));setNotice('Your words are in the message box. Review them, then select Find my tool.');}};
  rec.onerror=e=>{setNotice(e.error==='not-allowed'||e.error==='service-not-allowed'?'Microphone access was not allowed. Type your question, or allow the microphone in your browser settings.':e.error==='no-speech'?'No speech was heard. Try again or type your question.':'Dictation could not connect. You can still type your question.');finish();};
  rec.onend=finish;
  try{setNotice('Listening. Select Stop when you are finished.');setListening(true);rec.start();timer.current=setTimeout(()=>{rec.stop();setNotice('Dictation stopped. Review the message or try again.');},25000);}catch{setNotice('Dictation is unavailable here. Open the page in a supported browser or type instead.');finish();}
 }
 return{supported,listening,notice,start,stop,cancel};
}
