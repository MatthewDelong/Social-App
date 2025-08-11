// src/pages/Home.jsx
import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../context/AppContext';
import { formatDistanceToNow } from 'date-fns';
import EmojiPicker from 'emoji-picker-react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [commentMap, setCommentMap] = useState({});
  const [editCommentMap, setEditCommentMap] = useState({});
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedContent, setEditedContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState({});
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState({});
  const [editReplyMap, setEditReplyMap] = useState({});
  const [editingReplyIndexMap, setEditingReplyIndexMap] = useState({});
  const { user, theme } = useAppContext();
  const navigate = useNavigate();

  const DEFAULT_AVATAR =
    'https://firebasestorage.googleapis.com/v0/b/social-app-8a28d.firebasestorage.app/o/default-avatar.png?alt=media&token=78165d2b-f095-496c-9de2-5e143bfc41cc';

  const safeFormatDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      let date;
      if (typeof dateValue.toDate === 'function') {
        date = dateValue.toDate();
      } else if (dateValue?.seconds) {
        date = new Date(dateValue.seconds * 1000);
      } else {
        date = new Date(dateValue);
      }
      if (isNaN(date.getTime())) return '';
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return '';
    }
  };

  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, 'users'));
    const map = {};
    snap.forEach((d) => {
      map[d.id] = d.data();
    });
    setUsersMap(map);
  };

  useEffect(() => {
    fetchUsers();
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        likes: [],
        comments: [],
        reply: [],
        ...d.data()
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
    await updateDoc(postRef, { likes: Array.from(likes) });
  };

  const handleComment = async (id) => {
    const comment = commentMap[id];
    if (!comment?.trim()) return;
    const post = posts.find((p) => p.id === id);
    const postRef = doc(db, 'posts', id);
    const newComment = {
      text: comment,
      author: user.displayName || user.email || 'Unknown User',
      uid: user.uid,
      role: user.role || 'user',
      createdAt: new Date().toISOString(),
      replies: []
    };
    const updatedComments = [...(post.comments || []), newComment];
    // update DB
    await updateDoc(postRef, { comments: updatedComments });
    // update UI immediately
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, comments: updatedComments } : p))
    );
    setCommentMap((prev) => ({ ...prev, [id]: '' }));
  };

  const handleReply = async (postId, commentIndex) => {
    const replyKey = `${postId}-reply-${commentIndex}`;
    const replyText = commentMap[replyKey];
    if (!replyText?.trim()) return;
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...(post.comments || [])];
    const reply = {
      text: replyText,
      author: user.displayName || user.email || 'Unknown User',
      uid: user.uid,
      role: user.role || 'user',
      createdAt: new Date().toISOString()
    };
    updatedComments[commentIndex].replies = [
      ...(updatedComments[commentIndex].replies || []),
      reply
    ];
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    // update UI immediately
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
    setCommentMap((prev) => ({ ...prev, [replyKey]: '' }));
  };

  const handleDeleteComment = async (postId, index) => {
    const post = posts.find((p) => p.id === postId);
    if (!post?.comments) return;
    const updatedComments = [...post.comments];
    updatedComments.splice(index, 1);
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    // update UI immediately
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
  };

  // ✅ Updated: edit comment updates DB and local posts state immediately
  const handleEditComment = async (postId, index) => {
    const newText = editCommentMap[`${postId}-${index}`];
    if (!newText?.trim()) return;
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    updatedComments[index].text = newText;
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    // update local state so UI reflects change instantly
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
    setEditCommentMap((prev) => ({ ...prev, [`${postId}-${index}`]: '' }));
  };

  const handleDeletePost = async (postId) => {
    await deleteDoc(doc(db, 'posts', postId));
  };

  const handleEditPost = async (postId) => {
    await updateDoc(doc(db, 'posts', postId), { content: editedContent });
    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId ? { ...p, content: editedContent } : p
      )
    );
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
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    // update UI immediately
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
  };

  // ✅ Also update local posts for edited replies
  const handleEditReply = async (postId, commentIndex, replyIndex) => {
    const key = `${postId}-${commentIndex}-${replyIndex}`;
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    updatedComments[commentIndex].replies[replyIndex].text = editReplyMap[key];
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    // update UI immediately
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
    setEditingReplyIndexMap((prev) => ({ ...prev, [key]: false }));
    setEditReplyMap((prev) => ({ ...prev, [key]: '' }));
  };

  // Navigate to a user's profile (assumes route /profile/:uid exists)
  const goToProfile = (uid) => {
    if (!uid) return;
    navigate(`/profile/${uid}`);
  };

  return (
    <div
      className="max-w-xl mx-auto mt-10"
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
    >
      {posts.map((post) => {
        const postUser = usersMap[post.uid];
        const postAvatar = postUser?.photoURL || DEFAULT_AVATAR;
        return (
          <div key={post.id} className="border p-4 rounded mb-4 bg-white shadow-sm">
            <div className="flex justify-between">
              <div className="flex items-center space-x-2">
                <img
                  src={postAvatar}
                  alt="avatar"
                  className="w-8 h-8 rounded-full object-cover cursor-pointer"
                  onClick={() => goToProfile(post.uid)}
                />
                <p
                  className="font-bold text-gray-800 cursor-pointer"
                  onClick={() => goToProfile(post.uid)}
                >
                  {postUser?.displayName || post.author || 'Unknown User'}
                  {usersMap[post.uid]?.isAdmin && (
                    <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">Admin</span>
                  )}
                  {usersMap[post.uid]?.isModerator && (
                    <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">Moderator</span>
                  )}
                </p>
              </div>
              {(post.uid === user.uid || user.role === 'admin' || user.role === 'moderator') && (
                <div className="space-x-2">
                  <button
                    onClick={() => {
                      setEditingPostId(post.id);
                      setEditedContent(post.content);
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
<div className="mt-2 text-gray-900">
              {editingPostId === post.id ? (
                <div>
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="border p-2 w-full rounded"
                  />
                  <button
                    onClick={() => handleEditPost(post.id)}
                    className="mt-1 text-sm bg-blue-500 text-white px-2 py-1 rounded"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <p>{post.content}</p>
              )}
            </div>

            <div className="flex items-center space-x-4 mt-2">
              <button
                onClick={() => handleLike(post.id)}
                className="text-sm text-gray-600"
              >
                👍 {post.likes?.length || 0}
              </button>
              <span className="text-xs text-gray-500">
                {safeFormatDate(post.createdAt)}
              </span>
            </div>

            {/* Comments */}
            <div className="mt-4 space-y-4">
              {(post.comments || []).map((comment, i) => {
                const commentUser = usersMap[comment.uid];
                const commentAvatar = commentUser?.photoURL || DEFAULT_AVATAR;
                return (
                  <div key={i} className="ml-4">
                    <div className="flex items-start space-x-2">
                      <img
                        src={commentAvatar}
                        alt="avatar"
                        className="w-6 h-6 rounded-full object-cover cursor-pointer"
                        onClick={() => goToProfile(comment.uid)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p
                            className="font-semibold text-gray-800 cursor-pointer"
                            onClick={() => goToProfile(comment.uid)}
                          >
                            {commentUser?.displayName || comment.author}
                            {commentUser?.isAdmin && (
                              <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">Admin</span>
                            )}
                            {commentUser?.isModerator && (
                              <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">Moderator</span>
                            )}
                          </p>
                          <span className="text-xs text-gray-500">
                            {safeFormatDate(comment.createdAt)}
                          </span>
                        </div>

                        {editCommentMap[`${post.id}-${i}`] !== undefined ? (
                          <div>
                            <textarea
                              value={editCommentMap[`${post.id}-${i}`]}
                              onChange={(e) =>
                                setEditCommentMap((prev) => ({
                                  ...prev,
                                  [`${post.id}-${i}`]: e.target.value
                                }))
                              }
                              className="border p-1 w-full rounded"
                            />
                            <button
                              onClick={() => handleEditComment(post.id, i)}
                              className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded mt-1"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <p className="text-gray-900">{comment.text}</p>
                        )}

                        {/* Comment owner controls */}
                        {comment.uid === user.uid &&
                          editCommentMap[`${post.id}-${i}`] === undefined && (
                            <div className="space-x-2 mt-1">
                              <button
                                onClick={() =>
                                  setEditCommentMap((prev) => ({
                                    ...prev,
                                    [`${post.id}-${i}`]: comment.text
                                  }))
                                }
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteComment(post.id, i)
                                }
                                className="text-xs text-red-500 hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          )}

                        {/* Replies */}
                        <div className="ml-4 mt-2 space-y-2">
                          {(comment.replies || []).map((reply, ri) => {
                            const replyUser = usersMap[reply.uid];
                            const replyAvatar = replyUser?.photoURL || DEFAULT_AVATAR;
                            const replyKey = `${post.id}-${i}-${ri}`;
                            return (
                              <div key={ri} className="flex items-start space-x-2">
                                <img
                                  src={replyAvatar}
                                  alt="avatar"
                                  className="w-5 h-5 rounded-full object-cover cursor-pointer"
                                  onClick={() => goToProfile(reply.uid)}
                                />
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <p
                                      className="font-semibold text-gray-800 cursor-pointer"
                                      onClick={() => goToProfile(reply.uid)}
                                    >
                                      {replyUser?.displayName || reply.author}
                                      {replyUser?.isAdmin && (
                                        <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">Admin</span>
                                      )}
                                      // src/pages/Home.jsx
import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../context/AppContext';
import { formatDistanceToNow } from 'date-fns';
import EmojiPicker from 'emoji-picker-react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [commentMap, setCommentMap] = useState({});
  const [editCommentMap, setEditCommentMap] = useState({});
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedContent, setEditedContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState({});
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState({});
  const [editReplyMap, setEditReplyMap] = useState({});
  const [editingReplyIndexMap, setEditingReplyIndexMap] = useState({});
  const { user, theme } = useAppContext();
  const navigate = useNavigate();

  const DEFAULT_AVATAR =
    'https://firebasestorage.googleapis.com/v0/b/social-app-8a28d.firebasestorage.app/o/default-avatar.png?alt=media&token=78165d2b-f095-496c-9de2-5e143bfc41cc';

  const safeFormatDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      let date;
      if (typeof dateValue.toDate === 'function') {
        date = dateValue.toDate();
      } else if (dateValue?.seconds) {
        date = new Date(dateValue.seconds * 1000);
      } else {
        date = new Date(dateValue);
      }
      if (isNaN(date.getTime())) return '';
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return '';
    }
  };

  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, 'users'));
    const map = {};
    snap.forEach((d) => {
      map[d.id] = d.data();
    });
    setUsersMap(map);
  };

  useEffect(() => {
    fetchUsers();
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        likes: [],
        comments: [],
        reply: [],
        ...d.data()
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
    await updateDoc(postRef, { likes: Array.from(likes) });
  };

  const handleComment = async (id) => {
    const comment = commentMap[id];
    if (!comment?.trim()) return;
    const post = posts.find((p) => p.id === id);
    const postRef = doc(db, 'posts', id);
    const newComment = {
      text: comment,
      author: user.displayName || user.email || 'Unknown User',
      uid: user.uid,
      role: user.role || 'user',
      createdAt: new Date().toISOString(),
      replies: []
    };
    const updatedComments = [...(post.comments || []), newComment];
    // update DB
    await updateDoc(postRef, { comments: updatedComments });
    // update UI immediately
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, comments: updatedComments } : p))
    );
    setCommentMap((prev) => ({ ...prev, [id]: '' }));
  };

  const handleReply = async (postId, commentIndex) => {
    const replyKey = `${postId}-reply-${commentIndex}`;
    const replyText = commentMap[replyKey];
    if (!replyText?.trim()) return;
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...(post.comments || [])];
    const reply = {
      text: replyText,
      author: user.displayName || user.email || 'Unknown User',
      uid: user.uid,
      role: user.role || 'user',
      createdAt: new Date().toISOString()
    };
    updatedComments[commentIndex].replies = [
      ...(updatedComments[commentIndex].replies || []),
      reply
    ];
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    // update UI immediately
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
    setCommentMap((prev) => ({ ...prev, [replyKey]: '' }));
  };

  const handleDeleteComment = async (postId, index) => {
    const post = posts.find((p) => p.id === postId);
    if (!post?.comments) return;
    const updatedComments = [...post.comments];
    updatedComments.splice(index, 1);
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    // update UI immediately
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
  };

  // ✅ Updated: edit comment updates DB and local posts state immediately
  const handleEditComment = async (postId, index) => {
    const newText = editCommentMap[`${postId}-${index}`];
    if (!newText?.trim()) return;
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    updatedComments[index].text = newText;
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    // update local state so UI reflects change instantly
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
    setEditCommentMap((prev) => ({ ...prev, [`${postId}-${index}`]: '' }));
  };

  const handleDeletePost = async (postId) => {
    await deleteDoc(doc(db, 'posts', postId));
  };

  const handleEditPost = async (postId) => {
    await updateDoc(doc(db, 'posts', postId), { content: editedContent });
    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId ? { ...p, content: editedContent } : p
      )
    );
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
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    // update UI immediately
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
  };

  // ✅ Also update local posts for edited replies
  const handleEditReply = async (postId, commentIndex, replyIndex) => {
    const key = `${postId}-${commentIndex}-${replyIndex}`;
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    updatedComments[commentIndex].replies[replyIndex].text = editReplyMap[key];
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    // update UI immediately
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
    setEditingReplyIndexMap((prev) => ({ ...prev, [key]: false }));
    setEditReplyMap((prev) => ({ ...prev, [key]: '' }));
  };

  // Navigate to a user's profile (assumes route /profile/:uid exists)
  const goToProfile = (uid) => {
    if (!uid) return;
    navigate(`/profile/${uid}`);
  };

  return (
    <div
      className="max-w-xl mx-auto mt-10"
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
    >
      {posts.map((post) => {
        const postUser = usersMap[post.uid];
        const postAvatar = postUser?.photoURL || DEFAULT_AVATAR;
        return (
          <div key={post.id} className="border p-4 rounded mb-4 bg-white shadow-sm">
            <div className="flex justify-between">
              <div className="flex items-center space-x-2">
                <img
                  src={postAvatar}
                  alt="avatar"
                  className="w-8 h-8 rounded-full object-cover cursor-pointer"
                  onClick={() => goToProfile(post.uid)}
                />
                <p
                  className="font-bold text-gray-800 cursor-pointer"
                  onClick={() => goToProfile(post.uid)}
                >
                  {postUser?.displayName || post.author || 'Unknown User'}
                  {usersMap[post.uid]?.isAdmin && (
                    <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">Admin</span>
                  )}
                  {usersMap[post.uid]?.isModerator && (
                    <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">Moderator</span>
                  )}
                </p>
              </div>
              {(post.uid === user.uid || user.role === 'admin' || user.role === 'moderator') && (
                <div className="space-x-2">
                  <button
                    onClick={() => {
                      setEditingPostId(post.id);
                      setEditedContent(post.content);
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
<div className="mt-2 text-gray-900">
              {editingPostId === post.id ? (
                <div>
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="border p-2 w-full rounded"
                  />
                  <button
                    onClick={() => handleEditPost(post.id)}
                    className="mt-1 text-sm bg-blue-500 text-white px-2 py-1 rounded"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <p>{post.content}</p>
              )}
            </div>

            <div className="flex items-center space-x-4 mt-2">
              <button
                onClick={() => handleLike(post.id)}
                className="text-sm text-gray-600"
              >
                👍 {post.likes?.length || 0}
              </button>
              <span className="text-xs text-gray-500">
                {safeFormatDate(post.createdAt)}
              </span>
            </div>

            {/* Comments */}
            <div className="mt-4 space-y-4">
              {(post.comments || []).map((comment, i) => {
                const commentUser = usersMap[comment.uid];
                const commentAvatar = commentUser?.photoURL || DEFAULT_AVATAR;
                return (
                  <div key={i} className="ml-4">
                    <div className="flex items-start space-x-2">
                      <img
                        src={commentAvatar}
                        alt="avatar"
                        className="w-6 h-6 rounded-full object-cover cursor-pointer"
                        onClick={() => goToProfile(comment.uid)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p
                            className="font-semibold text-gray-800 cursor-pointer"
                            onClick={() => goToProfile(comment.uid)}
                          >
                            {commentUser?.displayName || comment.author}
                            {commentUser?.isAdmin && (
                              <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">Admin</span>
                            )}
                            {commentUser?.isModerator && (
                              <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">Moderator</span>
                            )}
                          </p>
                          <span className="text-xs text-gray-500">
                            {safeFormatDate(comment.createdAt)}
                          </span>
                        </div>

                        {editCommentMap[`${post.id}-${i}`] !== undefined ? (
                          <div>
                            <textarea
                              value={editCommentMap[`${post.id}-${i}`]}
                              onChange={(e) =>
                                setEditCommentMap((prev) => ({
                                  ...prev,
                                  [`${post.id}-${i}`]: e.target.value
                                }))
                              }
                              className="border p-1 w-full rounded"
                            />
                            <button
                              onClick={() => handleEditComment(post.id, i)}
                              className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded mt-1"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <p className="text-gray-900">{comment.text}</p>
                        )}

                        {/* Comment owner controls */}
                        {comment.uid === user.uid &&
                          editCommentMap[`${post.id}-${i}`] === undefined && (
                            <div className="space-x-2 mt-1">
                              <button
                                onClick={() =>
                                  setEditCommentMap((prev) => ({
                                    ...prev,
                                    [`${post.id}-${i}`]: comment.text
                                  }))
                                }
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteComment(post.id, i)
                                }
                                className="text-xs text-red-500 hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          )}

                        {/* Replies */}
                        <div className="ml-4 mt-2 space-y-2">
                          {(comment.replies || []).map((reply, ri) => {
                            const replyUser = usersMap[reply.uid];
                            const replyAvatar = replyUser?.photoURL || DEFAULT_AVATAR;
                            const replyKey = `${post.id}-${i}-${ri}`;
                            return (
                              <div key={ri} className="flex items-start space-x-2">
                                <img
                                  src={replyAvatar}
                                  alt="avatar"
                                  className="w-5 h-5 rounded-full object-cover cursor-pointer"
                                  onClick={() => goToProfile(reply.uid)}
                                />
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <p
                                      className="font-semibold text-gray-800 cursor-pointer"
                                      onClick={() => goToProfile(reply.uid)}
                                    >
                                      {replyUser?.displayName || reply.author}
                                      {replyUser?.isAdmin && (
                                        <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">Admin</span>
                                      )}
                                      {replyUser?.isModerator && (
                                        <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">Moderator</span>
                                      )}
                                    </p>
                                    <span className="text-xs text-gray-500">
                                      {safeFormatDate(reply.createdAt)}
                                    </span>
                                  </div>

                                  {editingReplyIndexMap[replyKey] ? (
                                    <div>
                                      <textarea
                                        value={editReplyMap[replyKey]}
                                        onChange={(e) =>
                                          setEditReplyMap((prev) => ({
                                            ...prev,
                                            [replyKey]: e.target.value
                                          }))
                                        }
                                        className="border p-1 w-full rounded"
                                      />
                                      <button
                                        onClick={() =>
                                          handleEditReply(post.id, i, ri)
                                        }
                                        className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded mt-1"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  ) : (
                                    <p className="text-gray-900">{reply.text}</p>
                                  )}

                                  {reply.uid === user.uid &&
                                    !editingReplyIndexMap[replyKey] && (
                                      <div className="space-x-2 mt-1">
                                        <button
                                          onClick={() => {
                                            setEditingReplyIndexMap((prev) => ({
                                              ...prev,
                                              [replyKey]: true
                                            }));
                                            setEditReplyMap((prev) => ({
                                              ...prev,
                                              [replyKey]: reply.text
                                            }));
                                          }}
                                          className="text-xs text-blue-600 hover:underline"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleDeleteReply(post.id, i, ri)
                                          }
                                          className="text-xs text-red-500 hover:underline"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                </div>
                              </div>
                            );
                          })}

                          {/* Reply input */}
                          <div className="flex items-start space-x-2 mt-1">
                            <textarea
                              placeholder="Write a reply..."
                              value={commentMap[`${post.id}-reply-${i}`] || ''}
                              onChange={(e) =>
                                setCommentMap((prev) => ({
                                  ...prev,
                                  [`${post.id}-reply-${i}`]: e.target.value
                                }))
                              }
                              className="border p-1 flex-1 rounded"
                            />
                            <button
                              onClick={() => handleReply(post.id, i)}
                              className="text-xs bg-yellow-100 text-black-800 px-2 py-0.5 rounded"
                            >
                              Reply
                            </button>
                            <button
                              onClick={() =>
                                setShowReplyEmojiPicker((prev) => ({
                                  ...prev,
                                  [`${post.id}-reply-${i}`]:
                                    !prev[`${post.id}-reply-${i}`]
                                }))
                              }
                              className="text-xs bg-yellow-400 px-2 py-0.5 rounded"
                            >
                              😀
                            </button>
                          </div>
                          {showReplyEmojiPicker[`${post.id}-reply-${i}`] && (
                            <div className="relative inline-block group">
                              <button
                                onClick={() =>
                                  setShowReplyEmojiPicker((prev) => ({
                                    ...prev,
                                    [`${post.id}-reply-${i}`]: false
                                  }))
                                }
                                className="absolute top-0 right-0 bg-yellow-300 text-black rounded-full px-1 opacity-0 group-hover:opacity-100 transition hover:bg-yellow-500 hover:text-white"
                              >
                                ✖
                              </button>
                              <EmojiPicker
                                onEmojiClick={(emoji) =>
                                  addReplyEmoji(`${post.id}-reply-${i}`, emoji)
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* New Comment input */}
              <div className="flex items-start space-x-2">
                <textarea
                  placeholder="Write a comment..."
                  value={commentMap[post.id] || ''}
                  onChange={(e) =>
                    setCommentMap((prev) => ({
                      ...prev,
                      [post.id]: e.target.value
                    }))
                  }
                  className="border p-1 flex-1 rounded"
                />
                <button
                  onClick={() => handleComment(post.id)}
                  className="text-xs bg-yellow-100 text-black-800 px-2 py-0.5 rounded"
                >
                  Comment
                </button>
                <button
                  onClick={() =>
                    setShowEmojiPicker((prev) => ({
                      ...prev,
                      [post.id]: !prev[post.id]
                    }))
                  }
                  className="text-xs bg-yellow-400 px-2 py-0.5 rounded"
                >
                  😀
                </button>
              </div>
              {showEmojiPicker[post.id] && (
                <div className="relative inline-block group">
                  <button
                    onClick={() =>
                      setShowEmojiPicker((prev) => ({
                        ...prev,
                        [post.id]: false
                      }))
                    }
                    className="absolute top-0 right-0 bg-yellow-300 text-black rounded-full px-1 opacity-0 group-hover:opacity-100 transition hover:bg-yellow-500 hover:text-white"
                  >
                    ✖
                  </button>
                  <EmojiPicker
                    onEmojiClick={(emoji) => addEmoji(post.id, emoji)}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}