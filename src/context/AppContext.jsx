// src/context/AppContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, signOut, updateProfile } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Ensure displayName is set
        if (!currentUser.displayName) {
          await updateProfile(currentUser, { displayName: 'Matthew Delong' });
          await currentUser.reload();
        }

        let isAdmin = false;
        let isModerator = false;

        try {
          const docSnap = await getDoc(doc(db, 'users', currentUser.uid));
          if (docSnap.exists()) {
            const data = docSnap.data();
            isAdmin = data.isAdmin || false;
            isModerator = data.isModerator || false;
          }
        } catch (e) {
          console.error('Error loading user roles:', e);
        }

        // Assign role string for easier logic checks in UI
        const role = isAdmin
          ? 'admin'
          : isModerator
          ? 'moderator'
          : 'user';

        // Set user state including roles and role string
        setUser({
          ...auth.currentUser,
          isAdmin,
          isModerator,
          role,
        });
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