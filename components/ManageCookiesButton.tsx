"use client";

export default function ManageCookiesButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("openCookiePreferences"))}
      className="inline-flex items-center gap-2 rounded-full bg-[#BD4A1A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#A03E15]"
    >
      Manage Cookie Preferences
    </button>
  );
}
