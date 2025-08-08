// src/pages/Home.jsx
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
  const [editReplyMap, setEditReplyMap] = useState({});
  const [editingReplyIndexMap, setEditingReplyIndexMap] = useState({});
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedContent, setEditedContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState({});
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState({});
  const { user } = useAppContext();

  // Helper: safely get timestamp in ms for many formats (Firestore Timestamp, Date, string)
  const getTime = (createdAt) => {
    if (!createdAt) return 0;
    if (createdAt.seconds && typeof createdAt.seconds === 'number') return createdAt.seconds * 1000;
    if (createdAt instanceof Date) return createdAt.getTime();
    return new Date(createdAt).getTime();
  };

  // Listen to posts, order by createdAt (Firestore desc) and normalize local structure:
  // ensure posts.comments and replies are sorted newest -> oldest
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Normalize: sort comments & replies newest -> oldest (safe for mixed timestamp types)
      const normalized = docs.map((p) => {
        const comments = (p.comments || []).slice().sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
        const commentsWithSortedReplies = comments.map((c) => {
          const replies = (c.replies || []).slice().sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
          return { ...c, replies };
        });
        return { ...p, comments: commentsWithSortedReplies };
      });

      // ensure posts themselves are sorted newest -> oldest as a fallback
      normalized.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));

      setPosts(normalized);
    });

    return () => unsub();
  }, []);

  /* ---------- Post actions ---------- */

  const handleLike = async (id) => {
    const postRef = doc(db, 'posts', id);
    const post = posts.find((p) => p.id === id);
    const likes = new Set(post?.likes || []);
    likes.add(user.uid);
    await updateDoc(postRef, { likes: Array.from(likes) });

    // update local optimistically
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, likes: Array.from(likes) } : p)));
  };

  const handleDeletePost = async (postId) => {
    await deleteDoc(doc(db, 'posts', postId));
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleEditPost = async (postId) => {
    await updateDoc(doc(db, 'posts', postId), { content: editedContent });
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, content: editedContent } : p)));
    setEditingPostId(null);
    setEditedContent('');
  };

  /* ---------- Comment actions ---------- */

  // Add comment — prepend so stored order matches newest-first UI
  const handleComment = async (id) => {
    const commentText = commentMap[id];
    if (!commentText?.trim()) return;

    const post = posts.find((p) => p.id === id);
    const postRef = doc(db, 'posts', id);
    const newComment = {
      text: commentText,
      author: user.displayName || user.email,
      uid: user.uid,
      isAdmin: user.isAdmin || false,
      isModerator: user.isModerator || false,
      createdAt: new Date(),
      replies: []
    };

    const updatedComments = [newComment, ...(post.comments || [])]; // prepend
    await updateDoc(postRef, { comments: updatedComments });

    // update local state
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, comments: updatedComments } : p)));
    setCommentMap((prev) => ({ ...prev, [id]: '' }));
  };

  const handleDeleteComment = async (postId, index) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const updatedComments = (post.comments || []).slice();
    updatedComments.splice(index, 1);
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p)));
  };

  const handleEditComment = async (postId, index) => {
    const key = `${postId}-${index}`;
    const newText = editCommentMap[key];
    if (!newText?.trim()) return;

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const updatedComments = (post.comments || []).map((c, i) => (i === index ? { ...c, text: newText } : c));
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p)));

    // remove edit key to exit edit mode
    setEditCommentMap((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  /* ---------- Reply actions ---------- */

  // Add reply — prepend to keep newest-first
  const handleReply = async (postId, commentIndex) => {
    const replyKey = `${postId}-reply-${commentIndex}`;
    const replyText = commentMap[replyKey];
    if (!replyText?.trim()) return;

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const reply = {
      text: replyText,
      author: user.displayName || user.email,
      uid: user.uid,
      isAdmin: user.isAdmin || false,
      isModerator: user.isModerator || false,
      createdAt: new Date()
    };

    const updatedComments = (post.comments || []).map((c, i) => {
      if (i !== commentIndex) return c;
      const newReplies = [reply, ...(c.replies || [])]; // prepend
      return { ...c, replies: newReplies };
    });

    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p)));
    setCommentMap((prev) => ({ ...prev, [replyKey]: '' }));
  };

  const handleDeleteReply = async (postId, commentIndex, replyIndex) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const updatedComments = (post.comments || []).map((c, i) => {
      if (i !== commentIndex) return c;
      const newReplies = (c.replies || []).slice();
      newReplies.splice(replyIndex, 1);
      return { ...c, replies: newReplies };
    });

    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p)));
  };

  const handleEditReply = async (postId, commentIndex, replyIndex) => {
    const key = `${postId}-${commentIndex}-${replyIndex}`;
    const newText = editReplyMap[key];
    if (!newText?.trim()) return;

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const updatedComments = (post.comments || []).map((c, i) => {
      if (i !== commentIndex) return c;
      const replies = (c.replies || []).map((r, j) => (j === replyIndex ? { ...r, text: newText } : r));
      return { ...c, replies };
    });

    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p)));

    // clear editing state
    setEditReplyMap((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setEditingReplyIndexMap((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  /* ---------- Emoji helpers ---------- */

  const addEmoji = (key, emoji) => {
    setCommentMap((prev) => ({ ...prev, [key]: (prev[key] || '') + emoji.emoji }));
    setShowEmojiPicker((prev) => ({ ...prev, [key]: false }));
  };

  const addReplyEmoji = (key, emoji) => {
    setCommentMap((prev) => ({ ...prev, [key]: (prev[key] || '') + emoji.emoji }));
    setShowReplyEmojiPicker((prev) => ({ ...prev, [key]: false }));
  };

  /* ---------- Render ---------- */

  return (
    <div className="max-w-xl mx-auto mt-10">
      {posts.map((post) => (
        <div key={post.id} className="border p-4 rounded mb-4 bg-white shadow-sm">
          <div className="flex justify-between">
            <p className="font-bold text-gray-800">
              {post.author}
              {post.isAdmin && (
                <span className="ml-2 px-1 bg-red-200 text-red-800 text-xs rounded">Admin</span>
              )}
              {post.isModerator && (
                <span className="ml-2 px-1 bg-blue-200 text-blue-800 text-xs rounded">Moderator</span>
              )}
            </p>

            {(post.uid === user.uid || user.isAdmin || user.isModerator) && (
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
              <button onClick={() => handleEditPost(post.id)} className="text-sm text-green-600 mt-1">
                Save
              </button>
            </div>
          ) : (
            <>
              <p className="text-gray-700 mb-2">{post.content}</p>
              {post.createdAt && (
                <p className="text-xs text-gray-500 mb-2">
                  {formatDistanceToNow(new Date(getTime(post.createdAt)), { addSuffix: true })}
                </p>
              )}
            </>
          )}

          <button onClick={() => handleLike(post.id)} className="text-blue-500 text-sm mb-2">
            ❤️ Like ({post.likes?.length || 0})
          </button>

          {/* Comment Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Add a comment..."
              value={commentMap[post.id] || ''}
              onChange={(e) => setCommentMap({ ...commentMap, [post.id]: e.target.value })}
              className="border p-1 w-full rounded"
            />
            <button
              onClick={() => setShowEmojiPicker((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
              className="text-sm text-yellow-500 mt-1"
            >
              😊
            </button>
            {showEmojiPicker[post.id] && (
              <div className="absolute z-10 mt-2">
                <EmojiPicker onEmojiClick={(emojiData) => addEmoji(post.id, emojiData)} />
              </div>
            )}
          </div>
          <button onClick={() => handleComment(post.id)} className="text-sm text-green-600 mt-1">
            Comment
          </button>

          {/* Comments */}
          <div className="mt-4 space-y-2 border-t pt-2">
            {(post.comments || []).map((comment, i) => {
              const commentKey = `${post.id}-${i}`;
              return (
                <div key={i} className="bg-gray-50 p-2 rounded">
                  <div className="flex justify-between items-start">
                    <div className="w-full">
                      <p className="text-sm font-semibold text-gray-800">
                        {comment.author}
                        {comment.isAdmin && (
                          <span className="ml-2 px-1 bg-red-200 text-red-800 text-xs rounded">Admin</span>
                        )}
                        {comment.isModerator && (
                          <span className="ml-2 px-1 bg-blue-200 text-blue-800 text-xs rounded">Moderator</span>
                        )}
                      </p>

                      {/* Comment edit mode */}
                      {editCommentMap[commentKey] !== undefined ? (
                        <>
                          <textarea
                            className="w-full text-sm border rounded p-1 mt-1"
                            value={editCommentMap[commentKey]}
                            onChange={(e) =>
                              setEditCommentMap((prev) => ({ ...prev, [commentKey]: e.target.value }))
                            }
                          />
                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={() => handleEditComment(post.id, i)}
                              className="text-xs text-green-600"
                            >
                              Save
                            </button>
                            <button
                              onClick={() =>
                                setEditCommentMap((prev) => {
                                  const copy = { ...prev };
                                  delete copy[commentKey];
                                  return copy;
                                })
                              }
                              className="text-xs text-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-700">{comment.text}</p>
                      )}

                      <p className="text-xs text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(getTime(comment.createdAt)), { addSuffix: true })}
                      </p>

                      {/* Replies (already newest-first in state) */}
                      {(comment.replies || []).map((reply, j) => {
                        const replyKey = `${post.id}-${i}-${j}`;
                        return (
                          <div key={j} className="ml-4 mt-2 p-2 bg-gray-100 rounded">
                            <p className="text-sm font-semibold text-gray-800">
                              {reply.author}
                              {reply.isAdmin && (
                                <span className="ml-2 px-1 bg-red-200 text-red-800 text-xs rounded">Admin</span>
                              )}
                              {reply.isModerator && (
                                <span className="ml-2 px-1 bg-blue-200 text-blue-800 text-xs rounded">Moderator</span>
                              )}
                            </p>

                            {editingReplyIndexMap[replyKey] ? (
                              <>
                                <textarea
                                  className="w-full text-sm border rounded p-1 mt-1"
                                  value={editReplyMap[replyKey] || ''}
                                  onChange={(e) =>
                                    setEditReplyMap((prev) => ({ ...prev, [replyKey]: e.target.value }))
                                  }
                                />
                                <div className="flex gap-2 mt-1">
                                  <button
                                    onClick={() => handleEditReply(post.id, i, j)}
                                    className="text-xs text-green-600"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() =>
                                      setEditingReplyIndexMap((prev) => {
                                        const copy = { ...prev };
                                        delete copy[replyKey];
                                        return copy;
                                      })
                                    }
                                    className="text-xs text-gray-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </>
                            ) : (
                              <p className="text-sm text-gray-700">{reply.text}</p>
                            )}

                            <p className="text-xs text-gray-500 mt-1">
                              {formatDistanceToNow(new Date(getTime(reply.createdAt)), { addSuffix: true })}
                            </p>

                            {/* Reply edit/delete options for reply owner */}
                            {reply.uid === user.uid && !editingReplyIndexMap[replyKey] && (
                              <div className="flex space-x-2 mt-1">
                                <button
                                  onClick={() =>
                                    setEditingReplyIndexMap((prev) => ({ ...prev, [replyKey]: true })) ||
                                    setEditReplyMap((prev) => ({ ...prev, [replyKey]: reply.text }))
                                  }
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteReply(post.id, i, j)}
                                  className="text-xs text-red-500 hover:underline"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Reply Input */}
                      <div className="relative mt-2">
                        <input
                          type="text"
                          placeholder="Reply..."
                          value={commentMap[`${post.id}-reply-${i}`] || ''}
                          onChange={(e) =>
                            setCommentMap((prev) => ({ ...prev, [`${post.id}-reply-${i}`]: e.target.value }))
                          }
                          className="border p-1 w-full rounded"
                        />
                        <button
                          onClick={() =>
                            setShowReplyEmojiPicker((prev) => ({
                              ...prev,
                              [`${post.id}-reply-${i}`]: !prev[`${post.id}-reply-${i}`]
                            }))
                          }
                          className="text-sm text-yellow-500 mt-1"
                        >
                          😊
                        </button>
                        {showReplyEmojiPicker[`${post.id}-reply-${i}`] && (
                          <div className="absolute z-10 mt-2">
                            <EmojiPicker onEmojiClick={(emojiData) => addReplyEmoji(`${post.id}-reply-${i}`, emojiData)} />
                          </div>
                        )}
                      </div>
                      <button onClick={() => handleReply(post.id, i)} className="text-xs text-green-600 mt-1">
                        Reply
                      </button>
                    </div>

                    {/* Comment owner controls */}
                    {comment.uid === user.uid && editCommentMap[commentKey] === undefined && (
                      <div className="space-x-2 ml-2">
                        <button
                          onClick={() => setEditCommentMap((prev) => ({ ...prev, [commentKey]: comment.text }))}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button onClick={() => handleDeleteComment(post.id, i)} className="text-xs text-red-500 hover:underline">
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}