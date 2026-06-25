import { ComposerHeading } from "@/components/blocks/composer/composer-heading"
import { VideoComposer } from "@/components/blocks/videos/video-composer"
import { VideoGallery } from "@/components/blocks/videos/video-gallery"

export function VideosPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-12 pb-24">
      <div className="mx-auto max-w-4xl">
        <ComposerHeading>What should we animate today?</ComposerHeading>
        <VideoComposer />
      </div>
      <VideoGallery />
    </div>
  )
}
