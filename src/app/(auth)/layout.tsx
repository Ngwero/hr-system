export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-[#f3f4f6] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative m-4 hidden overflow-hidden rounded-3xl bg-white px-12 py-12 text-slate-900 shadow-sm lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-10 bottom-0 h-56 w-56 rounded-full bg-[#efeaff]" />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand">Enterprise HRMS</p>
          <h1 className="mt-8 max-w-md text-4xl font-semibold leading-tight tracking-tight">
            One record for every person, from the first application to the last day.
          </h1>
        </div>
        <p className="relative max-w-sm text-sm leading-6 text-slate-500">
          Organisation, access, and audit are enforced in the database. The screen only shows what your role is allowed to see.
        </p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">{children}</section>
    </main>
  );
}
