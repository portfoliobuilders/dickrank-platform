"use client";

export function ProtectedImage({ src, alt }: { src: string; alt: string }) {
  return (
    // The image is the content itself; saving it from the menu is blocked in the browser.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={false}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      className="max-h-[80vh] w-full rounded-2xl object-contain bg-black"
    />
  );
}
