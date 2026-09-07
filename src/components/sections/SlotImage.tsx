import { focalPosition, isSafeImageUrl, type SiteImage } from "@/lib/images";
import { cn } from "@/lib/utils";

/**
 * A photograph, or the striped placeholder that stood in for it.
 *
 * Every image slot on the public site goes through this, so adding a
 * photograph is a database row rather than a code change, and a slot with no
 * photograph keeps exactly the design the prototype had rather than showing an
 * empty box or a broken image.
 */
export function SlotImage({
  image,
  placeholderLabel,
  stripe = "stripe-warm",
  className,
  imageClassName,
  priority = false,
  sizes = "(max-width: 1024px) 100vw, 50vw",
}: {
  image: SiteImage | null | undefined;
  /** Shown inside the placeholder, in the design's monospace caption style. */
  placeholderLabel: string;
  stripe?: "stripe-warm" | "stripe-deep";
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  sizes?: string;
}) {
  if (!image || !isSafeImageUrl(image.url)) {
    return (
      <div
        className={cn(
          stripe,
          "flex items-end justify-center overflow-hidden",
          className,
        )}
      >
        <span className="pb-[26px] font-mono text-[11px] tracking-[0.12em] text-sage uppercase">
          {placeholderLabel}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-sand", className)}>
      {/*
        A plain <img> rather than next/image: the URL may point at Supabase
        Storage or another host the salon chooses later, and next/image would
        need every one of those allow-listed in next.config before it would
        render at all. Sizing and lazy-loading are set explicitly instead.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={image.alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        sizes={sizes}
        style={{ objectPosition: focalPosition(image) }}
        className={cn("h-full w-full object-cover", imageClassName)}
      />
      {image.caption && (
        <span className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-[rgba(33,49,38,0.55)] to-transparent px-4 pt-8 pb-3 text-[12px] text-sand">
          {image.caption}
        </span>
      )}
    </div>
  );
}
