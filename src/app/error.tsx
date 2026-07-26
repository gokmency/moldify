"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">Moldify could not continue</h1>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Your model remains on this device. Reload the studio and try again.
        </p>
        <Button className="mt-5" onClick={reset}>
          Reload studio
        </Button>
      </div>
    </main>
  );
}
