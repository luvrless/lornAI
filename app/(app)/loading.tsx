// Shown inside the console shell while a server-rendered page is loading.
export default function ConsoleLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-fadein" aria-busy="true" aria-label="Loading">
      <div className="mb-8 space-y-3">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-[92px] !rounded-[20px]" />
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="skeleton h-80 !rounded-[20px]" />
        <div className="skeleton h-80 !rounded-[20px]" />
      </div>
    </div>
  );
}
