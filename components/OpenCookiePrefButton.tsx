"use client";

export default function OpenCookiePrefButton() {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("openCookiePreferences"))
      }
      className="underline underline-offset-2 hover:text-zinc-950"
    >
      cookie settings
    </button>
  );
}
