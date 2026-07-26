import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Moldify is available from the main studio.
        </p>
        <Button asChild className="mt-5">
          <Link href="/">Open Moldify</Link>
        </Button>
      </div>
    </main>
  );
}
