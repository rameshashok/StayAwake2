import { useEffect, useRef } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

const TAG = "stayawake-detection";

export function useKeepAwake(active) {
  const isActive = useRef(false);
  useEffect(() => {
    if (active) {
      isActive.current = true;
      activateKeepAwakeAsync(TAG);
    } else if (isActive.current) {
      isActive.current = false;
      deactivateKeepAwake(TAG);
    }
    return () => {
      if (isActive.current) deactivateKeepAwake(TAG);
    };
  }, [active]);
}
