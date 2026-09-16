export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="skeleton h-10 w-2/3 max-w-md rounded-md" />
      <div className="skeleton mt-4 h-5 w-full max-w-xl rounded-md" />

      <ul className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="rounded-lg border border-border bg-surface p-6 shadow-card">
            <div className="skeleton size-10 rounded-md" />
            <div className="skeleton mt-5 h-4 w-16 rounded-sm" />
            <div className="skeleton mt-2.5 h-6 w-3/4 rounded-md" />
            <div className="skeleton mt-3 h-4 w-full rounded-sm" />
            <div className="skeleton mt-2 h-4 w-5/6 rounded-sm" />
            <div className="skeleton mt-6 h-4 w-full rounded-sm" />
          </li>
        ))}
      </ul>
    </div>
  )
}
