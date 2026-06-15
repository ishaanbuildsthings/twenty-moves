"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSettings } from "@/lib/context/settings";

interface TimerSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description?: string;
}

export function TimerSettingsDialog({
  open,
  onOpenChange,
  description = "Configure your timer settings.",
}: TimerSettingsDialogProps) {
  const { timerSettings, updateTimerSettings, accent } = useSettings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Timer Settings</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Hold delay */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Hold delay</p>
              <p className="text-xs text-muted-foreground">How long to hold spacebar before ready</p>
            </div>
            <select
              className="bg-muted rounded-md px-2 py-1 text-sm focus:outline-none"
              value={timerSettings.holdDelayMs}
              onChange={(e) => updateTimerSettings({ holdDelayMs: Number(e.target.value) })}
            >
              <option value={0}>None</option>
              <option value={300}>0.3s</option>
              <option value={550}>0.55s</option>
              <option value={1000}>1s</option>
            </select>
          </div>

          {/* Show timer while running */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Show timer</p>
              <p className="text-xs text-muted-foreground">Display running time while solving</p>
            </div>
            <button
              className={`w-10 h-6 rounded-full transition-colors ${
                timerSettings.showTimerWhileRunning ? accent.toggle : "bg-muted"
              }`}
              onClick={() => updateTimerSettings({ showTimerWhileRunning: !timerSettings.showTimerWhileRunning })}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${
                timerSettings.showTimerWhileRunning ? "translate-x-4" : ""
              }`} />
            </button>
          </div>

          {/* Use inspection */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Inspection</p>
              <p className="text-xs text-muted-foreground">WCA-style 15s countdown before timing</p>
            </div>
            <button
              className={`w-10 h-6 rounded-full transition-colors ${
                timerSettings.useInspection ? accent.toggle : "bg-muted"
              }`}
              onClick={() => updateTimerSettings({ useInspection: !timerSettings.useInspection })}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${
                timerSettings.useInspection ? "translate-x-4" : ""
              }`} />
            </button>
          </div>

          {/* Cube preview */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Cube preview</p>
              <p className="text-xs text-muted-foreground">Show a 2D view of the scrambled cube</p>
            </div>
            <button
              className={`w-10 h-6 rounded-full transition-colors ${
                timerSettings.showCubePreview ? accent.toggle : "bg-muted"
              }`}
              onClick={() => updateTimerSettings({ showCubePreview: !timerSettings.showCubePreview })}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${
                timerSettings.showCubePreview ? "translate-x-4" : ""
              }`} />
            </button>
          </div>

          {/* Scramble size */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Scramble size</p>
              <p className="text-xs text-muted-foreground">Font size for scramble text</p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
              {(["small", "medium", "large"] as const).map((size) => (
                <button
                  key={size}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors capitalize ${
                    timerSettings.scrambleSize === size
                      ? `${accent.bg} text-white`
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => updateTimerSettings({ scrambleSize: size })}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
