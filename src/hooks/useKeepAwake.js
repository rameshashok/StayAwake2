import { useEffect } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

const TAG = "stayawake-detection";

export function useKeepAwake(active) {
  useEffect(() => {
    if (active) {
      activateKeepAwakeAsync(TAG);
    } else {
      deactivateKeepAwake(TAG);
    }
    return () => deactivateKeepAwake(TAG);
  }, [active]);
}
