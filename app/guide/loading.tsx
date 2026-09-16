export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="skeleton h-10 w-2/3 max-w-md rounded-md" />
      <div className="skeleton mt-4 h-5 w-full max-w-xl rounded-md" />
      <ul className="mt-9 grid gap-5 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <li key={i} className="rounded-lg border border-border bg-surface p-6 shadow-card">
            <div className="skeleton h-6 w-2/3 rounded-md" />
            <div className="skeleton mt-3 h-4 w-full rounded-sm" />
            <div className="skeleton mt-2 h-4 w-4/5 rounded-sm" />
            <div className="skeleton mt-6 h-4 w-1/2 rounded-sm" />
          </li>
        ))}
      </ul>
    </div>
  )
}
