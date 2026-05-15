/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const ImageViewerContext = createContext({
  openImage: () => {},
  closeImage: () => {},
});

async function downloadImage(src, filename) {
  if (!src) return;
  const safeName = filename || defaultFilename(src);
  const a = document.createElement("a");

  try {
    if (!src.startsWith("data:") && !src.startsWith("blob:")) {
      const response = await fetch(src, { mode: "cors" });
      if (!response.ok) throw new Error("download failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      return;
    }
  } catch {
    // บาง URL ภายนอกไม่อนุญาตให้ fetch ข้ามโดเมน จึง fallback เป็นลิงก์ดาวน์โหลดตรง
  }

  a.href = src;
  a.download = safeName;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function defaultFilename(src) {
  if (!src) return "image.jpg";
  if (src.startsWith("data:")) {
    const m = /^data:image\/(\w+)/.exec(src);
    const ext = m?.[1] === "jpeg" ? "jpg" : (m?.[1] || "jpg");
    return `image-${Date.now()}.${ext}`;
  }
  try {
    const url = new URL(src);
    const last = url.pathname.split("/").pop() || "image";
    return last.includes(".") ? last : `${last}.jpg`;
  } catch {
    return `image-${Date.now()}.jpg`;
  }
}

export function ImageViewerProvider({ children }) {
  // payload: { src, name }
  const [payload, setPayload] = useState(null);

  const openImage = useCallback((src, name) => {
    if (!src) return;
    setPayload({ src, name: name || defaultFilename(src) });
  }, []);

  const closeImage = useCallback(() => setPayload(null), []);

  useEffect(() => {
    const onDocumentClick = (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".img-viewer")) return;

      const img = event.target.closest("img");
      if (!img || img.dataset.imageViewer === "off" || img.closest("[data-image-viewer='off']")) {
        return;
      }

      const src = img.currentSrc || img.getAttribute("src");
      if (!src) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const altName = img.getAttribute("alt") || "";
      const filename = /\.[a-z0-9]{2,5}$/i.test(altName) ? altName : defaultFilename(src);
      openImage(src, filename);
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [openImage]);

  useEffect(() => {
    if (!payload) return;
    const onKey = (e) => e.key === "Escape" && closeImage();
    document.addEventListener("keydown", onKey);
    // กัน scroll ของ body ขณะเปิด viewer
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [payload, closeImage]);

  const value = useMemo(() => ({ openImage, closeImage }), [openImage, closeImage]);

  return (
    <ImageViewerContext.Provider value={value}>
      {children}
      {payload && (
        <div className="img-viewer" role="dialog" aria-modal="true" onClick={closeImage}>
          <div className="img-viewer-bar" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="img-viewer-action"
              onClick={() => downloadImage(payload.src, payload.name)}
              title="บันทึกรูป"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>บันทึกรูป</span>
            </button>
            <button
              type="button"
              className="img-viewer-close"
              onClick={closeImage}
              aria-label="ปิด"
            >
              ×
            </button>
          </div>
          <img
            src={payload.src}
            alt={payload.name}
            className="img-viewer-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </ImageViewerContext.Provider>
  );
}

export function useImageViewer() {
  return useContext(ImageViewerContext);
}
