import { useCallback, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export function usePageGuide(steps) {
  const driverRef = useRef(null);

  const startGuide = useCallback(() => {
    driverRef.current?.destroy();

    const dObj = driver({
      showProgress: true,
      allowClose: true,
      overlayOpacity: 0.72,
      smoothScroll: true,
      nextBtnText: "ถัดไป →",
      prevBtnText: "← ย้อนกลับ",
      doneBtnText: "เข้าใจแล้ว ✓",
      progressText: "{{current}} / {{total}}",
      popoverClass: "dv-popover",
      onDestroyStarted: () => { dObj.destroy(); },
      steps,
    });

    driverRef.current = dObj;
    dObj.drive();
  }, [steps]);

  return { startGuide };
}
