"use client";
import { useState, useCallback } from "react";
import styles from "./YouTubeLite.module.css";

interface YouTubeLiteProps { videoId:string; title:string; start?:number; thumbnail?:string; className?:string; showTitle?:boolean; rounded?:boolean; uploadDate?:string; }
export default function YouTubeLite({videoId,title,start,thumbnail,className="",showTitle=false,rounded=true,uploadDate="2026-07-28"}:YouTubeLiteProps){
  const [activated,setActivated]=useState(false); const [imgError,setImgError]=useState(false);
  const handleClick=useCallback(()=>setActivated(true),[]);
  const thumbSrc=thumbnail||(imgError?`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`:`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
  const embedUrl=start?`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&start=${start}&rel=0`:`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
  const containerClass=[styles.container,styles.aspect,rounded?styles.rounded:"",className].filter(Boolean).join(" ");
  if(activated)return <div className={containerClass}><iframe src={embedUrl} title={title} className={styles.frame} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" /></div>;
  return <><button type="button" onClick={handleClick} className={containerClass} aria-label={`Play: ${title}`} itemScope itemType="https://schema.org/VideoObject">
    <img src={thumbSrc} alt={title} className={styles.thumb} loading="lazy" onError={()=>setImgError(true)} />
    <meta itemProp="name" content={title}/><meta itemProp="thumbnailUrl" content={thumbSrc}/><meta itemProp="embedUrl" content={`https://www.youtube-nocookie.com/embed/${videoId}`}/><meta itemProp="contentUrl" content={`https://www.youtube.com/watch?v=${videoId}`}/><meta itemProp="uploadDate" content={uploadDate}/>
    <div className={styles.overlay}/><div className={styles.playWrap}><div className={styles.play}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.14v13.72c0 .78.84 1.26 1.5.86l10-6.86a1 1 0 000-1.72l-10-6.86A1 1 0 008 5.14z"/></svg></div></div>
    {showTitle?<div className={styles.title}><p>{title}</p></div>:null}
  </button><noscript><a href={`https://www.youtube.com/watch?v=${videoId}`} className={styles.srOnly} aria-label={`Watch: ${title}`}>Watch: {title} on YouTube</a></noscript></>;
}
