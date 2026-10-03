'use client';
/* One-deploy diagnostic for the iPhone Safari bottom-band question (2026-10-03).
   Enabled ONLY via ?saViewportDebug on the standalone assistant route.
   Answers ONE question: which painted layer occupies the visible band under the
   dock - html (red), body (amber), standalone host (teal), SA root (violet), or
   none of them (= Safari chrome / compositor underpaint). Lime sentinel marks the
   true fixed-viewport bottom edge. Per external-agent diagnosis: stop chasing
   height units (all report 699 on 390x844); identify the painted layer instead.
   Remove this file + ?flag handling + geo badges once the real fix ships. */
import {useCallback, useEffect, useRef, useState} from 'react';
import type {CSSProperties, RefObject} from 'react';

type Row = { k: string; v: string };
const TINT = { html: '#e8232d', body: '#ff9500', host: '#12b5a5', root: '#8f5bff' };
const SENTINEL_BG = '#ccff00';

function fmt(n: number | null | undefined) { return n == null ? '?' : String(Math.round(n)); }
function rectRow(el: Element | null): string {
  if (!el) return 'missing';
  const r = el.getBoundingClientRect();
  return `t:${fmt(r.top)} b:${fmt(r.bottom)} h:${fmt(r.height)} w:${fmt(r.width)}`;
}

