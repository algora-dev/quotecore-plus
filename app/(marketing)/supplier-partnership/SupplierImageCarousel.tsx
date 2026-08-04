"use client";

import { useState } from "react";
import Image from "next/image";

const images = [
  {
    src: "/images/supplier-partnership/supplier-directory-1.png",
    alt: "QuoteCore+ supplier directory showing component libraries that contractors can browse and import",
    label: "Component Libraries",
  },
  {
    src: "/images/supplier-partnership/supplier-directory-2.png",
    alt: "QuoteCore+ supplier directory showing catalogues with search filtered to New Zealand suppliers",
    label: "Catalogues",
  },
];

export default function SupplierImageCarousel() {
  const [index, setIndex] = useState(0);
  const total = images.length;

  return (
    <div>
      <div className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)] transition hover:shadow-[0_12px_40px_rgba(255,107,53,0.12)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF6B35]" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          </div>
          <span className="text-[10px] font-medium text-slate-400">
            {images[index].label} ({index + 1}/{total})
          </span>
        </div>
        <div className="relative aspect-[16/10] w-full bg-slate-50">
          <Image
            src={images[index].src}
            alt={images[index].alt}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
      </div>

      {total > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`View image ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === index
                  ? "w-6 bg-[#FF6B35]"
                  : "w-2 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
