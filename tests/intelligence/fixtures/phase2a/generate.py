"""Offline synthetic PDF parser/render experiment ONLY; not a production parser.
Requires local ReportLab and PyMuPDF. Never use this script for customer PDFs.
Run from repo root: python tests/intelligence/fixtures/phase2a/generate.py
No dependency or application configuration changes are needed for TS fixture tests.
"""
from pathlib import Path
import hashlib, json
import fitz
from reportlab.pdfgen import canvas

root = Path(__file__).resolve().parent
pdf = root / 'roof-notes-30.pdf'
c = canvas.Canvas(str(pdf), pagesize=(612,792), invariant=1)
for i in range(30):
    c.setFont('Helvetica', 12)
    c.drawString(72,720,f'Synthetic roofing specification - page {i+1}')
    c.drawString(72,690,'Provide standing seam metal roofing.')
    c.drawString(72,660,f'Roof note reference R-{i+1:02d}.')
    c.showPage()
c.save()
b = pdf.read_bytes()
assert len(b) <= 50*1024*1024
pages = []
with fitz.open(pdf) as doc:
    assert len(doc)==30 and not doc.is_encrypted
    for i,p in enumerate(doc):
        assert p.rotation==0 and not p.get_images() and not p.get_drawings()
        regions=[]
        for block in p.get_text('blocks',sort=True):
            x0,y0,x1,y1,s,*_ = block
            regions.append({'text':s.strip(), 'box':[x0/p.rect.width,y0/p.rect.height,x1/p.rect.width,y1/p.rect.height]})
        assert len(regions)==3 and 'standing seam' in regions[1]['text']
        assert all(0<=r['box'][0]<r['box'][2]<=1 and 0<=r['box'][1]<r['box'][3]<=1 for r in regions)
        pix=p.get_pixmap(matrix=fitz.Matrix(0.5,0.5),alpha=False)
        assert pix.width*pix.height<=200000 and min(pix.samples)<200
        pages.append({'index':i,'regions':regions,'renderPixels':[pix.width,pix.height]})
# Separate synthetic rotated/drawing page: prove raster output; do not claim vision or coordinate parity.
with fitz.open() as d:
    p=d.new_page(width=612,height=792)
    p.draw_rect(fitz.Rect(70,70,280,300));p.insert_text((80,90),'Roof outline');p.set_rotation(90)
    pix=p.get_pixmap(matrix=fitz.Matrix(0.5,0.5),alpha=False)
    assert p.get_drawings() and pix.width==396 and pix.height==306
    visual={'rotation':p.rotation,'renderPixels':[pix.width,pix.height],'requiresVisualAnalysis':True}
(root/'extracted.json').write_text(json.dumps({'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'pages':pages,'visualExperiment':visual},indent=2)+'\n')
print(f'30 PDF pages extracted and rasterized; {len(b)} bytes; rotated drawing raster {visual["renderPixels"]}; no OCR/vision. PyMuPDF {fitz.VersionBind}.')
