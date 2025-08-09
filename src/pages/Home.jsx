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

  // ✅ Safe date formatter
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

  // 🔹 Fetch all users into a map
  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, 'users'));
    const map = {};
    snap.forEach((doc) => {
      map[doc.id] = doc.data();
    });
    setUsersMap(map);
  };

  // 🔹 Load posts live
  useEffect(() => {
    fetchUsers();
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        likes: [],
        comments: [],
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
    await updateDoc(postRef, {
      comments: [...(post.comments || []), newComment]
    });
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
    setCommentMap((prev) => ({ ...prev, [replyKey]: '' }));
  };

  const handleDeleteComment = async (postId, index) => {
    const post = posts.find((p) => p.id === postId);
    if (!post?.comments) return;
    const updatedComments = [...post.comments];
    updatedComments.splice(index, 1);
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
  };

  const handleEditComment = async (postId, index) => {
    const newText = editCommentMap[`${postId}-${index}`];
    if (!newText?.trim()) return;
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    updatedComments[index].text = newText;
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
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
  };

  const handleEditReply = async (postId, commentIndex, replyIndex) => {
    const key = `${postId}-${commentIndex}-${replyIndex}`;
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    updatedComments[commentIndex].replies[replyIndex].text = editReplyMap[key];
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    setEditingReplyIndexMap((prev) => ({ ...prev, [key]: false }));
  };

  return (
    <div
      className="max-w-xl mx-auto mt-10"
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
    >
      {posts.map((post) => {
        const postUser = usersMap[post.uid];
        return (
          <div key={post.id} className="border p-4 rounded mb-4 bg-white shadow-sm">
            <div className="flex justify-between">
              <p className="font-bold text-gray-800">
                {postUser?.displayName || post.author || 'Unknown User'}
                {post.role === 'admin' && (
                  <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded">Admin</span>
                )}
                {post.role === 'moderator' && (
                  <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">Moderator</span>
                )}
              </p>
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
              <>
                <p className="text-gray-700 mb-2">{post.content}</p>
                {post.createdAt && (
                  <p className="text-xs text-gray-500 mb-2">{safeFormatDate(post.createdAt)}</p>
                )}
              </>
            )}

            <button
              onClick={() => handleLike(post.id)}
              className="text-blue-500 text-sm mb-2"
            >
              ❤️ Like ({post.likes?.length || 0})
            </button>

            {/* Comment Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Add a comment..."
                value={commentMap[post.id] || ''}
                onChange={(e) =>
                  setCommentMap({ ...commentMap, [post.id]: e.target.value })
                }
                className="border p-1 w-full rounded"
              />
              <button
                onClick={() =>
                  setShowEmojiPicker((prev) => ({
                    ...prev,
                    [post.id]: !prev[post.id]
                  }))
                }
                className="text-sm text-yellow-500 mt-1"
              >
                😊
              </button>
              {showEmojiPicker[post.id] && (
                <div className="absolute z-10 mt-2">
                  <EmojiPicker onEmojiClick={(e) => addEmoji(post.id, e)} />
                </div>
              )}
            </div>
            <button
              onClick={() => handleComment(post.id)}
              className="text-sm text-green-600 mt-1"
            >
              Comment
            </button>

            {/* Comments */}
            <div className="mt-4 space-y-2 border-t pt-2">
              {(post.comments || []).map((comment, i) => (
                <div key={i} className="bg-gray-50 p-2 rounded">
                  <div className="flex justify-between items-start">
                    <div className="w-full">
                      <p className="text-sm font-semibold text-gray-800">
                        {comment.author || usersMap[comment.uid]?.displayName || 'Unknown User'}
                        {comment.role === 'admin' && (
                          <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded">Admin</span>
                        )}
                        {comment.role === 'moderator' && (
                          <span className="ml-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">Moderator</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-700">{comment.text}</p>
                      <p className="text-xs text-gray-500 mt-1">{safeFormatDate(comment.createdAt)}</p>

                      {/* Replies */}
                      {(comment.replies || []).map((reply, j) => {
                        const key = `${post.id}-${i}-${j}`;
                        return (
                          <div key={j} className="ml-4 mt-2 p-2 bg-gray-100 rounded">
                            <p className="text-sm font-semibold text-gray-800">
                              {reply.author || usersMap[reply.uid]?.displayName || 'Unknown User'}
                              {reply.role === 'admin' && (
                                <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded">Admin</span>
                              )}
                              {reply.role === 'moderator' && (
                                <span className="ml-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">Moderator</span>
                              )}
                            </p>
                            <p className="text-sm text-gray-700">{reply.text}</p>
                            <p className="text-xs text-gray-500 mt-1">{safeFormatDate(reply.createdAt)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}