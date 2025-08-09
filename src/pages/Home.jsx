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
  const [editMap, setEditMap] = useState({});
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedContent, setEditedContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState({});
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

  // ✅ Like a post
  const handleLike = async (id) => {
    const postRef = doc(db, 'posts', id);
    const post = posts.find((p) => p.id === id);
    const likes = new Set(post.likes || []);
    likes.add(user.uid);
    await updateDoc(postRef, { likes: Array.from(likes) });
  };

  // ✅ Update comments recursively in Firestore
  const updateCommentsAtPath = (comments, path, newComment) => {
    if (path.length === 0) {
      return [...comments, newComment];
    }
    const [index, ...rest] = path;
    return comments.map((c, i) =>
      i === index
        ? { ...c, replies: updateCommentsAtPath(c.replies || [], rest, newComment) }
        : c
    );
  };

  // ✅ Add reply (handles comments and replies-to-replies)
  const handleReply = async (postId, path) => {
    const key = `${postId}-${path.join('-')}`;
    const text = commentMap[key];
    if (!text?.trim()) return;

    const post = posts.find((p) => p.id === postId);
    const newReply = {
      text,
      author: user.displayName || user.email || 'Unknown User',
      uid: user.uid,
      role: user.role || 'user',
      createdAt: new Date().toISOString(),
      replies: []
    };

    const updatedComments = updateCommentsAtPath(post.comments || [], path, newReply);
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });

    setCommentMap((prev) => ({ ...prev, [key]: '' }));
  };

  // ✅ Add comment (top-level only)
  const handleComment = async (postId) => {
    const text = commentMap[postId];
    if (!text?.trim()) return;
    const post = posts.find((p) => p.id === postId);
    const newComment = {
      text,
      author: user.displayName || user.email || 'Unknown User',
      uid: user.uid,
      role: user.role || 'user',
      createdAt: new Date().toISOString(),
      replies: []
    };
    await updateDoc(doc(db, 'posts', postId), {
      comments: [...(post.comments || []), newComment]
    });
    setCommentMap((prev) => ({ ...prev, [postId]: '' }));
  };

  // ✅ Recursive delete
  const deleteAtPath = (comments, path) => {
    if (path.length === 1) {
      const newComments = [...comments];
      newComments.splice(path[0], 1);
      return newComments;
    }
    const [index, ...rest] = path;
    return comments.map((c, i) =>
      i === index
        ? { ...c, replies: deleteAtPath(c.replies || [], rest) }
        : c
    );
  };

  const handleDelete = async (postId, path) => {
    const post = posts.find((p) => p.id === postId);
    const updatedComments = deleteAtPath(post.comments || [], path);
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
  };

  // ✅ Recursive edit
  const editAtPath = (comments, path, newText) => {
    if (path.length === 1) {
      return comments.map((c, i) =>
        i === path[0] ? { ...c, text: newText } : c
      );
    }
    const [index, ...rest] = path;
    return comments.map((c, i) =>
      i === index
        ? { ...c, replies: editAtPath(c.replies || [], rest, newText) }
        : c
    );
  };

  const handleEdit = async (postId, path) => {
    const key = `${postId}-${path.join('-')}`;
    const text = editMap[key];
    if (!text?.trim()) return;

    const post = posts.find((p) => p.id === postId);
    const updatedComments = editAtPath(post.comments || [], path, text);
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });

    setEditMap((prev) => ({ ...prev, [key]: '' }));
  };

  // ✅ Edit post
  const handleEditPost = async (postId) => {
    await updateDoc(doc(db, 'posts', postId), { content: editedContent });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, content: editedContent } : p
      )
    );
    setEditingPostId(null);
    setEditedContent('');
  };

  // ✅ Emoji helpers
  const addEmoji = (key, emoji) => {
    setCommentMap((prev) => ({
      ...prev,
      [key]: (prev[key] || '') + emoji.emoji
    }));
    setShowEmojiPicker((prev) => ({ ...prev, [key]: false }));
  };

  // 🔹 Recursive render
  const renderReplies = (replies, postId, path) => {
    return replies.map((reply, index) => {
      const currentPath = [...path, index];
      const key = `${postId}-${currentPath.join('-')}`;
      return (
        <div key={key} className="ml-4 mt-2 p-2 bg-gray-100 rounded">
          <p className="text-sm font-semibold text-gray-800">
            {reply.author || usersMap[reply.uid]?.displayName || 'Unknown User'}
            {usersMap[reply.uid]?.isAdmin && (
              <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded">Admin</span>
            )}
            {usersMap[reply.uid]?.isModerator && (
              <span className="ml-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">Moderator</span>
            )}
          </p>
          <p className="text-sm text-gray-700">{reply.text}</p>
          <p className="text-xs text-gray-500 mt-1">{safeFormatDate(reply.createdAt)}</p>

          {/* Reply input */}
          <div className="mt-2">
            <input
              type="text"
              placeholder="Reply..."
              value={commentMap[key] || ''}
              onChange={(e) => setCommentMap({ ...commentMap, [key]: e.target.value })}
              className="border p-1 w-full rounded text-sm"
            />
            <button
              onClick={() =>
                setShowEmojiPicker((prev) => ({ ...prev, [key]: !prev[key] }))
              }
              className="text-xs text-yellow-500 mt-1"
            >
              😊
            </button>
            {showEmojiPicker[key] && (
              <div className="absolute z-10 mt-2">
                <EmojiPicker onEmojiClick={(e) => addEmoji(key, e)} />
              </div>
            )}
            <button
              onClick={() => handleReply(postId, currentPath)}
              className="text-xs text-green-600 mt-1 ml-2"
            >
              Reply
            </button>
            <button
              onClick={() => handleDelete(postId, currentPath)}
              className="text-xs text-red-500 ml-2"
            >
              Delete
            </button>
            <button
              onClick={() => handleEdit(postId, currentPath)}
              className="text-xs text-blue-500 ml-2"
            >
              Edit
            </button>
            <input
              type="text"
              placeholder="Edit reply..."
              value={editMap[key] || ''}
              onChange={(e) => setEditMap({ ...editMap, [key]: e.target.value })}
              className="border p-1 w-full rounded text-sm mt-1"
            />
          </div>

          {renderReplies(reply.replies || [], postId, currentPath)}
        </div>
      );
    });
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
                {usersMap[post.uid]?.isAdmin && (
                  <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded">Admin</span>
                )}
                {usersMap[post.uid]?.isModerator && (
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
                    onClick={() => deleteDoc(doc(db, 'posts', post.id))}
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
              {(post.comments || []).map((comment, i) => {
                const path = [i];
                const key = `${post.id}-${i}`;
                return (
                  <div key={i} className="bg-gray-50 p-2 rounded">
                    <p className="text-sm font-semibold text-gray-800">
                      {comment.author || usersMap[comment.uid]?.displayName || 'Unknown User'}
                      {usersMap[comment.uid]?.isAdmin && (
                        <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded">Admin</span>
                      )}
                      {usersMap[comment.uid]?.isModerator && (
                        <span className="ml-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">Moderator</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-700">{comment.text}</p>
                    <p className="text-xs text-gray-500 mt-1">{safeFormatDate(comment.createdAt)}</p>

                    {/* Reply input */}
                    <div className="mt-2 ml-4">
                      <input
                        type="text"
                        placeholder="Reply..."
                        value={commentMap[key] || ''}
                        onChange={(e) =>
                          setCommentMap({ ...commentMap, [key]: e.target.value })
                        }
                        className="border p-1 w-full rounded text-sm"
                      />
                      <button
                        onClick={() =>
                          setShowEmojiPicker((prev) => ({
                            ...prev,
                            [key]: !prev[key]
                          }))
                        }
                        className="text-xs text-yellow-500 mt-1"
                      >
                        😊
                      </button>
                      {showEmojiPicker[key] && (
                        <div className="absolute z-10 mt-2">
                          <EmojiPicker onEmojiClick={(e) => addEmoji(key, e)} />
                        </div>
                      )}
                      <button
                        onClick={() => handleReply(post.id, path)}
                        className="text-xs text-green-600 mt-1 ml-2"
                      >
                        Reply
                      </button>
                      <button
                        onClick={() => handleDelete(post.id, path)}
                        className="text-xs text-red-500 ml-2"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => handleEdit(post.id, path)}
                        className="text-xs text-blue-500 ml-2"
                      >
                        Edit
                      </button>
                      <input
                        type="text"
                        placeholder="Edit comment..."
                        value={editMap[key] || ''}
                        onChange={(e) => setEditMap({ ...editMap, [key]: e.target.value })}
                        className="border p-1 w-full rounded text-sm mt-1"
                      />
                    </div>

                    {renderReplies(comment.replies || [], post.id, path)}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}