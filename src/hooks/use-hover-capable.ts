import { useEffect, useState } from "react";

/** True on devices with a fine pointer and hover (desktop/laptop). */
export function useHoverCapable() {
  const [hoverCapable, setHoverCapable] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setHoverCapable(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return hoverCapable;
}
