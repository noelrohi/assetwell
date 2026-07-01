import * as React from "react"

import { cn } from "@/lib/utils"

const assetwellIconUrl = new URL("../../../../build/icon.svg", import.meta.url)
  .href

export function AssetwellAppIcon({
  className,
  alt = "Assetwell",
  draggable = false,
  ...props
}: Omit<React.ComponentProps<"img">, "src">) {
  return (
    <img
      src={assetwellIconUrl}
      alt={alt}
      draggable={draggable}
      className={cn("size-12 rounded-[22%]", className)}
      {...props}
    />
  )
}
