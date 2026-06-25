import type { ReactNode } from "react"

export function ComposerHeading({ children }: { children: ReactNode }) {
  return (
    <div className="mb-10 text-center">
      <h1 className="text-[26px] leading-snug font-normal tracking-[-0.01em] text-balance md:text-[28px]">
        {children}
      </h1>
    </div>
  )
}
