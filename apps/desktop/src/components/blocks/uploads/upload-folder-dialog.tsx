import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { UploadFolder } from "@/lib/higgsfield/types"

export type FolderEditorState =
  | { mode: "create"; afterCreate?: (folderId: string) => Promise<void> | void }
  | { mode: "edit"; folder: UploadFolder }

export function UploadFolderFormDialog({
  state,
  onOpenChange,
  onSubmit,
}: {
  state: FolderEditorState | null
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => Promise<boolean>
}) {
  const [name, setName] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const open = Boolean(state)
  const isEditing = state?.mode === "edit"

  React.useEffect(() => {
    if (!state) return
    setName(state.mode === "edit" ? state.folder.name : "")
    setError(null)
    setSaving(false)
  }, [state])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim().replace(/\s+/g, " ")

    if (!trimmed) {
      setError("Name is required.")
      return
    }

    setSaving(true)
    const saved = await onSubmit(trimmed)
    setSaving(false)

    if (saved) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Rename folder" : "New folder"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Change the folder label shown on the Uploads page. Higgsfield uploads stay where they are."
                : "Create a local folder for grouping Uploads without changing Higgsfield storage."}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-5">
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="upload-folder-name">Folder name</FieldLabel>
              <Input
                id="upload-folder-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setError(null)
                }}
                disabled={saving}
                autoFocus
                placeholder="e.g. Spring launch"
              />
              <FieldDescription>
                Folders are local Assetwell metadata layered over the shared
                Uploads library.
              </FieldDescription>
              <FieldError>{error}</FieldError>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving…"
                : isEditing
                  ? "Rename folder"
                  : "Create folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
