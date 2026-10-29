import { Card, CardContent } from "@/components/ui/card";

export function ModuleFrame({
  eyebrow,
  title,
  description,
  stats,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  stats?: { label: string; value: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {stats && stats.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {children}
    </div>
  );
}
