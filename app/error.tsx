"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Icon, ICONS } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5 py-16">
      <div className="panel w-full max-w-md animate-rise p-8 text-center shadow-lift">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-300 ring-1 ring-red-500/25">
          <Icon d={ICONS.alert} className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">An unexpected error occurred while loading this page.</p>
        {error.digest && <p className="mono mt-3 text-xs text-faint">Reference: {error.digest}</p>}
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <button onClick={reset} className="btn-primary">Try again</button>
          <Link href="/" className="btn">Back home</Link>
        </div>
      </div>
    </div>
  );
}
