import { ComposerHeading } from "@/components/blocks/composer/composer-heading"
import { CreativeGallery } from "@/components/blocks/create/creative-gallery"
import { ImageComposer } from "@/components/blocks/create/image-composer"

export function CreatePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-12 pb-24">
      <div className="mx-auto max-w-3xl">
        <ComposerHeading>What should we create today?</ComposerHeading>
        <ImageComposer />
      </div>
      <CreativeGallery />
    </div>
  )
}
