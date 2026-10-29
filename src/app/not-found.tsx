import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-brand">404</p>
        <h1 className="mt-2 text-3xl font-semibold">That page is not in the workspace</h1>
        <Link href="/dashboard" className="mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm text-primary-foreground">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
