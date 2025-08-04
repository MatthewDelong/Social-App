import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from 'firebase/auth';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp
} from 'firebase/firestore';

const AppContext = createContext();
export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, u => setCurrentUser(u));
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubPosts = onSnapshot(q, snap => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubAuth(); unsubPosts(); };
  }, []);

  const signup = (email, pwd) => createUserWithEmailAndPassword(auth, email, pwd);
  const login = (email, pwd) => signInWithEmailAndPassword(auth, email, pwd);
  const logout = () => signOut(auth);

  const addPost = content => addDoc(collection(db, 'posts'), {
    author: currentUser.email,
    content, likes: 0, comments: [], createdAt: serverTimestamp()
  });

  const likePost = id => {
    const ref = doc(db, 'posts', id);
    const post = posts.find(p => p.id === id);
    return updateDoc(ref, { likes: (post.likes || 0) + 1 });
  };

  const commentPost = (id, comment) => {
    const ref = doc(db, 'posts', id);
    const post = posts.find(p => p.id === id) || {};
    const comments = post.comments || [];
    return updateDoc(ref, { comments: [...comments, { text: comment, author: currentUser.email }] });
  };

  const editPost = (id, newContent) => {
    const ref = doc(db, 'posts', id);
    return updateDoc(ref, { content: newContent });
  };

  const deletePost = id => deleteDoc(doc(db, 'posts', id));

  return (
    <AppContext.Provider value={{
      currentUser, posts,
      signup, login, logout,
      addPost, likePost, commentPost,
      editPost, deletePost
    }}>
      {children}
    </AppContext.Provider>
  );
};