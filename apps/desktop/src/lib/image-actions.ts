import { toast } from "sonner"

export interface ImageActionAsset {
  url: string
  name: string
}

export interface CopyImageOptions {
  fallbackToLink?: boolean
}

export async function copyImage(
  asset: ImageActionAsset,
  options: CopyImageOptions = {},
) {
  const fallbackToLink = options.fallbackToLink ?? true

  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    if (!fallbackToLink) {
      toast("Image copy is not supported", {
        description: "Download the image instead.",
      })
      return
    }

    try {
      await writeImageLink(asset)
      toast("Image copy is not supported", {
        description: "Copied the image link instead.",
      })
    } catch {
      toast("Could not copy image")
    }
    return
  }

  try {
    const sourceBlob = await fetchImageBlob(asset.url)
    const clipboardBlob =
      sourceBlob.type === "image/png"
        ? sourceBlob
        : await convertImageBlobToPng(sourceBlob)

    await navigator.clipboard.write([
      new ClipboardItem({ [clipboardBlob.type]: clipboardBlob }),
    ])
    toast("Image copied")
  } catch {
    toast("Could not copy image", {
      description: fallbackToLink
        ? "Try copying the image link instead."
        : "Try downloading the image instead.",
    })
  }
}

export async function downloadImage(asset: ImageActionAsset) {
  try {
    const blob = await fetchImageBlob(asset.url)
    triggerBlobDownload(blob, imageFileName(asset, blob.type))
    toast("Image download started")
  } catch {
    triggerUrlDownload(asset.url, imageFileName(asset))
    toast("Image opened for download", {
      description: "If it opens in the browser, save it from there.",
    })
  }
}

export async function copyImageLink(asset: ImageActionAsset) {
  try {
    await writeImageLink(asset)
    toast("Image link copied")
  } catch {
    toast("Could not copy image link")
  }
}

export async function writeImageLink(asset: ImageActionAsset) {
  await navigator.clipboard.writeText(asset.url)
}

export function openImage(asset: ImageActionAsset) {
  window.open(asset.url, "_blank", "noopener,noreferrer")
}

export async function fetchImageBlob(url: string) {
  try {
    return await fetchImageBlobViaFetch(url)
  } catch (error) {
    if (!canUseImageCanvasFallback()) throw error
    return imageBlobFromCanvas(url)
  }
}

async function fetchImageBlobViaFetch(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load image (${response.status})`)

  const blob = await response.blob()
  if (!blob.type.startsWith("image/")) {
    throw new Error("Downloaded asset is not an image")
  }

  return blob
}

export async function convertImageBlobToPng(blob: Blob) {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const context = canvas.getContext("2d")
  if (!context) throw new Error("Could not prepare image for clipboard")

  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  return canvasToBlob(canvas, "image/png")
}

async function imageBlobFromCanvas(url: string) {
  const image = await loadImageElement(url)
  const canvas = document.createElement("canvas")
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height

  const context = canvas.getContext("2d")
  if (!context) throw new Error("Could not prepare image")

  context.drawImage(image, 0, 0)
  return canvasToBlob(canvas, "image/png")
}

function loadImageElement(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = "async"
    if (/^https?:\/\//i.test(url)) image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Could not load image"))
    image.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Could not prepare image"))
      }, type)
    } catch (error) {
      reject(error)
    }
  })
}

function canUseImageCanvasFallback() {
  return typeof document !== "undefined" && typeof Image !== "undefined"
}

export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  triggerUrlDownload(url, fileName)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function triggerUrlDownload(url: string, fileName: string) {
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.rel = "noopener"
  document.body.append(link)
  link.click()
  link.remove()
}

export function imageFileName(asset: ImageActionAsset, contentType?: string) {
  const name = sanitizeDownloadName(asset.name) || "assetwell-image"
  if (/\.[a-z0-9]{2,5}$/i.test(name)) return name

  return `${name}${imageExtensionFromUrl(asset.url) ?? imageExtensionForType(contentType) ?? ".png"}`
}

export function sanitizeDownloadName(name: string) {
  return name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .replace(/^\.+$/, "")
}

export function imageExtensionFromUrl(url: string) {
  try {
    const extension = new URL(url).pathname.match(
      /\.(avif|gif|jpeg|jpg|png|webp)$/i,
    )?.[0]
    return extension?.toLowerCase() ?? null
  } catch {
    return null
  }
}

export function imageExtensionForType(contentType?: string) {
  switch (contentType) {
    case "image/avif":
      return ".avif"
    case "image/gif":
      return ".gif"
    case "image/jpeg":
      return ".jpg"
    case "image/png":
      return ".png"
    case "image/webp":
      return ".webp"
    default:
      return null
  }
}
