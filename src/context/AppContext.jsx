import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Theme state
  const [theme, setTheme] = useState({
    navbarColor: '#ffffff',
    backgroundColor: '#f9fafb'
  });

  // Save theme to Firestore & update locally instantly
  const saveTheme = async (newTheme) => {
    try {
      setTheme(newTheme); // instantly update UI
      document.body.style.backgroundColor = newTheme.backgroundColor; // update global bg
      await setDoc(doc(db, 'settings', 'theme'), newTheme); // persist in Firestore
    } catch (err) {
      console.error('Error saving theme:', err);
    }
  };

  // Load theme in real-time (runs even if logged out)
  useEffect(() => {
    const themeRef = doc(db, 'settings', 'theme');
    const unsubTheme = onSnapshot(themeRef, (snapshot) => {
      if (snapshot.exists()) {
        const newTheme = snapshot.data();
        setTheme(newTheme);
        document.body.style.backgroundColor = newTheme.backgroundColor;
      }
    });
    return () => unsubTheme();
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
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

        setUser({
          ...auth.currentUser,
          isAdmin,
          isModerator,
          role: isAdmin ? 'admin' : isModerator ? 'moderator' : 'user'
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
    <AppContext.Provider value={{ user, logout, loading, theme, saveTheme }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);