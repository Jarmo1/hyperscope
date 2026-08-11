"use client";

import { useState } from "react";

/**
 * The growth loop. Every share carries the wallet URL, and the URL renders a
 * card, so a screenshot and a link both point back here.
 */
export function ShareBar({ path, headline }: { path: string; headline: string }) {
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? window.location.origin + path : path;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const tweet = `https://x.com/intent/post?${new URLSearchParams({
    text: headline,
    url,
  })}`;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={copy}
        className="eyebrow border border-rule-strong px-2.5 py-1.5 hover:bg-shade transition-colors"
      >
        {copied ? "Link copied" : "Copy link"}
      </button>
      <a
        href={tweet}
        target="_blank"
        rel="noreferrer"
        className="eyebrow border border-ink bg-ink text-paper px-2.5 py-1.5 hover:bg-amber hover:border-amber transition-colors"
      >
        Post on X
      </a>
    </div>
  );
}
