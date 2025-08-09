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

  const defaultAvatar =
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
    snap.forEach((doc) => {
      map[doc.id] = doc.data();
    });
    setUsersMap(map);
  };

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
              <div className="flex items-center gap-2">
                <img
                  src={postUser?.photoURL || defaultAvatar}
                  alt="avatar"
                  className="w-8 h-8 rounded-full object-cover"
                />
                <p className="font-bold text-gray-800">
                  {postUser?.displayName || post.author || 'Unknown User'}
                  {usersMap[post.uid]?.isAdmin && (
                    <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded">Admin</span>
                  )}
                  {usersMap[post.uid]?.isModerator && (
                    <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">Moderator</span>
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
                      <div className="flex items-center gap-2">
                        <img
                          src={usersMap[comment.uid]?.photoURL || defaultAvatar}
                          alt="avatar"
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        <p className="text-sm font-semibold text-gray-800">
                          {comment.author || usersMap[comment.uid]?.displayName || 'Unknown User'}
                          {usersMap[comment.uid]?.isAdmin && (
                            <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded">Admin</span>
                          )}
                          {usersMap[comment.uid]?.isModerator && (
                            <span className="ml-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">Moderator</span>
                          )}
                        </p>
                      </div>
                      <p className="text-sm text-gray-700">{comment.text}</p>
                      <p className="text-xs text-gray-500 mt-1">{safeFormatDate(comment.createdAt)}</p>

                      {/* Reply input */}
                      <div className="mt-2 ml-4">
                        <input
                          type="text"
                          placeholder="Reply..."
                          value={commentMap[`${post.id}-reply-${i}`] || ''}
                          onChange={(e) =>
                            setCommentMap({ ...commentMap, [`${post.id}-reply-${i}`]: e.target.value })
                          }
                          className="border p-1 w-full rounded text-sm"
                        />
                        <button
                          onClick={() =>
                            setShowReplyEmojiPicker((prev) => ({
                              ...prev,
                              [`${post.id}-reply-${i}`]: !prev[`${post.id}-reply-${i}`]
                            }))
                          }
                          className="text-xs text-yellow-500 mt-1"
                        >
                          😊
                        </button>
                        {showReplyEmojiPicker[`${post.id}-reply-${i}`] && (
                          <div className="absolute z-10 mt-2">
                            <EmojiPicker onEmojiClick={(e) => addReplyEmoji(`${post.id}-reply-${i}`, e)} />
                          </div>
                        )}
                        <button
                          onClick={() => handleReply(post.id, i)}
                          className="text-xs text-green-600 mt-1 ml-2"
                        >
                          Reply
                        </button>
                      </div>

                      {/* Replies */}
                      {(comment.replies || []).map((reply, j) => {
                        const key = `${post.id}-${i}-${j}`;
                        return (
                          <div key={j} className="ml-4 mt-2 p-2 bg-gray-100 rounded">
                            <div className="flex items-center gap-2">
                              <img
                                src={usersMap[reply.uid]?.photoURL || defaultAvatar}
                                alt="avatar"
                                className="w-5 h-5 rounded-full object-cover"
                              />
                              <p className="text-sm font-semibold text-gray-800">
                                {reply.author || usersMap[reply.uid]?.displayName || 'Unknown User'}
                                {usersMap[reply.uid]?.isAdmin && (
                                  <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded">Admin</span>
                                )}
                                {usersMap[reply.uid]?.isModerator && (
                                  <span className="ml-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">Moderator</span>
                                )}
                              </p>
                            </div>
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