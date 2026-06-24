import {
  imagePlacements,
  type ImagePlacement,
  type VideoPlacement,
} from "./placements"

/** Local mock layer. Replaced by the Higgsfield bridge once the UI is settled. */

export type JobStatus = "pending" | "ready" | "failed"

export interface Take {
  id: string
  url: string
  status: JobStatus
}

export interface PlacementResult {
  size: ImagePlacement
  status: JobStatus
  url?: string
}

export interface VideoResult {
  id: string
  size: VideoPlacement
  status: JobStatus
  posterUrl: string
  prompt: string
  sourceCreativeId?: string
  sourceTitle?: string
  createdAt: string
}

export interface Creative {
  id: string
  title: string
  prompt: string
  ratioId: string
  ratioW: number
  ratioH: number
  model: string
  createdAt: string
  heroUrl: string
  status: JobStatus
  takes: Take[]
  selectedTakeId: string
  placements: PlacementResult[]
  isDemo?: boolean
}

export const imageModels = [
  { id: "soul-v2", label: "Soul v2", hint: "Signature look · best all-round" },
  { id: "soul-turbo", label: "Soul Turbo", hint: "Faster, lighter credits" },
  { id: "cinema-v1", label: "Cinema v1", hint: "Filmic, high contrast" },
  { id: "product-v2", label: "Product v2", hint: "Clean studio product shots" },
]

export const videoModels = [
  { id: "motion-v2", label: "Motion v2", hint: "Smooth image-to-video" },
  { id: "motion-cine", label: "Motion Cine", hint: "Cinematic camera moves" },
]

export const imagePromptLibrary = [
  {
    id: "p1",
    title: "Studio product, soft light",
    body: "A premium product hero shot on a seamless backdrop, soft diffused studio lighting, subtle reflection, shallow depth of field, editorial commercial photography",
  },
  {
    id: "p2",
    title: "Neon night street",
    body: "Cinematic night scene, wet asphalt reflecting neon signage, moody teal and magenta lighting, anamorphic flare, shot on 35mm",
  },
  {
    id: "p3",
    title: "Sun-drenched lifestyle",
    body: "Lifestyle scene bathed in golden-hour sunlight, warm haze, candid framing, natural skin tones, film grain",
  },
  {
    id: "p4",
    title: "Minimal pastel set",
    body: "Minimalist set design, soft pastel color blocking, geometric props, even lighting, clean negative space for copy",
  },
  {
    id: "p5",
    title: "Bold gradient backdrop",
    body: "Subject centered against a vivid bold gradient backdrop, rim lighting, crisp edges, high-energy advertising composition",
  },
]

export const videoPromptLibrary = [
  {
    id: "v1",
    title: "Slow push-in",
    body: "Slow cinematic push-in toward the subject, gentle parallax, subtle atmospheric particles drifting",
  },
  {
    id: "v2",
    title: "Orbit reveal",
    body: "Smooth orbital camera move around the product, soft rotating highlights, premium reveal",
  },
  {
    id: "v3",
    title: "Drift & shimmer",
    body: "Soft handheld drift, light shimmer across reflective surfaces, living-still energy",
  },
]

export interface ReferenceAsset {
  id: string
  name: string
  url: string
  isDemo?: boolean
}

export const referenceLibrary: ReferenceAsset[] = [
  { id: "r1", name: "Brand logo", url: img("ref-logo", 240, 240), isDemo: true },
  { id: "r2", name: "Hero product", url: img("ref-prod", 240, 240), isDemo: true },
  { id: "r3", name: "Mood board", url: img("ref-mood", 240, 240) },
]

