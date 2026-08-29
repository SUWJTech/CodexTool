import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { AppIcon } from "./AppIcon";

type StoreCategoryRailProps = {
  ariaLabel: string;
  previousLabel: string;
  nextLabel: string;
  children: ReactNode;
};

export function StoreCategoryRail({
  ariaLabel,
  previousLabel,
  nextLabel,
  children,
}: StoreCategoryRailProps) {
  const railRef = useRef<HTMLElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const updateOverflow = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const maximum = Math.max(0, rail.scrollWidth - rail.clientWidth);
    setCanScrollBack(rail.scrollLeft > 2);
    setCanScrollForward(rail.scrollLeft < maximum - 2);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(rail);
    for (const child of Array.from(rail.children)) observer.observe(child);
    rail.addEventListener("scroll", updateOverflow, { passive: true });
    return () => {
      observer.disconnect();
      rail.removeEventListener("scroll", updateOverflow);
    };
  }, [children, updateOverflow]);

  const scroll = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction * Math.max(260, rail.clientWidth * 0.72),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  return (
    <div className="storeCategoryViewport">
      <button type="button" className="storeCategoryScrollButton isPrevious" aria-label={previousLabel} disabled={!canScrollBack} onClick={() => scroll(-1)}>
        <AppIcon name="chevron-left" />
      </button>
      <nav ref={railRef} className="storeCategoryRail" aria-label={ariaLabel} tabIndex={0}>
        {children}
      </nav>
      <button type="button" className="storeCategoryScrollButton isNext" aria-label={nextLabel} disabled={!canScrollForward} onClick={() => scroll(1)}>
        <AppIcon name="chevron-right" />
      </button>
    </div>
  );
}
