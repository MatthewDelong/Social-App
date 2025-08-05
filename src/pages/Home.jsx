// src/pages/Home.jsx
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../context/AppContext';

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [commentMap, setCommentMap] = useState({});
  const { user } = useAppContext();

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setPosts(docs);
    });
    return () => unsub();
  }, []);

  const handleLike = async (id) => {
    const postRef = doc(db, 'posts', id);
    await updateDoc(postRef, {
      likes: arrayUnion(user.uid)
    });
  };

  const handleComment = async (id) => {
    const comment = commentMap[id];
    if (!comment) return;

    const postRef = doc(db, 'posts', id);
    await updateDoc(postRef, {
      comments: arrayUnion({
        text: comment,
        author: user.email,
        createdAt: new Date().toISOString()
      })
    });

    setCommentMap((prev) => ({ ...prev, [id]: '' }));
  };

  return (
    <div className="max-w-xl mx-auto mt-10">
      {posts.length === 0 && <p className="text-center text-gray-600">No posts yet.</p>}
      {posts.map((post) => (
        <div key={post.id} className="border p-4 rounded mb-4">
          <p className="font-bold">{post.author}</p>
          <p>{post.content}</p>
          <button onClick={() => handleLike(post.id)} className="text-blue-500">
            ❤️ Like ({post.likes?.length || 0})
          </button>
          <div className="mt-2">
            <input
              type="text"
              placeholder="Add comment"
              value={commentMap[post.id] || ''}
              onChange={(e) => setCommentMap({ ...commentMap, [post.id]: e.target.value })}
              className="border p-1 w-full rounded"
            />
            <button
              onClick={() => handleComment(post.id)}
              className="text-sm text-green-600 mt-1"
            >
              Comment
            </button>
          </div>
          <div className="mt-2 space-y-1">
            {post.comments?.map((c, i) => (
              <div key={i} className="text-sm text-gray-700">
                <strong>{c.author}</strong>: {c.text}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
