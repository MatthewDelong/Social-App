import { useParams, useNavigate, Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import GroupComments from "../components/groups/GroupComments";
import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, storage } from "../firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { formatDistanceToNow } from "date-fns";

export default function GroupPostPage() {
  const { groupId// src/pages/Home.jsx
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
  const [showReplies, setShowReplies] = useState({});
  const [showCommentInputs, setShowCommentInputs] = useState({});
  const [showReplyInputs, setShowReplyInputs] = useState({});
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
    await updateDoc(postRef, { comments: updatedComments });
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, comments: updatedComments } : p))
    );
    setCommentMap((prev) => ({ ...prev, [id]: '' }));
    setShowCommentInputs((prev) => ({ ...prev, [id]: false }));
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
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
    setCommentMap((prev) => ({ ...prev, [replyKey]: '' }));
    setShowReplyInputs((prev) => ({ ...prev, [`${postId}-${commentIndex}`]: false }));
  };

  const handleDeleteComment = async (postId, index) => {
    const post = posts.find((p) => p.id === postId);
    if (!post?.comments) return;
    const updatedComments = [...post.comments];
    updatedComments.splice(index, 1);
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
  };

  const handleEditComment = async (postId, index) => {
    const newText = editCommentMap[`${postId}-${index}`];
    if (!newText?.trim()) return;
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    updatedComments[index].text = newText;
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
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
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
  };

  const handleEditReply = async (postId, commentIndex, replyIndex) => {
    const key = `${postId}-${commentIndex}-${replyIndex}`;

    setPosts((prevPosts) =>
      prevPosts.map((p) => {
        if (p.id !== postId) return p;

        const updatedComments = p.comments.map((comment, ci) => {
          if (ci !== commentIndex) return comment;

          const updatedReplies = comment.replies.map((reply, ri) => {
            if (ri !== replyIndex) return reply;
            return { ...reply, text: editReplyMap[key] };
          });

          return { ...comment, replies: updatedReplies };
        });

        return { ...p, comments: updatedComments };
      })
    );

    await updateDoc(doc(db, "posts", postId), {
      comments: posts.find((p) => p.id === postId)?.comments.map((comment, ci) =>
        ci === commentIndex
          ? {
              ...comment,
              replies: comment.replies.map((reply, ri) =>
                ri === replyIndex
                  ? { ...reply, text: editReplyMap[key] }
                  : reply
              ),
            }
          : comment
      ),
    });

    setEditingReplyIndexMap((prev) => ({ ...prev, [key]: false }));
    setEditReplyMap((prev) => ({ ...prev, [key]: "" }));
  };

  const toggleShowReplies = (postId, commentIndex) => {
    const key = `${postId}-${commentIndex}`;
    setShowReplies(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleCommentInput = (postId) => {
    setShowCommentInputs(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  const toggleReplyInput = (postId, commentIndex) => {
    const key = `${postId}-${commentIndex}`;
    setShowReplyInputs(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

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
              <button
                onClick={() => toggleCommentInput(post.id)}
                className="text-xs text-blue-600 hover:underline"
              >
                Comment
              </button>
            </div>

            {/* Comment Input */}
            {showCommentInputs[post.id] && (
              <div className="mt-4 flex items-start space-x-2">
                <img
                  src={user?.photoURL || DEFAULT_AVATAR}
                  alt="avatar"
                  className="w-6 h-6 rounded-full object-cover"
                />
                <div className="flex-1 relative">
                  <textarea
                    placeholder="Write a comment..."
                    value={commentMap[post.id] || ''}
                    onChange={(e) =>
                      setCommentMap((prev) => ({
                        ...prev,
                        [post.id]: e.target.value
                      }))
                    }
                    className="border p-2 w-full rounded text-sm"
                    rows="2"
                  />
                  <div className="flex justify-between mt-1">
                    <button
                      onClick={() => 
                        setShowEmojiPicker(prev => ({
                          ...prev,
                          [post.id]: !prev[post.id]
                        }))
                      }
                      className="text-xs bg-gray-200 px-2 py-1 rounded"
                    >
                      😀
                    </button>
                    <div className="space-x-2">
                      <button
                        onClick={() => toggleCommentInput(post.id)}
                        className="text-xs bg-gray-400 text-white px-3 py-1 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleComment(post.id)}
                        className="text-xs bg-blue-500 text-white px-3 py-1 rounded"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                  {showEmojiPicker[post.id] && (
                    <div className="absolute bottom-10 left-0 z-10">
                      <div className="relative">
                        <button
                          onClick={() => setShowEmojiPicker(prev => ({...prev, [post.id]: false}))}
                          className="absolute -top-3 -right-3 z-10 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                        >
                          X
                        </button>
                        <EmojiPicker
                          width={300}
                          height={350}
                          onEmojiClick={(emoji) => addEmoji(post.id, emoji)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Comments List */}
            <div className="mt-4 space-y-4">
              {(post.comments || []).map((comment, i) => {
                const commentUser = usersMap[comment.uid];
                const commentAvatar = commentUser?.photoURL || DEFAULT_AVATAR;
                const replyKey = `${post.id}-${i}`;
                const hasReplies = comment.replies && comment.replies.length > 0;
                const isShowingReplies = showReplies[replyKey];
                const isShowingReplyInput = showReplyInputs[replyKey];
                
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

                        <div className="flex space-x-2 mt-1 text-xs">
                          {comment.uid === user.uid &&
                            editCommentMap[`${post.id}-${i}`] === undefined && (
                              <>
                                <button
                                  onClick={() =>
                                    setEditCommentMap((prev) => ({
                                      ...prev,
                                      [`${post.id}-${i}`]: comment.text
                                    }))
                                  }
                                  className="text-blue-600 hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteComment(post.id, i)
                                  }
                                  className="text-red-500 hover:underline"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          <button
                            onClick={() => toggleReplyInput(post.id, i)}
                            className="text-blue-600 hover:underline"
                          >
                            Reply
                          </button>
                          {hasReplies && (
                            <button
                              onClick={() => toggleShowReplies(post.id, i)}
                              className="text-blue-600 hover:underline"
                            >
                              {isShowingReplies ? 'Hide replies' : `View replies (${comment.replies.length})`}
                            </button>
                          )}
                        </div>

                        {/* Reply Input */}
                        {isShowingReplyInput && (
                          <div className="ml-4 mt-2 flex items-start space-x-2">
                            <img
                              src={user?.photoURL || DEFAULT_AVATAR}
                              alt="avatar"
                              className="w-5 h-5 rounded-full object-cover"
                            />
                            <div className="flex-1 relative">
                              <textarea
                                placeholder="Write a reply..."
                                value={commentMap[`${post.id}-reply-${i}`] || ''}
                                onChange={(e) =>
                                  setCommentMap((prev) => ({
                                    ...prev,
                                    [`${post.id}-reply-${i}`]: e.target.value
                                  }))
                                }
                                className="border p-1 w-full rounded text-sm"
                              />
                              <div className="flex justify-between mt-1">
                                <button
                                  onClick={() => 
                                    setShowReplyEmojiPicker(prev => ({
                                      ...prev,
                                      [`${post.id}-reply-${i}`]: !prev[`${post.id}-reply-${i}`]
                                    }))
                                  }
                                  className="text-xs bg-gray-200 px-2 py-0.5 rounded"
                                >
                                  😀
                                </button>
                                <div className="space-x-2">
                                  <button
                                    onClick={() => toggleReplyInput(post.id, i)}
                                    className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleReply(post.id, i)}
                                    className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded"
                                  >
                                    Post
                                  </button>
                                </div>
                              </div>
                              {showReplyEmojiPicker[`${post.id}-reply-${i}`] && (
                                <div className="absolute bottom-10 left-0 z-10">
                                  <div className="relative">
                                    <button
                                      onClick={() => setShowReplyEmojiPicker(prev => ({
                                        ...prev,
                                        [`${post.id}-reply-${i}`]: false
                                      }))}
                                      className="absolute -top-3 -right-3 z-10 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                                    >
                                      X
                                    </button>
                                    <EmojiPicker
                                      width={300}
                                      height={350}
                                      onEmojiClick={(emoji) => addReplyEmoji(`${post.id}-reply-${i}`, emoji)}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Replies Section */}
                        {isShowingReplies && (
                          <div className="ml-4 mt-2 space-y-2">
                            {(comment.replies || []).map((reply, ri) => {
                              const replyUser = usersMap[reply.uid];
                              const replyAvatar = replyUser?.photoURL || DEFAULT_AVATAR;
                              const replyEditKey = `${post.id}-${i}-${ri}`;
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
                                        className="font-semibold text-gray-800 cursor-pointer text-sm"
                                        onClick={() => goToProfile(reply.uid)}
                                      >
                                        {replyUser?.displayName || reply.author}
                                        {replyUser?.isAdmin && (
                                          <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-1 py-0.5 rounded">Admin</span>
                                        )}
                                        {replyUser?.isModerator && (
                                          <span className="ml-2 bg-green-100 text-green-800 text-xs px-1 py-0.5 rounded">Moderator</span>
                                        )}
                                      </p>
                                      <span className="text-xs text-gray-500">
                                        {safeFormatDate(reply.createdAt)}
                                      </span>
                                    </div>

                                    {editingReplyIndexMap[replyEditKey] ? (
                                      <div>
                                        <textarea
                                          value={editReplyMap[replyEditKey]}
                                          onChange={(e) =>
                                            setEditReplyMap((prev) => ({
                                              ...prev,
                                              [replyEditKey]: e.target.value
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
                                      <p className="text-gray-900 text-sm">{reply.text}</p>
                                    )}

                                    {reply.uid === user.uid &&
                                      !editingReplyIndexMap[replyEditKey] && (
                                        <div className="space-x-2 mt-1 text-xs">
                                          <button
                                            onClick={() => {
                                              setEditingReplyIndexMap((prev) => ({
                                                ...prev,
                                                [replyEditKey]: true
                                              }));
                                              setEditReplyMap((prev) => ({
                                                ...prev,
                                                [replyEditKey]: reply.text
                                              }));
                                            }}
                                            className="text-blue-600 hover:underline"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() =>
                                              handleDeleteReply(post.id, i, ri)
                                            }
                                            className="text-red-500 hover:underline"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}src/pages/Home.jsx
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
  const [showReplies, setShowReplies] = useState({});
  const [showCommentInputs, setShowCommentInputs] = useState({});
  const [showReplyInputs, setShowReplyInputs] = useState({});
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
    await updateDoc(postRef, { comments: updatedComments });
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, comments: updatedComments } : p))
    );
    setCommentMap((prev) => ({ ...prev, [id]: '' }));
    setShowCommentInputs((prev) => ({ ...prev, [id]: false }));
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
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
    setCommentMap((prev) => ({ ...prev, [replyKey]: '' }));
    setShowReplyInputs((prev) => ({ ...prev, [`${postId}-${commentIndex}`]: false }));
  };

  const handleDeleteComment = async (postId, index) => {
    const post = posts.find((p) => p.id === postId);
    if (!post?.comments) return;
    const updatedComments = [...post.comments];
    updatedComments.splice(index, 1);
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
  };

  const handleEditComment = async (postId, index) => {
    const newText = editCommentMap[`${postId}-${index}`];
    if (!newText?.trim()) return;
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    updatedComments[index].text = newText;
    await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
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
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
  };

  const handleEditReply = async (postId, commentIndex, replyIndex) => {
    const key = `${postId}-${commentIndex}-${replyIndex}`;

    setPosts((prevPosts) =>
      prevPosts.map((p) => {
        if (p.id !== postId) return p;

        const updatedComments = p.comments.map((comment, ci) => {
          if (ci !== commentIndex) return comment;

          const updatedReplies = comment.replies.map((reply, ri) => {
            if (ri !== replyIndex) return reply;
            return { ...reply, text: editReplyMap[key] };
          });

          return { ...comment, replies: updatedReplies };
        });

        return { ...p, comments: updatedComments };
      })
    );

    await updateDoc(doc(db, "posts", postId), {
      comments: posts.find((p) => p.id === postId)?.comments.map((comment, ci) =>
        ci === commentIndex
          ? {
              ...comment,
              replies: comment.replies.map((reply, ri) =>
                ri === replyIndex
                  ? { ...reply, text: editReplyMap[key] }
                  : reply
              ),
            }
          : comment
      ),
    });

    setEditingReplyIndexMap((prev) => ({ ...prev, [key]: false }));
    setEditReplyMap((prev) => ({ ...prev, [key]: "" }));
  };

  const toggleShowReplies = (postId, commentIndex) => {
    const key = `${postId}-${commentIndex}`;
    setShowReplies(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleCommentInput = (postId) => {
    setShowCommentInputs(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  const toggleReplyInput = (postId, commentIndex) => {
    const key = `${postId}-${commentIndex}`;
    setShowReplyInputs(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

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
              <button
                onClick={() => toggleCommentInput(post.id)}
                className="text-xs text-blue-600 hover:underline"
              >
                Comment
              </button>
            </div>

            {/* Comment Input */}
            {showCommentInputs[post.id] && (
              <div className="mt-4 flex items-start space-x-2">
                <img
                  src={user?.photoURL || DEFAULT_AVATAR}
                  alt="avatar"
                  className="w-6 h-6 rounded-full object-cover"
                />
                <div className="flex-1 relative">
                  <textarea
                    placeholder="Write a comment..."
                    value={commentMap[post.id] || ''}
                    onChange={(e) =>
                      setCommentMap((prev) => ({
                        ...prev,
                        [post.id]: e.target.value
                      }))
                    }
                    className="border p-2 w-full rounded text-sm"
                    rows="2"
                  />
                  <div className="flex justify-between mt-1">
                    <button
                      onClick={() => 
                        setShowEmojiPicker(prev => ({
                          ...prev,
                          [post.id]: !prev[post.id]
                        }))
                      }
                      className="text-xs bg-gray-200 px-2 py-1 rounded"
                    >
                      😀
                    </button>
                    <div className="space-x-2">
                      <button
                        onClick={() => toggleCommentInput(post.id)}
                        className="text-xs bg-gray-400 text-white px-3 py-1 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleComment(post.id)}
                        className="text-xs bg-blue-500 text-white px-3 py-1 rounded"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                  {showEmojiPicker[post.id] && (
                    <div className="absolute bottom-10 left-0 z-10">
                      <div className="relative">
                        <button
                          onClick={() => setShowEmojiPicker(prev => ({...prev, [post.id]: false}))}
                          className="absolute -top-3 -right-3 z-10 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                        >
                          X
                        </button>
                        <EmojiPicker
                          width={300}
                          height={350}
                          onEmojiClick={(emoji) => addEmoji(post.id, emoji)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Comments List */}
            <div className="mt-4 space-y-4">
              {(post.comments || []).map((comment, i) => {
                const commentUser = usersMap[comment.uid];
                const commentAvatar = commentUser?.photoURL || DEFAULT_AVATAR;
                const replyKey = `${post.id}-${i}`;
                const hasReplies = comment.replies && comment.replies.length > 0;
                const isShowingReplies = showReplies[replyKey];
                const isShowingReplyInput = showReplyInputs[replyKey];
                
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

                        <div className="flex space-x-2 mt-1 text-xs">
                          {comment.uid === user.uid &&
                            editCommentMap[`${post.id}-${i}`] === undefined && (
                              <>
                                <button
                                  onClick={() =>
                                    setEditCommentMap((prev) => ({
                                      ...prev,
                                      [`${post.id}-${i}`]: comment.text
                                    }))
                                  }
                                  className="text-blue-600 hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteComment(post.id, i)
                                  }
                                  className="text-red-500 hover:underline"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          <button
                            onClick={() => toggleReplyInput(post.id, i)}
                            className="text-blue-600 hover:underline"
                          >
                            Reply
                          </button>
                          {hasReplies && (
                            <button
                              onClick={() => toggleShowReplies(post.id, i)}
                              className="text-blue-600 hover:underline"
                            >
                              {isShowingReplies ? 'Hide replies' : `View replies (${comment.replies.length})`}
                            </button>
                          )}
                        </div>

                        {/* Reply Input */}
                        {isShowingReplyInput && (
                          <div className="ml-4 mt-2 flex items-start space-x-2">
                            <img
                              src={user?.photoURL || DEFAULT_AVATAR}
                              alt="avatar"
                              className="w-5 h-5 rounded-full object-cover"
                            />
                            <div className="flex-1 relative">
                              <textarea
                                placeholder="Write a reply..."
                                value={commentMap[`${post.id}-reply-${i}`] || ''}
                                onChange={(e) =>
                                  setCommentMap((prev) => ({
                                    ...prev,
                                    [`${post.id}-reply-${i}`]: e.target.value
                                  }))
                                }
                                className="border p-1 w-full rounded text-sm"
                              />
                              <div className="flex justify-between mt-1">
                                <button
                                  onClick={() => 
                                    setShowReplyEmojiPicker(prev => ({
                                      ...prev,
                                      [`${post.id}-reply-${i}`]: !prev[`${post.id}-reply-${i}`]
                                    }))
                                  }
                                  className="text-xs bg-gray-200 px-2 py-0.5 rounded"
                                >
                                  😀
                                </button>
                                <div className="space-x-2">
                                  <button
                                    onClick={() => toggleReplyInput(post.id, i)}
                                    className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleReply(post.id, i)}
                                    className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded"
                                  >
                                    Post
                                  </button>
                                </div>
                              </div>
                              {showReplyEmojiPicker[`${post.id}-reply-${i}`] && (
                                <div className="absolute bottom-10 left-0 z-10">
                                  <div className="relative">
                                    <button
                                      onClick={() => setShowReplyEmojiPicker(prev => ({
                                        ...prev,
                                        [`${post.id}-reply-${i}`]: false
                                      }))}
                                      className="absolute -top-3 -right-3 z-10 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                                    >
                                      X
                                    </button>
                                    <EmojiPicker
                                      width={300}
                                      height={350}
                                      onEmojiClick={(emoji) => addReplyEmoji(`${post.id}-reply-${i}`, emoji)}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Replies Section */}
                        {isShowingReplies && (
                          <div className="ml-4 mt-2 space-y-2">
                            {(comment.replies || []).map((reply, ri) => {
                              const replyUser = usersMap[reply.uid];
                              const replyAvatar = replyUser?.photoURL || DEFAULT_AVATAR;
                              const replyEditKey = `${post.id}-${i}-${ri}`;
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
                                        className="font-semibold text-gray-800 cursor-pointer text-sm"
                                        onClick={() => goToProfile(reply.uid)}
                                      >
                                        {replyUser?.displayName || reply.author}
                                        {replyUser?.isAdmin && (
                                          <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-1 py-0.5 rounded">Admin</span>
                                        )}
                                        {replyUser?.isModerator && (
                                          <span className="ml-2 bg-green-100 text-green-800 text-xs px-1 py-0.5 rounded">Moderator</span>
                                        )}
                                      </p>
                                      <span className="text-xs text-gray-500">
                                        {safeFormatDate(reply.createdAt)}
                                      </span>
                                    </div>

                                    {editingReplyIndexMap[replyEditKey] ? (
                                      <div>
                                        <textarea
                                          value={editReplyMap[replyEditKey]}
                                          onChange={(e) =>
                                            setEditReplyMap((prev) => ({
                                              ...prev,
                                              [replyEditKey]: e.target.value
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
                                      <p className="text-gray-900 text-sm">{reply.text}</p>
                                    )}

                                    {reply.uid === user.uid &&
                                      !editingReplyIndexMap[replyEditKey] && (
                                        <div className="space-x-2 mt-1 text-xs">
                                          <button
                                            onClick={() => {
                                              setEditingReplyIndexMap((prev) => ({
                                                ...prev,
                                                [replyEditKey]: true
                                              }));
                                              setEditReplyMap((prev) => ({
                                                ...prev,
                                                [replyEditKey]: reply.text
                                              }));
                                            }}
                                            className="text-blue-600 hover:underline"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() =>
                                              handleDeleteReply(post.id, i, ri)
                                            }
                                            className="text-red-500 hover:underline"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
} } = useParams();
  const { user } = useAppContext();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");
  const [DEFAULT_BANNER, setDEFAULT_BANNER] = useState("");
  const [DEFAULT_LOGO, setDEFAULT_LOGO] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  const isAdminOrMod = user?.isAdmin || user?.isModerator;

  // Load default images from storage
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const avatarRef = ref(storage, "default-avatar.png");
        const bannerRef = ref(storage, "default-banner.jpg");
        const logoRef = ref(storage, "default-group-logo.png");

        setDEFAULT_AVATAR(await getDownloadURL(avatarRef));
        setDEFAULT_BANNER(await getDownloadURL(bannerRef));
        setDEFAULT_LOGO(await getDownloadURL(logoRef));
      } catch (err) {
        console.error("Error loading default images:", err);
      }
    };
    loadDefaults();
  }, []);

  // Fetch post and group data from Firestore
  useEffect(() => {
    const fetchData = async () => {
      // Fetch post
      const postDoc = await getDoc(doc(db, "groupPosts", postId));
      if (postDoc.exists()) {
        let data = { id: postDoc.id, ...postDoc.data() };

        // If no avatar stored, try fetching from users/{uid}
        if (!data.authorPhotoURL && data.uid) {
          const userDoc = await getDoc(doc(db, "users", data.uid));
          if (userDoc.exists()) {
            data.authorPhotoURL = userDoc.data().photoURL || "";
          }
        }

        setPost(data);
      }

      // Fetch group data for banner and logo
      if (groupId) {
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        if (groupDoc.exists()) {
          setGroup({ id: groupDoc.id, ...groupDoc.data() });
        }
      }

      setLoading(false);
    };
    fetchData();
  }, [postId, groupId]);

  if (loading) return <p className="p-4">Loading post...</p>;
  if (!post) return <p className="p-4">Post not found</p>;

  // Determine permissions
  const isOwner = user && post.uid === user.uid;
  const isAdmin = user?.isAdmin;
  const isModerator = user?.isModerator;
  const canEditOrDelete = isOwner || isAdmin || isModerator;

  // Format post date
  const formatPostDate = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true }).replace("about ", "");
    } catch (err) {
      console.error("Error formatting date:", err);
      return "";
    }
  };

  // Banner / logo uploader
  const handleImageUpload = async (type) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const storagePath = `groups/${groupId}/${type}-${Date.now()}.jpg`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        await updateDoc(doc(db, "groups", groupId), { [type]: url });
        setGroup((prev) => ({ ...prev, [type]: url }));
      } catch (err) {
        console.error(`Error uploading ${type}:`, err);
      }
    };
    fileInput.click();
  };

  // Handlers
  const startEdit = () => {
    setEditContent(post.content);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditContent("");
  };

  const saveEdit = async () => {
    if (!editContent.trim()) return;
    await updateDoc(doc(db, "groupPosts", post.id), {
      content: editContent.trim(),
      editedAt: new Date(),
    });
    setPost((prev) => ({ ...prev, content: editContent.trim() }));
    setIsEditing(false);
    setEditContent("");
  };

  const deletePost = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    await deleteDoc(doc(db, "groupPosts", post.id));
    navigate(-1); // Go back after deleting
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Group Banner & Logo */}
      {group && (
        <div className="relative">
          {/* Banner */}
          <div 
            className="w-full h-40 sm:h-56 md:h-64 overflow-hidden cursor-pointer relative group"
            onClick={() => isAdminOrMod && handleImageUpload("bannerURL")}
          >
            <img
              src={group.bannerURL || DEFAULT_BANNER}
              alt={`${group.name} banner`}
              className="w-full h-full object-cover"
            />
            {/* Camera icon for banner - only show for admins/mods */}
            {isAdminOrMod && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-20">
                <div className="w-12 h-12 rounded-full bg-gray-600 bg-opacity-70 flex items-center justify-center">
                  <svg 
                    className="w-6 h-6 text-white" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" 
                    />
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" 
                    />
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Logo overhang */}
          <div
            className="absolute -bottom-12 left-4 cursor-pointer group"
            onClick={() => isAdminOrMod && handleImageUpload("logoURL")}
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white overflow-hidden shadow-lg relative">
              <img
                src={group.logoURL || DEFAULT_LOGO}
                alt={`${group.name} logo`}
                className="w-full h-full object-cover"
              />
              {/* Camera icon for logo - only show for admins/mods */}
              {isAdminOrMod && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-20 rounded-full">
                  <div className="w-8 h-8 rounded-full bg-gray-600 bg-opacity-70 flex items-center justify-center">
                    <svg 
                      className="w-4 h-4 text-white" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" 
                      />
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" 
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mt-20 sm:mt-16 p-4">
        {/* Group name as link back to group */}
        {group && (
          <Link 
            to={`/groups/${groupId}`}
            className="text-2xl font-bold text-gray-800 hover:underline block mb-4"
          >
            {group.name}
          </Link>
        )}

        {/* Post author info */}
        <div className="flex items-center space-x-3 mb-4">
          <img
            src={post.authorPhotoURL || DEFAULT_AVATAR}
            alt={post.author}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
          <div className="flex-1">
            <h2 className="text-xl font-bold break-words">{post.author}</h2>
            {post.createdAt && (
              <p className="text-sm text-gray-500">
                {formatPostDate(post.createdAt)}
              </p>
            )}
          </div>
        </div>

        {/* Post content */}
        {isEditing ? (
          <div className="mb-4">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
              className="w-full p-2 border rounded resize-none break-words"
            />
            <div className="mt-2 space-x-2">
              <button
                onClick={saveEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-400 text-white rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mb-4 whitespace-pre-wrap break-words">{post.content}</p>
        )}

        {/* Edit/Delete buttons */}
        {canEditOrDelete && !isEditing && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={startEdit}
              className="text-xs bg-yellow-500 text-black-800 px-2 py-0.5 rounded"
            >
              Edit
            </button>
            <button
              onClick={deletePost}
              className="text-xs bg-red-500 text-black-800 px-2 py-0.5 rounded"
            >
              Delete
            </button>
          </div>
        )}

        {/* Comments section */}
        <GroupComments
          postId={postId}
          currentUser={user}
          isAdmin={isAdmin}
          isModerator={isModerator}
        />
      </div>
    </div>
  );
}