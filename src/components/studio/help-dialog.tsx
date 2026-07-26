"use client";

import { CircleHelp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const shortcuts = [
  ["F", "Fit model"],
  ["R", "Reset view"],
  ["1", "Isometric view"],
  ["2", "Top view"],
] as const;

export function HelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-10" aria-label="Help">
          <CircleHelp className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Using Moldify</DialogTitle>
          <DialogDescription>
            Prepare a printable two-part mold directly in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-xs leading-5">
          <section>
            <h2 className="font-semibold">Files and units</h2>
            <p className="mt-1 text-muted-foreground">
              STL, OBJ, GLB and 3MF files up to 50 MB are supported. Dimensions
              are interpreted as millimeters.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">Privacy</h2>
            <p className="mt-1 text-muted-foreground">
              Model files and mold settings are processed in this browser and
              are not uploaded. Anonymous page and performance measurements do
              not include file names, geometry or mold parameters.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">Keyboard</h2>
            <dl className="mt-2 grid grid-cols-[2rem_1fr] gap-x-3 gap-y-1.5 text-muted-foreground">
              {shortcuts.map(([key, label]) => (
                <div key={key} className="contents">
                  <dt className="font-mono text-foreground">{key}</dt>
                  <dd>{label}</dd>
                </div>
              ))}
            </dl>
          </section>

          <Separator />

          <section>
            <h2 className="font-semibold">Geometry limits</h2>
            <p className="mt-1 text-muted-foreground">
              Open, self-intersecting or highly complex meshes may not produce
              a valid solid. Always verify dimensions, fit and manufacturability
              before fabrication.
            </p>
          </section>

          <Button asChild variant="outline" className="w-full">
            <a
              href="https://github.com/gokmency/moldify"
              target="_blank"
              rel="noreferrer"
            >
              View source and report issues
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
