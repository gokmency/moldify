"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="grid min-h-dvh place-items-center bg-[#f4efe6] p-6 text-[#2e2924]">
          <div className="max-w-sm text-center">
            <h1 className="text-lg font-semibold">Moldify could not start</h1>
            <p className="mt-2 text-xs leading-5 text-[#6f655c]">
              Reload the application to start a new local session.
            </p>
            <Button className="mt-5" onClick={reset}>
              Reload
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
