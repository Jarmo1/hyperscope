"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isAddress } from "@/lib/hyperliquid";

export function AddressSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const address = value.trim();
    if (!isAddress(address)) {
      setError("That isn't a wallet address. Paste one starting 0x, 42 characters.");
      return;
    }
    setError(null);
    router.push(`/w/${address}`);
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex flex-col sm:flex-row gap-px bg-rule border border-ink">
        <label htmlFor="address" className="sr-only">
          Hyperliquid wallet address
        </label>
        <input
          id="address"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="0x…"
          spellCheck={false}
          autoComplete="off"
          className="tnum flex-1 bg-paper px-4 py-3 text-sm outline-none placeholder:text-mist"
        />
        <button
          type="submit"
          className="eyebrow bg-ink text-paper px-6 py-3 hover:bg-amber transition-colors"
        >
          Read wallet
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[12px] text-oxblood mt-2">
          {error}
        </p>
      )}
    </form>
  );
}
