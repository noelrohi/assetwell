import * as React from "react"
import type { AssetwellUploadWorkspace } from "@assetwell/desktop-bridge"
import {
  IconCheck,
  IconChevronDown,
  IconFolders,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react"

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useHiggsfieldApp } from "@/lib/higgsfield"
import { cn } from "@/lib/utils"

type WorkspaceEditorState =
  | { mode: "create"; workspace?: never }
  | { mode: "edit"; workspace: AssetwellUploadWorkspace }

export function WorkspaceSwitcher() {
  const { isMobile } = useSidebar()
  const { uploads } = useHiggsfieldApp()
  const [editor, setEditor] = React.useState<WorkspaceEditorState | null>(null)
  const [deleteCandidate, setDeleteCandidate] =
    React.useState<AssetwellUploadWorkspace | null>(null)
  const activeWorkspace = uploads.activeWorkspace
  const activeWorkspaceName = activeWorkspace.name
  const canManageActiveWorkspace = !activeWorkspace.isDefault

  async function submitWorkspaceName(name: string) {
    if (!editor) return false

    if (editor.mode === "create") {
      return uploads.createWorkspace(name)
    }

    return uploads.updateWorkspace(editor.workspace.id, name)
  }

  async function deleteWorkspace() {
    if (!deleteCandidate) return false
    return uploads.deleteWorkspace(deleteCandidate.id)
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                tooltip={activeWorkspaceName}
                className="no-drag h-12 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border/70 bg-card/60 text-muted-foreground">
                  <IconFolders className="size-4" />
                </span>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Workspace
                  </span>
                  <span className="truncate text-sm font-medium">
                    {activeWorkspaceName}
                  </span>
                </div>
                <IconChevronDown className="size-4 text-muted-foreground" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="start"
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Uploads workspace
              </DropdownMenuLabel>
              {uploads.workspaces.map((workspace) => {
                const isActive = workspace.id === uploads.activeWorkspace.id
                return (
                  <DropdownMenuItem
                    key={workspace.id}
                    onClick={() => {
                      if (!isActive) void uploads.switchWorkspace(workspace.id)
                    }}
                    aria-current={isActive ? "true" : undefined}
                    className="gap-2"
                  >
                    <IconCheck
                      className={cn("size-4", !isActive && "opacity-0")}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {workspace.name}
                    </span>
                    {workspace.isDefault ? (
                      <span className="rounded-full border border-border/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Default
                      </span>
                    ) : null}
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setEditor({ mode: "create" })}
                className="gap-2"
              >
                <IconPlus />
                New workspace…
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canManageActiveWorkspace}
                onClick={() => {
                  if (canManageActiveWorkspace) {
                    setEditor({ mode: "edit", workspace: activeWorkspace })
                  }
                }}
                className="gap-2"
              >
                <IconPencil />
                Rename current…
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={!canManageActiveWorkspace}
                onClick={() => {
                  if (canManageActiveWorkspace) {
                    setDeleteCandidate(activeWorkspace)
                  }
                }}
                className="gap-2"
              >
                <IconTrash />
                Delete current…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <WorkspaceFormDialog
        state={editor}
        onOpenChange={(open) => {
          if (!open) setEditor(null)
        }}
        onSubmit={submitWorkspaceName}
      />
      <DeleteWorkspaceDialog
        workspace={deleteCandidate}
        onOpenChange={(open) => {
          if (!open) setDeleteCandidate(null)
        }}
        onConfirm={deleteWorkspace}
      />
    </>
  )
}

function WorkspaceFormDialog({
  state,
  onOpenChange,
  onSubmit,
}: {
  state: WorkspaceEditorState | null
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => Promise<boolean>
}) {
  const [name, setName] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const open = Boolean(state)
  const mode = state?.mode ?? "create"
  const isEditing = mode === "edit"

  React.useEffect(() => {
    if (!state) return
    setName(state.mode === "edit" ? state.workspace.name : "")
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

    if (saved) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Rename workspace" : "New Uploads workspace"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Change the label shown in Assetwell. Files stay in the same local Uploads folder."
                : "Create a separate local folder for a brand, campaign, or client."}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-5">
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
              <Input
                id="workspace-name"
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
                Keep uploads separated without exposing Higgsfield workspace
                details.
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
                  ? "Rename workspace"
                  : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteWorkspaceDialog({
  workspace,
  onOpenChange,
  onConfirm,
}: {
  workspace: AssetwellUploadWorkspace | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<boolean>
}) {
  const [deleting, setDeleting] = React.useState(false)
  const open = Boolean(workspace)

  React.useEffect(() => {
    if (open) setDeleting(false)
  }, [open])

  async function handleDelete() {
    setDeleting(true)
    const deleted = await onConfirm()
    setDeleting(false)

    if (deleted) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete workspace?</DialogTitle>
          <DialogDescription>
            This removes “{workspace?.name ?? "this workspace"}” and deletes the
            files in its local Uploads folder. Generated creatives stay in your
            library.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={deleting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={() => void handleDelete()}
          >
            {deleting ? "Deleting…" : "Delete workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