function img(seed: string, w: number, h: number) {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`
}

function fullPlacements(seed: string, status: JobStatus): PlacementResult[] {
  return imagePlacements.map((size) => {
    const [w, h] = size.split("x").map(Number)
    return {
      size,
      status,
      url: status === "ready" ? img(`${seed}-${size}`, w, h) : undefined,
    }
  })
}

function takes(seed: string, w: number, h: number): Take[] {
  return [0, 1, 2, 3].map((i) => ({
    id: `${seed}-take-${i}`,
    url: img(`${seed}-take-${i}`, w, h),
    status: "ready" as JobStatus,
  }))
}

export const demoCreative: Creative = {
  id: "demo",
  title: "Neon sneaker — launch hero",
  prompt:
    "A futuristic neon sneaker floating above wet asphalt, electric magenta and cyan rim light, billows of vapor, premium product advertising, dramatic studio backdrop",
  ratioId: "1:1",
  ratioW: 1024,
  ratioH: 1024,
  model: "soul-v2",
  createdAt: "2026-06-22T10:00:00Z",
  heroUrl: img("demo-take-1", 1024, 1024),
  status: "ready",
  takes: takes("demo", 1024, 1024),
  selectedTakeId: "demo-take-1",
  placements: fullPlacements("demo", "ready"),
  isDemo: true,
}

export const creatives: Creative[] = [
  demoCreative,
  {
    id: "c1",
    title: "Citrus spritz — summer set",
    prompt:
      "A chilled citrus spritz on a sun-bleached terrazzo counter, droplets of condensation, bright midday light, vivid orange and aqua, lifestyle beverage advertising",
    ratioId: "4:5",
    ratioW: 864,
    ratioH: 1080,
    model: "cinema-v1",
    createdAt: "2026-06-23T14:12:00Z",
    heroUrl: img("c1-take-2", 864, 1080),
    status: "ready",
    takes: takes("c1", 864, 1080),
    selectedTakeId: "c1-take-2",
    placements: fullPlacements("c1", "ready"),
  },
  {
    id: "c2",
    title: "Analog headphones",
    prompt:
      "Matte black over-ear headphones on a graphite pedestal, single warm key light, deep shadows, minimal luxury product photography",
    ratioId: "1:1",
    ratioW: 1024,
    ratioH: 1024,
    model: "product-v2",
    createdAt: "2026-06-23T16:40:00Z",
    heroUrl: img("c2-take-0", 1024, 1024),
    status: "ready",
    takes: takes("c2", 1024, 1024),
    selectedTakeId: "c2-take-0",
    placements: [
      ...fullPlacements("c2", "ready").slice(0, 5),
      { size: "480x400", status: "ready", url: img("c2-480x400", 480, 400) },
      { size: "728x90", status: "failed" },
      { size: "320x50", status: "pending" },
    ],
  },
  {
    id: "c3",
    title: "Mountain trail capsule",
    prompt:
      "A weatherproof trail jacket on a misty alpine ridge at dawn, cold blue light breaking to warm sunrise, cinematic outdoor apparel campaign",
    ratioId: "16:9",
    ratioW: 1280,
    ratioH: 720,
    model: "soul-v2",
    createdAt: "2026-06-24T08:05:00Z",
    heroUrl: img("c3-take-3", 1280, 720),
    status: "pending",
    takes: [
      { id: "c3-take-0", url: img("c3-take-0", 1280, 720), status: "ready" },
      { id: "c3-take-1", url: img("c3-take-1", 1280, 720), status: "ready" },
      { id: "c3-take-2", url: "", status: "pending" },
      { id: "c3-take-3", url: img("c3-take-3", 1280, 720), status: "ready" },
    ],
    selectedTakeId: "c3-take-3",
    placements: [],
  },
]

export const videos: VideoResult[] = [
  {
    id: "vid1",
    size: "1280x720",
    status: "ready",
    posterUrl: img("demo-take-1", 1280, 720),
    prompt: "Slow cinematic push-in, drifting vapor",
    sourceCreativeId: "demo",
    sourceTitle: "Neon sneaker — launch hero",
    createdAt: "2026-06-22T11:30:00Z",
  },
  {
    id: "vid2",
    size: "720x1280",
    status: "ready",
    posterUrl: img("c1-take-2", 720, 1280),
    prompt: "Orbit reveal around the glass",
    sourceCreativeId: "c1",
    sourceTitle: "Citrus spritz — summer set",
    createdAt: "2026-06-23T15:02:00Z",
  },
  {
    id: "vid3",
    size: "1080x1080",
    status: "pending",
    posterUrl: img("c2-take-0", 1080, 1080),
    prompt: "Soft drift with rotating highlights",
    sourceCreativeId: "c2",
    sourceTitle: "Analog headphones",
    createdAt: "2026-06-24T09:10:00Z",
  },
]

export const account = {
  name: "Studio Kreeyts",
  email: "studio@kreeyts.app",
  credits: 240,
}

export const runningJobs = 2

export function creativeById(id: string) {
  return creatives.find((c) => c.id === id)
}
