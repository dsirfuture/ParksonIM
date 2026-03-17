"use client";

type ImageLightboxProps = {
  open: boolean;
  src: string;
  alt?: string;
  title?: string;
  onClose: () => void;
};

export function ImageLightbox({
  open,
  src,
  alt,
  title,
  onClose,
}: ImageLightboxProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[920px] overflow-hidden bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              {title || alt || "图片预览"}
            </div>
          </div>
        </div>

        <div
          className="flex max-h-[78vh] cursor-zoom-out items-center justify-center bg-slate-100 p-4"
          onClick={onClose}
        >
          <img
            src={src}
            alt={alt || title || "preview"}
            className="max-h-[72vh] w-auto max-w-full cursor-zoom-out object-contain"
          />
        </div>
      </div>
    </div>
  );
}
