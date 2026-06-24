import { useEffect, useState } from "react";

/** True on phones, tablets in landscape, or narrow viewports where a two-column layout clips. */
export function useCompactLayout() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const landscape = window.matchMedia("(orientation: landscape)").matches;
      setCompact(w < 768 || w < 1100 || (landscape && h < 920));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return compact;
}
