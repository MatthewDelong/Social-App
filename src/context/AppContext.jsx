import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingTheme, setLoadingTheme] = useState(true);

  // Default theme
  const defaultTheme = {
    navbarColor: '#ffffff',
    backgroundColor: '#f9fafb'
  };

  const [theme, setTheme] = useState(defaultTheme);

  // Save theme to Firestore & update locally instantly
  const saveTheme = async (newTheme) => {
    try {
      setTheme(newTheme);
      document.body.style.backgroundColor = newTheme.backgroundColor;
      await setDoc(doc(db, 'settings', 'theme'), newTheme);
    } catch (err) {
      console.error('Error saving theme:', err);
    }
  };

  // Load theme (first fetch, then subscribe for live updates)
  useEffect(() => {
    const themeRef = doc(db, 'settings', 'theme');

    // Initial load
    (async () => {
      try {
        const docSnap = await getDoc(themeRef);
        if (docSnap.exists()) {
          const newTheme = docSnap.data();
          setTheme(newTheme);
          document.body.style.backgroundColor = newTheme.backgroundColor;
        } else {
          setTheme(defaultTheme);
          document.body.style.backgroundColor = defaultTheme.backgroundColor;
        }
      } catch (err) {
        console.error('Error loading theme:', err);
        setTheme(defaultTheme);
        document.body.style.backgroundColor = defaultTheme.backgroundColor;
      } finally {
        setLoadingTheme(false);
      }
    })();

    // Real-time updates
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
      setLoadingUser(true); // ✅ Always set loading when auth changes

      if (currentUser) {
        try {
          // Ensure display name exists
          if (!currentUser.displayName) {
            await updateProfile(currentUser, { displayName: 'Matthew Delong' });
            await currentUser.reload();
          }

          let isAdmin = false;
          let isModerator = false;

          // Load roles from Firestore
          try {
            const docSnap = await getDoc(doc(db, 'users', currentUser.uid));
            if (docSnap.exists()) {
              const data = docSnap.data();
              isAdmin = data.isAdmin || false;
              isModerator = data.isModerator || false;
            }
          } catch (roleErr) {
            console.error('Error loading user roles:', roleErr);
          }

          setUser({
            ...auth.currentUser,
            isAdmin,
            isModerator,
            role: isAdmin ? 'admin' : isModerator ? 'moderator' : 'user'
          });
        } catch (err) {
          console.error('Error setting user:', err);
          setUser({ ...auth.currentUser });
        }
      } else {
        setUser(null);
      }

      setLoadingUser(false); // ✅ Only finish loading after all async work
    });

    return () => unsubscribe();
  }, []);

  const logout = () => signOut(auth);

  return (
    <AppContext.Provider
      value={{
        user,
        logout,
        loading: loadingUser || loadingTheme,
        theme,
        saveTheme
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);