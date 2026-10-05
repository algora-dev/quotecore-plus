from pathlib import Path
ROOT=Path(__file__).parent/'browser'
def mount(page, search='view=editor'):
    page.set_content('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>')
    page.add_style_tag(content=(ROOT/'tailwind.css').read_text())
    page.add_style_tag(content=(ROOT/'source.css').read_text())
    page.add_style_tag(content=(ROOT/'index.html').read_text().split('<style>')[1].split('</style>')[0])
    page.evaluate('''search=>{window.fixtureSearch=search;window.process={env:{NEXT_PUBLIC_GENERIC_TRADES_V1:search.includes('generic=false')?'false':'true',NODE_ENV:'production'}};const store=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}})}''', search)
    page.add_script_tag(content=(ROOT/'bundle.js').read_text())
    page.add_script_tag(content=(ROOT/'entry.js').read_text())
    page.wait_for_timeout(120)
