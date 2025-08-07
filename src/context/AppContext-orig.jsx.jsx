import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase';
import {
  onAuthStateChanged,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (!currentUser.displayName) {
          try {
            await updateProfile(currentUser, {
              displayName: 'Matthew Delong'
            });
            await currentUser.reload();
          } catch (error) {
            console.error('Error updating display name:', error);
          }
        }

        let isAdmin = false;
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            isAdmin = docSnap.data().isAdmin || false;
          }
        } catch (error) {
          console.error('Error fetching admin status:', error);
        }

        setUser({ ...auth.currentUser, isAdmin });
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
