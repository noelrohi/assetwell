export const IPC_CHANNELS = {
  app: {
    getInfo: "kreeyts:app:get-info",
  },
  higgsfield: {
    getStatus: "kreeyts:higgsfield:get-status",
    signIn: "kreeyts:higgsfield:sign-in",
    checkCredits: "kreeyts:higgsfield:check-credits",
    checkWorkspace: "kreeyts:higgsfield:check-workspace",
    listModels: "kreeyts:higgsfield:list-models",
    chooseAsset: "kreeyts:higgsfield:choose-asset",
    uploadAsset: "kreeyts:higgsfield:upload-asset",
    generate: "kreeyts:higgsfield:generate",
    openOutput: "kreeyts:higgsfield:open-output",
    cancelCommand: "kreeyts:higgsfield:cancel-command",
    commandOutput: "kreeyts:higgsfield:command-output",
  },
} as const
