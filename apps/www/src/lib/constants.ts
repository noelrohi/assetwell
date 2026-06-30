export const GITHUB_REPO_URL = "https://github.com/noelrohi/assetwell"
export const RELEASES_URL = `${GITHUB_REPO_URL}/releases/latest`
export const LATEST_RELEASE_API_URL =
  "https://api.github.com/repos/noelrohi/assetwell/releases/latest"

/** The download page where visitors pick their platform. */
export const DOWNLOAD_URL = "/download"

/**
 * The server endpoint that resolves the latest release asset for an available
 * platform and redirects to it.
 */
export const DOWNLOAD_START_URL = "/api/download"
