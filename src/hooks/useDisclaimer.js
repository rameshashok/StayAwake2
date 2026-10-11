import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logEvent } from "../analytics";

export function useDisclaimer() {
  const [showOnboarding, setShowOnboarding]   = useState(false);
  const [showDisclaimer, setShowDisclaimer]   = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("onboarding_done"),
      AsyncStorage.getItem("disclaimer_accepted"),
    ]).then(([onboarded, accepted]) => {
      if (!onboarded) setShowOnboarding(true);
      else if (!accepted) setShowDisclaimer(true);
    });
  }, []);

  const finishOnboarding = () => {
    AsyncStorage.setItem("onboarding_done", "1");
    setShowOnboarding(false);
    setShowDisclaimer(true);
  };

  const acceptDisclaimer = () => {
    AsyncStorage.setItem("disclaimer_accepted", "1");
    logEvent("disclaimer_accepted");
    setShowDisclaimer(false);
  };

  return { showOnboarding, finishOnboarding, showDisclaimer, acceptDisclaimer };
}
