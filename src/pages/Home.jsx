
import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../context/AppContext';
import { formatDistanceToNow } from 'date-fns';
import EmojiPicker from 'emoji-picker-react';

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [commentMap, setCommentMap] = useState({});
  const [editCommentMap, setEditCommentMap] = useState({});
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedContent, setEditedContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState({});
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState({});
  const [editReplyMap, setEditReplyMap] = useState({});
  const [editingReplyIndexMap, setEditingReplyIndexMap] = useState({});
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
      createdAt: new Date().toISOString(),
      replies: []
    };

    await updateDoc(postRef, {
      comments: [...(post.comments || []), newComment]
    });

    setCommentMap((prev) => ({ ...prev, [id]: '' }));
  };

  const handleReply = async (postId, commentIndex) => {
    const replyKey = `${postId}-reply-${commentIndex}`;
    const replyText = commentMap[replyKey];
    if (!replyText.trim()) return;

    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...(post.comments || [])];
    const reply = {
      text: replyText,
      author: user.displayName || user.email,
      uid: user.uid,
      createdAt: new Date().toISOString()
    };

    updatedComments[commentIndex].replies = [
      ...(updatedComments[commentIndex].replies || []),
      reply
    ];

    await updateDoc(doc(db, 'posts', postId), {
      comments: updatedComments
    });

    setCommentMap((prev) => ({ ...prev, [replyKey]: '' }));
  };

  const handleDeleteComment = async (postId, index) => {
    const post = posts.find((p) => p.id === postId);
    if (!post || !post.comments) return;

    const updatedComments = [...post.comments];
    updatedComments.splice(index, 1);

    await updateDoc(doc(db, 'posts', postId), {
      comments: updatedComments
    });
  };

  const handleEditComment = async (postId, index) => {
    const newText = editCommentMap[`${postId}-${index}`];
    if (!newText.trim()) return;

    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    updatedComments[index].text = newText;

    await updateDoc(doc(db, 'posts', postId), {
      comments: updatedComments
    });

    setEditCommentMap((prev) => ({ ...prev, [`${postId}-${index}`]: '' }));
  };

  const handleDeletePost = async (postId) => {
    await deleteDoc(doc(db, 'posts', postId));
  };

  const handleEditPost = async (postId) => {
    await updateDoc(doc(db, 'posts', postId), {
      content: editedContent
    });
    setEditingPostId(null);
    setEditedContent('');
  };

  const addEmoji = (key, emoji) => {
    setCommentMap((prev) => ({
      ...prev,
      [key]: (prev[key] || '') + emoji.emoji
    }));
    setShowEmojiPicker((prev) => ({ ...prev, [key]: false }));
  };

  const addReplyEmoji = (key, emoji) => {
    setCommentMap((prev) => ({
      ...prev,
      [key]: (prev[key] || '') + emoji.emoji
    }));
    setShowReplyEmojiPicker((prev) => ({ ...prev, [key]: false }));
  };

  const handleDeleteReply = async (postId, commentIndex, replyIndex) => {
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    updatedComments[commentIndex].replies.splice(replyIndex, 1);

    await updateDoc(doc(db, 'posts', postId), {
      comments: updatedComments
    });
  };

  const handleEditReply = async (postId, commentIndex, replyIndex) => {
    const key = `${postId}-${commentIndex}-${replyIndex}`;
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    updatedComments[commentIndex].replies[replyIndex].text = editReplyMap[key];

    await updateDoc(doc(db, 'posts', postId), {
      comments: updatedComments
    });

    setEditingReplyIndexMap((prev) => ({ ...prev, [key]: false }));
  };

  return (
    <div className="max-w-xl mx-auto mt-10">
      {posts.map((post) => (
        <div key={post.id} className="border p-4 rounded mb-4 bg-white shadow-sm">
          <div className="flex justify-between">
            <p className="font-bold text-gray-800">{post.author}</p>
            {post.createdAt && (
              <p className="text-xs text-gray-500">
                {formatDistanceToNow(post.createdAt.toDate ? post.createdAt.toDate() : new Date(post.createdAt), { addSuffix: true })}
              </p>
            )}
          </div>
          {editingPostId === post.id ? (
            <div className="mt-2">
              <textarea
                className="w-full border rounded p-2 text-sm"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
              />
              <button
                onClick={() => handleEditPost(post.id)}
                className="text-sm text-green-600 mt-1"
              >
                Save
              </button>
            </div>
          ) : (
            <p className="text-gray-700 mb-2">{post.content}</p>
          )}
        </div>
      ))}
    </div>
  );
}
