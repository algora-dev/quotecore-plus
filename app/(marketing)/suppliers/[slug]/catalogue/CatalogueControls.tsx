"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface CatalogueSearchBarProps {
  supplierSlug: string;
  initialQuery: string;
  versionedPath?: string;
}

export function CatalogueSearchBar({ supplierSlug, initialQuery, versionedPath }: CatalogueSearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  const basePath = versionedPath ?? `/suppliers/${supplierSlug}/catalogue`;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (query) {
      params.set("q", query);
    } else {
      params.delete("q");
    }
    params.delete("page");
    router.push(`${basePath}?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSearch} className="flex gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products..."
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
        aria-label="Search catalogue"
      />
      <button
        type="submit"
        className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Search
      </button>
      {initialQuery && (
        <a
          href={basePath}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Clear
        </a>
      )}
    </form>
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  supplierSlug?: string;
  basePath?: string;
  search?: string;
  sort?: string;
  dir?: string;
}

export function CataloguePagination({
  currentPage,
  totalPages,
  supplierSlug,
  basePath,
  search,
  sort,
  dir,
}: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const base = basePath ?? `/suppliers/${supplierSlug}/catalogue`;

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set("q", search);
    if (sort) params.set("sort", sort);
    if (dir) params.set("dir", dir);
    if (page > 1) {
      params.set("page", String(page));
    } else {
      params.delete("page");
    }
    router.push(`${base}?${params.toString()}`);
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
      <p className="text-sm text-slate-500">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
