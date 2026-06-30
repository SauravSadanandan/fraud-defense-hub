import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <ShieldAlert className="size-5" />
      </span>
      {showText && (
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">PAF Fraud Analysis</div>
          <div className="text-[11px] text-muted-foreground">AppsFlyer Anti-Fraud Console</div>
        </div>
      )}
    </div>
  );
}