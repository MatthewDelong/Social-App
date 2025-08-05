// src/pages/Home.jsx
import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../context/AppContext';
import { formatDistanceToNow } from 'date-fns';

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
    const post = posts.find((p) => p.id === id);
    const likes = new Set(post.likes || []);
    likes.add(user.uid);

    await updateDoc(postRef, {
      likes: Array.from(likes)
    });
  };

  const handleComment = async (id) => {
    const comment = commentMap[id];
    if (!comment.trim()) return;

    const post = posts.find((p) => p.id === id);
    const postRef = doc(db, 'posts', id);

    const newComment = {
      text: comment,
      author: user.displayName || user.email,
      uid: user.uid,
      createdAt: new Date().toISOString()
    };

    await updateDoc(postRef, {
      comments: [...(post.comments || []), newComment]
    });

    setCommentMap((prev) => ({ ...prev, [id]: '' }));
  };

  const handleDeleteComment = async (postId, index) => {
    const post = posts.find((p) => p.id === postId);
    if (!post || !post.comments) return;

    const updatedComments = [...post.comments];
    updatedComments.splice(index, 1);

    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, {
      comments: updatedComments
    });
  };

  return (
    <div className="max-w-xl mx-auto mt-10">
      {posts.length === 0 && <p className="text-center text-gray-600">No posts yet.</p>}

      {posts.map((post) => (
        <div key={post.id} className="border p-4 rounded mb-4 bg-white shadow-sm">
          <p className="font-bold text-gray-800">{post.author}</p>
          <p className="text-gray-700 mb-2">{post.content}</p>

          <button
            onClick={() => handleLike(post.id)}
            className="text-blue-500 text-sm mb-2"
          >
            ❤️ Like ({post.likes?.length || 0})
          </button>

          <div className="mt-2">
            <input
              type="text"
              placeholder="Add a comment..."
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

          <div className="mt-4 space-y-2 border-t pt-2">
            {(post.comments || []).map((comment, i) => (
              <div key={i} className="bg-gray-50 p-2 rounded">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{comment.author}</p>
                    <p className="text-sm text-gray-700">{comment.text}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {comment.uid === user.uid && (
                    <button
                      onClick={() => handleDeleteComment(post.id, i)}
                      className="text-xs text-red-500 hover:underline ml-2"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
