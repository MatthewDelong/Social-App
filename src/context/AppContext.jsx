// src/context/AppContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase';
import {
  onAuthStateChanged,
  signOut,
  updateProfile
} from 'firebase/auth';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Check if displayName is missing and set it if needed
        if (!currentUser.displayName) {
          try {
            await updateProfile(currentUser, {
              displayName: 'Matthew Delong' // 👈 Customize this name
            });
            await currentUser.reload(); // Refresh the user data
          } catch (error) {
            console.error('Error updating display name:', error);
          }
        }

        setUser({ ...auth.currentUser }); // Ensure updated info is set
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = () => signOut(auth);

  return (
    <AppContext.Provider value={{ user, logout, loading }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
