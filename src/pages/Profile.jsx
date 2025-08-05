import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAppContext } from '../context/AppContext';
import { updateProfile } from 'firebase/auth';
import Card from '../components/ui/card';

export default function Profile() {
  const { user } = useAppContext();
  const [posts, setPosts] = useState([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'posts'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user.uid]);

  const handleUpdate = async () => {
    try {
      await updateProfile(auth.currentUser, {
        displayName: name
      });
      setMessage('Display name updated successfully!');
      setName('');
    } catch (error) {
      console.error('Error updating display name:', error);
      setMessage('Failed to update display name.');
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10">
      <h2 className="text-xl font-bold mb-4">Update Display Name</h2>
      <div className="mb-6">
        <input
          type="text"
          placeholder="Enter new display name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2 w-full rounded"
        />
        <button
          onClick={handleUpdate}
          className="mt-2 bg-blue-500 text-white px-4 py-2 rounded"
        >
          Update Name
        </button>
        {message && <p className="mt-2 text-green-600 text-sm">{message}</p>}
      </div>

      <h2 className="text-xl font-bold mb-4">Your Posts</h2>
      {posts.length === 0 && <p className="text-gray-600">No posts yet.</p>}
      {posts.map((post) => (
        <Card key={post.id}>
          <p className="font-bold">{post.author}</p>
          <p>{post.content}</p>
        </Card>
      ))}
    </div>
  );
}
