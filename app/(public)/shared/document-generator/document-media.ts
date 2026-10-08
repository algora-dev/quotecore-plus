/** Raster-only, bounded uploads. A logo is processed locally; document scans
 * are sent only after the user presses Extract. No remote image URLs/SVG. */
const TYPES = ['image/png','image/jpeg','image/jpg','image/webp'];
export async function rasterize(file: File, purpose:'logo'|'scan'): Promise<string> {
  const maxMB = purpose === 'logo' ? 5 : 10;
  if (!TYPES.includes(file.type)) throw new Error('Choose a PNG, JPEG or WebP image.');
  if (file.size > maxMB * 1024 * 1024) throw new Error(`That file is too large. Maximum ${maxMB}MB.`);
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve,reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('This image could not be opened. Try a different file.')); img.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('This image has no readable content.');
    const max = purpose === 'logo' ? 300 : 2000;
    const scale = Math.min(1,max/image.naturalWidth,max/image.naturalHeight);
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(image.naturalWidth*scale)); canvas.height = Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Image processing is unavailable in this browser.');
    if (purpose === 'scan') {ctx.fillStyle = '#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    return canvas.toDataURL(purpose === 'logo' ? 'image/png' : 'image/jpeg',0.8);
  } finally {URL.revokeObjectURL(url);}
}
