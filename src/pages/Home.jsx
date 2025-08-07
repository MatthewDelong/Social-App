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
              {(post.uid === user.uid || user.role === 'admin' || user.role === 'moderator') && (
  <div className="space-x-2">
    {/* Edit/Delete buttons go here */}
  </div>
)}
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
                <p className="text-xs text-gray-500 mb-2">
                  {formatDistanceToNow(
                    post.createdAt.seconds
                      ? new Date(post.createdAt.seconds * 1000)
                      : new Date(post.createdAt),
                    { addSuffix: true }
                  )}
                </p>
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
                    <p className="text-sm font-semibold text-gray-800">{comment.author}</p>
                    {comment.uid === user.uid && editCommentMap[`${post.id}-${i}`] !== undefined ? (
                      <>
                        <textarea
                          className="w-full text-sm border rounded p-1 mt-1"
                          value={editCommentMap[`${post.id}-${i}`]}
                          onChange={(e) =>
                            setEditCommentMap({
                              ...editCommentMap,
                              [`${post.id}-${i}`]: e.target.value
                            })
                          }
                        />
                        <button
                          onClick={() => handleEditComment(post.id, i)}
                          className="text-xs text-green-600 mt-1"
                        >
                          Save
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-gray-700">{comment.text}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </p>

                    {/* Replies */}
                    {(comment.replies || []).map((reply, j) => {
                      const key = `${post.id}-${i}-${j}`;
                      return (
                        <div key={j} className="ml-4 mt-2 p-2 bg-gray-100 rounded">
                          <p className="text-sm font-semibold text-gray-800">{reply.author}</p>
                          {editingReplyIndexMap[key] ? (
                            <>
                              <textarea
                                className="w-full text-sm border rounded p-1 mt-1"
                                value={editReplyMap[key]}
                                onChange={(e) =>
                                  setEditReplyMap({
                                    ...editReplyMap,
                                    [key]: e.target.value
                                  })
                                }
                              />
                              <button
                                onClick={() => handleEditReply(post.id, i, j)}
                                className="text-xs text-green-600 mt-1"
                              >
                                Save
                              </button>
                            </>
                          ) : (
                            <p className="text-sm text-gray-700">{reply.text}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                          </p>

                          {reply.uid === user.uid && (
                            <div className="flex space-x-2 mt-1">
                              <button
                                onClick={() =>
                                  setEditingReplyIndexMap((prev) => ({
                                    ...prev,
                                    [key]: true
                                  }))
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
                          setCommentMap({
                            ...commentMap,
                            [`${post.id}-reply-${i}`]: e.target.value
                          })
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
                          <EmojiPicker
                            onEmojiClick={(e) =>
                              addReplyEmoji(`${post.id}-reply-${i}`, e)
                            }
                          />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleReply(post.id, i)}
                      className="text-xs text-green-600 mt-1"
                    >
                      Reply
                    </button>
                  </div>

                  {comment.uid === user.uid && (
                    <div className="space-x-2 ml-2">
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
                        onClick={() => handleDeleteComment(post.id, i)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
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