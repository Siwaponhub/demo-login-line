import { createContext, useState, useCallback, useContext, useEffect } from "react";

const TutorialContext = createContext();

export const TutorialProvider = ({ children }) => {
  const [showWelcome, setShowWelcome] = useState(false);
  const [activeGuide, setActiveGuide] = useState(null);

  useEffect(() => {
    if (localStorage.getItem("tutorial_needed") === "1") {
      setShowWelcome(true);
    }
  }, []);

  const completeWelcome = useCallback(() => {
    localStorage.removeItem("tutorial_needed");
    localStorage.setItem("tutorial_done", "1");
    setShowWelcome(false);
  }, []);

  const replayWelcome = useCallback(() => {
    setShowWelcome(true);
  }, []);

  const openGuide = useCallback((id) => setActiveGuide(id), []);
  const closeGuide = useCallback(() => setActiveGuide(null), []);

  return (
    <TutorialContext.Provider
      value={{ showWelcome, completeWelcome, replayWelcome, activeGuide, openGuide, closeGuide }}
    >
      {children}
    </TutorialContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTutorial = () => useContext(TutorialContext);
