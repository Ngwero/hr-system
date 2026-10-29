import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-50 text-success",
  warning: "bg-amber-50 text-warning",
  danger: "bg-red-50 text-destructive",
  brand: "bg-accent text-brand",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.ComponentProps<"span"> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}
