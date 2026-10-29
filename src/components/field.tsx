import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function Field({
  label,
  name,
  hint,
  className,
  ...props
}: React.ComponentProps<"input"> & { label: string; name: string; hint?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)} htmlFor={name}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </label>
  );
}

export function TextField({
  label,
  name,
  ...props
}: React.ComponentProps<"textarea"> & { label: string; name: string }) {
  return (
    <label className="block space-y-1.5" htmlFor={name}>
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} {...props} />
    </label>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5" htmlFor={name}>
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="flex h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-ring/30"
      >
        {children}
      </select>
    </label>
  );
}
