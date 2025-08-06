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

  const toggleAdmin = async (userId, currentStatus) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { isAdmin: !currentStatus });
    setUsers(users.map(u => u.id === userId ? { ...u, isAdmin: !currentStatus } : u));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Admin Dashboard</h2>

      <section className="mb-10">
        <h3 className="text-xl font-semibold mb-2">Posts</h3>
        {posts.map(post => (
          <div key={post.id} className="border p-3 mb-3 rounded bg-gray-50">
            <p className="font-medium">{post.text}</p>
            <button
              onClick={() => deletePost(post.id)}
              className="text-sm text-red-600 hover:underline mt-2"
            >
              Delete Post
            </button>
          </div>
        ))}
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">Users</h3>
        {users.map(user => (
          <div key={user.id} className="border p-3 mb-3 rounded bg-white">
            <p className="font-medium">{user.displayName || user.email}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
            <button
              onClick={() => toggleAdmin(user.id, user.isAdmin)}
              className="text-sm text-blue-600 hover:underline mt-1"
            >
              {user.isAdmin ? 'Revoke Admin' : 'Make Admin'}
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
