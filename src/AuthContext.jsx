import { createContext, useState, useEffect, useContext, useCallback } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("lineUser");
    if (saved) {
      setUser(JSON.parse(saved));
    }
  }, []);

  const login = useCallback((profile) => {
    localStorage.setItem("lineUser", JSON.stringify(profile));
    setUser(profile);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      localStorage.setItem("lineUser", JSON.stringify(next));
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("lineUser");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
