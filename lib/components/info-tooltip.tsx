"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

export function InfoTooltip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors">
          <Info className="w-3.5 h-3.5" />
        </TooltipTrigger>
        <TooltipContent className="bg-muted text-white *:last:bg-muted *:last:fill-muted">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
