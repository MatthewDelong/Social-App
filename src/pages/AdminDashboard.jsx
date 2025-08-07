// src/pages/AdminDashboard.jsx

import { useEffect, useState } from 'react';
import { db } from '../firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc
} from 'firebase/firestore';

export default function AdminDashboard() {
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const postSnapshot = await getDocs(collection(db, 'posts'));
      setPosts(postSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const userSnapshot = await getDocs(collection(db, 'users'));
      setUsers(userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    fetchData();
  }, []);

  const deletePost = async (postId) => {
    await deleteDoc(doc(db, 'posts', postId));
    setPosts(posts.filter(p => p.id !== postId));
  };

  const deleteUser = async (userId) => {
    await deleteDoc(doc(db, 'users', userId));
    setUsers(users.filter(u => u.id !== userId));
  };

  const toggleAdmin = async (userId, currentStatus) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { isAdmin: !currentStatus });
    setUsers(users.map(u => u.id === userId ? { ...u, isAdmin: !currentStatus } : u));
  };

  const toggleModerator = async (userId, currentStatus) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { isModerator: !currentStatus });
    setUsers(users.map(u => u.id === userId ? { ...u, isModerator: !currentStatus } : u));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Admin Dashboard</h2>

      {/* POSTS SECTION */}
      <section className="mb-10">
        <h3 className="text-xl font-semibold mb-2">Posts</h3>
        {posts.length === 0 && <p className="text-gray-500">No posts found.</p>}
        {posts.map(post => (
          <div key={post.id} className="border p-3 mb-3 rounded bg-gray-50">
            <p className="font-medium">{post.content}</p>
            <p className="text-sm text-gray-600 mt-1">
              By: <strong>{post.author || 'Unknown'}</strong>
            </p>
            <button
              onClick={() => deletePost(post.id)}
              className="text-sm text-red-600 hover:underline mt-2"
            >
              Delete Post
            </button>
          </div>
        ))}
      </section>

      {/* USERS SECTION */}
      <section>
        <h3 className="text-xl font-semibold mb-2">Users</h3>
        {users.map(user => (
          <div key={user.id} className="border p-3 mb-3 rounded bg-white">
            <p className="font-medium">{user.displayName || user.email}</p>
            <p className="text-sm text-gray-500 mb-1">{user.email}</p>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => toggleAdmin(user.id, user.isAdmin)}
                className="text-sm text-blue-600 hover:underline"
              >
                {user.isAdmin ? 'Revoke Admin' : 'Make Admin'}
              </button>

              <button
                onClick={() => toggleModerator(user.id, user.isModerator)}
                className="text-sm text-green-600 hover:underline"
              >
                {user.isModerator ? 'Revoke Moderator' : 'Make Moderator'}
              </button>

              {!user.isAdmin && (
                <button
                  onClick={() => deleteUser(user.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Delete User
                </button>
              )}
            </div>

            {/* Badges */}
            <div className="mt-2">
              {user.isAdmin && (
                <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-2">
                  Admin
                </span>
              )}
              {user.isModerator && (
                <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                  Moderator
                </span>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}