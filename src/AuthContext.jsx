import { createContext, useState, useEffect, useContext } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("lineUser");
    if (saved) {
      setUser(JSON.parse(saved));
    }
  }, []);

  const login = (profile) => {
    localStorage.setItem("lineUser", JSON.stringify(profile));
    setUser(profile);
  };

  const logout = () => {
    localStorage.removeItem("lineUser");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
