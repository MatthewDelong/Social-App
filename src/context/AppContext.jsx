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

  // Load theme (first fetch, then subscribe)
  useEffect(() => {
    const themeRef = doc(db, 'settings', 'theme');

    // First fetch to avoid stuck loading
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
      if (currentUser) {
        if (!currentUser.displayName) {
          await updateProfile(currentUser, { displayName: 'Matthew Delong' });
          await currentUser.reload();
        }

        let isAdmin = false;
        let isModerator = false;
        let photoURL = currentUser.photoURL || '';

        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            isAdmin = data.isAdmin || false;
            isModerator = data.isModerator || false;

            // Prefer Firestore photoURL if it exists
            if (data.photoURL) {
              photoURL = data.photoURL;
            }
          }
        } catch (e) {
          console.error('Error loading user roles/profile:', e);
        }

        setUser({
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL, // ✅ Always include photoURL here
          isAdmin,
          isModerator,
          role: isAdmin ? 'admin' : isModerator ? 'moderator' : 'user'
        });
      } else {
        setUser(null);
      }

      setLoadingUser(false);
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