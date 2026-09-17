"use client";

import { useState } from "react";

export type FeedbackEntry = {
  id: string;
  email: string | null;
  wantsResponse: boolean;
  anythingStopping: string | null;
  stoppingReason: string | null;
  stoppingReasonOther: string | null;
  likedFeatures: string[];
  dislikedFeatures: string[];
  featureComment: string | null;
  improvementWish: string | null;
  createdAt: string;
};

const FEATURE_LABELS: Record<string, string> = {
  smart_components: "Smart Components",
  digital_measure: "Digital measuring & takeoff tool",
  ai_scan_assist: "AI Scan Assist",
  auto_follow_ups: "Automatic follow-ups",
  catalog_converter: "Catalog (spreadsheet) to components converter",
  supplier_tools: "Supplier pricing tools & enquiries",
  orders_hub: "Orders hub & job tracking",
  pdf_quotes: "Instant branded PDF quotes",
  team_workspace: "Team workspace & roles",
};

const REASON_LABELS: Record<string, string> = {
  too_hard: "Too hard to understand",
  too_complex: "Too complex to set up",
  missing_features: "Doesn't have the features I want",
  not_what_i_need: "Not what I need",
  other: "Something else",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function featureList(keys: string[]) {
  if (keys.length === 0) return "None selected";
  return keys.map((k) => FEATURE_LABELS[k] ?? k).join(", ");
}

function AnswerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2 border-b border-slate-100 last:border-b-0">
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{value}</div>
    </div>
  );
}

export function FeedbackList({ entries }: { entries: FeedbackEntry[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "response">("all");

  const filtered =
    filter === "response" ? entries.filter((e) => e.wantsResponse) : entries;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
            filter === "all"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
          }`}
          onClick={() => setFilter("all")}
        >
          All <span className="ml-1 opacity-70">{entries.length}</span>
        </button>
        <button
          className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
            filter === "response"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
          }`}
          onClick={() => setFilter("response")}
        >
          Wants response <span className="ml-1 opacity-70">{entries.filter((e) => e.wantsResponse).length}</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">No submissions yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => {
            const open = openId === e.id;
            return (
              <div
                key={e.id}
                className="rounded-xl border bg-white border-slate-200 overflow-hidden"
              >
                <button
                  onClick={() => setOpenId(open ? null : e.id)}
                  className="w-full text-left px-4 py-3 cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-medium text-slate-900 truncate">
                        {e.email ?? "Anonymous"}
                      </span>
                      {e.wantsResponse && (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          Wants response
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">{formatDate(e.createdAt)}</span>
                  </div>
                </button>
                {open && (
                  <div className="px-4 pb-4 space-y-1">
                    <AnswerRow
                      label="Anything stopping you?"
                      value={
                        e.anythingStopping === "yes"
                          ? `Yes - ${REASON_LABELS[e.stoppingReason ?? "other"] ?? "Unknown"}${
                              e.stoppingReasonOther ? `: ${e.stoppingReasonOther}` : ""
                            }`
                          : e.anythingStopping === "no"
                            ? "No, all good"
                            : "Skipped"
                      }
                    />
                    <AnswerRow label="Features liked" value={featureList(e.likedFeatures)} />
                    <AnswerRow
                      label="Features not used / disliked"
                      value={featureList(e.dislikedFeatures)}
                    />
                    {e.featureComment && (
                      <AnswerRow label="Feature comment" value={e.featureComment} />
                    )}
                    {e.improvementWish && (
                      <AnswerRow label="Wish / improvement idea" value={e.improvementWish} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
