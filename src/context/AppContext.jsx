import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';

const AppContext = createContext();
export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
    });

    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubPosts = onSnapshot(q, snap => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(items);
    });

    return () => { unsubAuth(); unsubPosts(); };
  }, []);

  const signup = (email, pwd) => createUserWithEmailAndPassword(auth, email, pwd);
  const login = (email, pwd) => signInWithEmailAndPassword(auth, email, pwd);
  const logout = () => signOut(auth);
  const addPost = content => addDoc(collection(db, 'posts'), {
    author: currentUser.email,
    content,
    likes: 0,
    comments: [],
    createdAt: serverTimestamp()
  });

  return (
    <AppContext.Provider value={{ currentUser, posts, signup, login, logout, addPost }}>
      {children}
    </AppContext.Provider>
  );
};
