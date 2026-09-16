import type { Metadata } from 'next'

import { QuizFlow } from '@/components/quiz/quiz-flow'
import { Badge } from '@/components/ui/badge'
import { listCourses } from '@/lib/db/queries'

export const metadata: Metadata = {
  title: 'Course fit',
  description:
    'Eight questions about how you like to work, matched against what each course actually demands day to day.',
}

export default async function QuizPage() {
  const { data: courses } = await listCourses()

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-9">
        <Badge tone="accent" className="mb-3">
          Optional &middot; about two minutes
        </Badge>
        <h1 className="text-[2rem] sm:text-[2.5rem]">Would you actually enjoy it?</h1>
        <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted">
          Meeting the requirements tells you whether you can get in. It says nothing about whether
          you&rsquo;ll still want to be there in year three. Eight questions about how you like to
          work, matched against what each course demands day to day.
        </p>
        <p className="mt-4 rounded-md bg-sunken px-4 py-3 text-[0.9375rem] text-muted">
          There are no right answers here and nothing you pick can stop you applying anywhere.
          Answer how you actually are, not how you think you should be.
        </p>
      </header>

      <QuizFlow courses={courses} />
    </div>
  )
}
