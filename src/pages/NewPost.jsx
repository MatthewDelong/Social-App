// src/pages/NewPost.jsx
import { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export default function NewPost() {
  const { user } = useAppContext();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'posts'), {
        text,
        uid: user.uid,
        authorName: user.displayName || '',
        authorEmail: user.email || '',
        createdAt: serverTimestamp()
      });

      setText('');
      navigate('/'); // Redirect to home after post
    } catch (error) {
      console.error('Error posting:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-md rounded">
      <h2 className="text-2xl font-semibold mb-4">Create New Post</h2>
      <form onSubmit={handleSubmit}>
        <textarea
          className="w-full border p-3 rounded mb-4"
          rows="5"
          placeholder="Write your post..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {loading ? 'Posting...' : 'Post'}
        </button>
      </form>
    </div>
  );
}