export function SaViewportDebug({ hostRef }: { hostRef: RefObject<HTMLDivElement | null> }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const scheduled = useRef(false);

  /* Tint the four suspect layers unmistakably; make every intermediate ancestor
     between body and host transparent so only legend colours (or Safari chrome)
     can appear in the band. All inline styles restored on unmount. */
  useEffect(() => {
    const undo: Array<() => void> = [];
    const tint = (el: HTMLElement | null, color: string) => {
      if (!el) return;
      const prev = el.style.getPropertyValue('background');
      el.style.setProperty('background', color, 'important');
      undo.push(() => {
        el.style.removeProperty('background');
        if (prev) el.style.setProperty('background', prev);
      });
    };
    tint(document.documentElement, TINT.html);
    tint(document.body, TINT.body);
    const host = hostRef.current;
    if (host) {
      for (let node: HTMLElement | null = host.parentElement; node && node !== document.body; node = node.parentElement) tint(node, 'transparent');
      tint(host, TINT.host);
    }
    /* [data-sa-root] renders with V2ChatClient (same commit) - retry a moment in
       case of late mount, then stop. */
    let rootDone = false;
    const rootTimer = window.setInterval(() => {
      const root = document.querySelector<HTMLElement>('[data-sa-root]');
      if (root) { tint(root, TINT.root); rootDone = true; window.clearInterval(rootTimer); }
    }, 250);
    const safety = window.setTimeout(() => { if (!rootDone) window.clearInterval(rootTimer); }, 20000);
    return () => {
      window.clearInterval(rootTimer);
      window.clearTimeout(safety);
      undo.forEach((fn) => fn());
    };
  }, [hostRef]);

  const build = useCallback((): Row[] => {
    const w = window, d = document;
    const vv = w.visualViewport;
    const host = hostRef.current;
    const root = d.querySelector('[data-sa-root]');
    const dock = d.querySelector('[data-sa-dock]');
    const sent = d.getElementById('sa-vp-sentinel');
    let hit = 'null';
    try {
      const el = d.elementFromPoint(Math.round(w.innerWidth / 2), w.innerHeight - 1);
      if (el) {
        const he = el as HTMLElement;
        const tag = he.dataset?.saRoot ? 'root' : he.dataset?.saDock ? 'dock' : el.id === 'sa-vp-sentinel' ? 'sentinel' : he.tagName.toLowerCase();
        const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
        hit = (tag + cls).slice(0, 46);
      }
    } catch { hit = 'err'; }
    const mode = w.matchMedia?.('(display-mode: standalone)').matches ? 'standalone' : 'browser';
    return [
      { k: 'screen', v: `${w.screen.width}x${w.screen.height} avail:${fmt(w.screen.availHeight)}` },
      { k: 'outer/inner', v: `${fmt(w.outerHeight)} / ${fmt(w.innerHeight)}` },
      { k: 'docEl', v: `client:${fmt(d.documentElement.clientHeight)} scroll:${fmt(d.documentElement.scrollHeight)}` },
      { k: 'body', v: `client:${fmt(d.body.clientHeight)} scroll:${fmt(d.body.scrollHeight)}` },
      { k: 'vv', v: `${fmt(vv?.height)}@${fmt(vv?.offsetTop)} s:${vv?.scale?.toFixed(2) ?? '?'}` },
      { k: 'mode', v: mode },
      { k: 'host', v: rectRow(host) },
      { k: 'root', v: rectRow(root) },
      { k: 'dock', v: rectRow(dock) },
      { k: 'sentinel', v: rectRow(sent) },
      { k: 'hit@ih-1', v: hit },
    ];
  }, [hostRef]);

  const measure = useCallback(() => {
    if (scheduled.current) return;
    scheduled.current = true;
    requestAnimationFrame(() => { scheduled.current = false; setRows(build()); });
  }, [build]);

  useEffect(() => {
    measure();
    const w = window;
    const vv = w.visualViewport;
    w.addEventListener('resize', measure);
    w.addEventListener('orientationchange', measure);
    w.addEventListener('scroll', measure, true);
    vv?.addEventListener('resize', measure);
    vv?.addEventListener('scroll', measure);
    /* iOS toolbar/keyboard transitions do not always fire events; the interval
       keeps panel + screenshots current in every capture state. */
    const tick = w.setInterval(measure, 800);
    return () => {
      w.removeEventListener('resize', measure);
      w.removeEventListener('orientationchange', measure);
      w.removeEventListener('scroll', measure, true);
      vv?.removeEventListener('resize', measure);
      vv?.removeEventListener('scroll', measure);
      w.clearInterval(tick);
    };
  }, [measure]);

  const copy = useCallback(() => {
    const text = rows.map((r) => `${r.k}: ${r.v}`).join('\n');
    const done = () => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); };
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta); done();
      } catch { /* screenshots of the panel still carry the data */ }
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }, [rows]);

  return (
    <>
      <div id="sa-vp-sentinel" aria-hidden="true" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: 4, background: SENTINEL_BG, zIndex: 2147483646, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', top: 'max(6px, env(safe-area-inset-top))', left: 6, width: 'min(252px, 88vw)', maxHeight: '52vh', overflowY: 'auto', zIndex: 2147483647, background: 'rgba(12,13,17,.93)', color: '#f5f6f8', border: '1px solid #ffffff33', borderRadius: 12, padding: '7px 9px', font: '10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <strong style={{ letterSpacing: '.5px' }}>SA&nbsp;VP&nbsp;DEBUG</strong>
          <span style={{ opacity: 0.6, flex: 1 }} />
          <button type="button" onClick={measure} style={btn}>⟳</button>
          <button type="button" onClick={copy} style={btn}>{copied ? '✓' : '⧉'}</button>
          <button type="button" onClick={() => setOpen((o) => !o)} style={btn}>{open ? '−' : '+'}</button>
        </div>
        {open && (
          <>
            {rows.map((r) => (
              <div key={r.k} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><span style={{ opacity: 0.55 }}>{r.k}</span> {r.v}</div>
            ))}
            <div style={{ marginTop: 5, paddingTop: 4, borderTop: '1px solid #ffffff22', display: 'flex', flexWrap: 'wrap', gap: '2px 7px', fontSize: 9 }}>
              <Legend color={TINT.html} label="html" />
              <Legend color={TINT.body} label="body" />
              <Legend color={TINT.host} label="host" />
              <Legend color={TINT.root} label="root" />
              <Legend color={SENTINEL_BG} label="sentinel" />
            </div>
          </>
        )}
      </div>
    </>
  );
}

const btn: CSSProperties = { flex: '0 0 auto', minWidth: 20, height: 18, padding: '0 4px', fontSize: 10, lineHeight: 1, color: '#f5f6f8', background: '#2b2d34', border: '1px solid #55595f', borderRadius: 6, cursor: 'pointer' };

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}
