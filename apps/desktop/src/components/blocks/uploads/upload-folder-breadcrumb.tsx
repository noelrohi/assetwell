import { IconFolder } from "@tabler/icons-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import type { UploadFolder } from "@/lib/higgsfield/types"

import { formatFolderCount } from "./upload-folder-tile"

export function UploadFolderBreadcrumb({
  folder,
  count,
  onBack,
}: {
  folder: UploadFolder
  count: number
  onBack: () => void
}) {
  return (
    <Breadcrumb className="mt-6 animate-in fade-in slide-in-from-top-1 duration-200">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <button type="button" onClick={onBack}>
              Uploads
            </button>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="inline-flex items-center gap-1.5">
            <IconFolder
              className="size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            {folder.name}
            <span className="font-normal text-muted-foreground">
              · {formatFolderCount(count)}
            </span>
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
