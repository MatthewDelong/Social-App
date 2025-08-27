import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAppContext } from "../context/AppContext";
import { formatDistanceToNow } from "date-fns";
import EmojiPicker from "emoji-picker-react";
import { useNavigate } from "react-router-dom";
import { ThumbsUp } from "lucide-react";

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [commentMap, setCommentMap] = useState({});
  const [editCommentMap, setEditCommentMap] = useState({});
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState({});
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState({});
  const [editReplyMap, setEditReplyMap] = useState({});
  const [editingReplyIndexMap, setEditingReplyIndexMap] = useState({});
  const [showReplyBoxMap, setShowReplyBoxMap] = useState({});
  const { user, theme } = useAppContext();
  const navigate = useNavigate();

  const DEFAULT_AVATAR =
    "https://firebasestorage.googleapis.com/v0/b/social-app-8a28d.firebasestorage.app/o/default-avatar.png?alt=media&token=78165d2b-f095-496c-9de2-5e143bfc41cc";

  const safeFormatDate = (dateValue) => {
    if (!dateValue) return "";
    try {
      let date;
      if (typeof dateValue.toDate === "function") {
        date = dateValue.toDate();
      } else if (dateValue?.seconds) {
        date = new Date(dateValue.seconds * 1000);
      } else {
        date = new Date(dateValue);
      }
      if (isNaN(date.getTime())) return "";
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "";
    }
  };
  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, "users"));
    const map = {};
    snap.forEach((d) => {
      map[d.id] = d.data();
    });
    setUsersMap(map);
  };

  useEffect(() => {
    fetchUsers();
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        likes: [],
        comments: [],
        ...d.data(),
      }));
      setPosts(docs);
    });
    return () => unsub();
  }, []);

  const handleEditPost = async (id) => {
    if (!editedContent.trim()) return;
    const postRef = doc(db, "posts", id);
    await updateDoc(postRef, { content: editedContent });
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, content: editedContent } : p))
    );
    setEditingPostId(null);
    setEditedContent("");
  };

  const handleLike = async (id) => {
    const postRef = doc(db, "posts", id);
    const post = posts.find((p) => p.id === id);
    const likes = new Set(post.likes || []);
    if (likes.has(user.uid)) likes.delete(user.uid);
    else likes.add(user.uid);
    await updateDoc(postRef, { likes: Array.from(likes) });
  };

  const handleComment = async (id) => {
    const comment = commentMap[id];
    if (!comment?.trim()) return;
    const post = posts.find((p) => p.id === id);
    const postRef = doc(db, "posts", id);
    const newComment = {
      text: comment,
      author: user.displayName || user.email || "Unknown User",
      uid: user.uid,
      role: user.role || "user",
      createdAt: new Date().toISOString(),
      replies: [],
      commentLikes: [],
    };
    const updatedComments = [...(post.comments || []), newComment];
    await updateDoc(postRef, { comments: updatedComments });
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, comments: updatedComments } : p))
    );
    setCommentMap((prev) => ({ ...prev, [id]: "" }));
  };

  const handleReply = async (postId, commentIndex, key) => {
    const replyText = commentMap[key];
    if (!replyText?.trim()) return;
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...(post.comments || [])];
    const newReply = {
      text: replyText,
      author: user.displayName || user.email || "Unknown User",
      uid: user.uid,
      role: user.role || "user",
      createdAt: new Date().toISOString(),
      replyLikes: [],
    };
    updatedComments[commentIndex].replies = [
      ...(updatedComments[commentIndex].replies || []),
      newReply,
    ];
    await updateDoc(doc(db, "posts", postId), { comments: updatedComments });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: updatedComments } : p
      )
    );
    setCommentMap((prev) => ({ ...prev, [key]: "" }));
    setShowReplyBoxMap((prev) => ({ ...prev, [key]: false }));
  };

  const handleDeleteComment = async (postId, index) => {
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    updatedComments.splice(index, 1);
    await updateDoc(doc(db, "posts", postId), { comments: updatedComments });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: updatedComments } : p
      )
    );
  };

  const handleEditComment = async (postId, index) => {
    const newText = editCommentMap[`${postId}-${index}`];
    if (!newText?.trim()) return;
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    updatedComments[index].text = newText;
    await updateDoc(doc(db, "posts", postId), { comments: updatedComments });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: updatedComments } : p
      )
    );
    setEditCommentMap((prev) => ({ ...prev, [`${postId}-${index}`]: "" }));
  };

  const handleDeleteReply = async (postId, commentIndex, replyIndex) => {
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    updatedComments[commentIndex].replies.splice(replyIndex, 1);
    await updateDoc(doc(db, "posts", postId), { comments: updatedComments });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: updatedComments } : p
      )
    );
  };

  const handleEditReply = async (postId, commentIndex, replyIndex) => {
    const key = `${postId}-${commentIndex}-${replyIndex}`;
    const updatedComments = [...posts.find((p) => p.id === postId).comments];
    updatedComments[commentIndex].replies[replyIndex].text = editReplyMap[key];
    await updateDoc(doc(db, "posts", postId), { comments: updatedComments });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: updatedComments } : p
      )
    );
    setEditingReplyIndexMap((prev) => ({ ...prev, [key]: false }));
    setEditReplyMap((prev) => ({ ...prev, [key]: "" }));
  };

  const handleLikeComment = async (postId, commentIndex) => {
    const post = posts.find((p) => p.id === postId);
    const updated = [...(post.comments || [])];
    const current = updated[commentIndex];
    const setLikes = new Set(current.commentLikes || []);
    if (setLikes.has(user.uid)) setLikes.delete(user.uid);
    else setLikes.add(user.uid);
    updated[commentIndex] = { ...current, commentLikes: Array.from(setLikes) };
    await updateDoc(doc(db, "posts", postId), { comments: updated });
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updated } : p))
    );
  };

  const handleLikeReply = async (postId, commentIndex, replyIndex) => {
    const post = posts.find((p) => p.id === postId);
    const updated = [...(post.comments || [])];
    const comment = updated[commentIndex];
    const replies = [...comment.replies];
    const r = replies[replyIndex];
    const setLikes = new Set(r.replyLikes || []);
    if (setLikes.has(user.uid)) setLikes.delete(user.uid);
    else setLikes.add(user.uid);
    replies[replyIndex] = { ...r, replyLikes: Array.from(setLikes) };
    updated[commentIndex] = { ...comment, replies };
    await updateDoc(doc(db, "posts", postId), { comments: updated });
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updated } : p))
    );
  };

  const addEmoji = (key, emoji) => {
    setCommentMap((prev) => ({
      ...prev,
      [key]: (prev[key] || "") + emoji.emoji,
    }));
    setShowEmojiPicker((prev) => ({ ...prev, [key]: false }));
  };

  const addReplyEmoji = (key, emoji) => {
    setCommentMap((prev) => ({
      ...prev,
      [key]: (prev[key] || "") + emoji.emoji,
    }));
    setShowReplyEmojiPicker((prev) => ({ ...prev, [key]: false }));
  };
  return (
    <div
      className="max-w-xl mx-auto mt-10"
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
    >
      {posts.map((post) => {
        const postUser = usersMap[post.uid];
        return (
          <div key={post.id} className="border p-4 rounded mb-4 shadow-sm ">
            {/* Post header */}
            <div className="flex justify-between">
              <div className="flex items-center space-x-2">
                <img
                  src={postUser?.photoURL || DEFAULT_AVATAR}
                  alt="avatar"
                  className="w-10 h-10 border border-2 rounded-full object-cover cursor-pointer"
                  onClick={() => navigate(`/profile/${post.uid}`)}
                />
                <div>
                  <p className="font-bold text-gray-800 flex items-center space-x-1">
                    <span>{postUser?.displayName || post.author}</span>
                    {postUser?.isAdmin && (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                    {postUser?.isModerator && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                        Mod
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {safeFormatDate(post.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Post content */}
            <div className="mt-2">
              {editingPostId === post.id ? (
                <div>
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="border p-2 w-full rounded"
                  />
                  <button
                    onClick={() => handleEditPost(post.id)}
                    className="mt-1 text-sm bg-blue-500 text-white px-3 py-1 rounded"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <p className="text-gray-800">{post.content}</p>
              )}
            </div>

            {/* Edit/Delete Buttons */}
            {(post.uid === user.uid ||
              user.role === "admin" ||
              user.role === "moderator") && (
              <div className="flex space-x-2 mt-3">
                <button
                  onClick={() => {
                    setEditingPostId(post.id);
                    setEditedContent(post.content);
                  }}
                  className="bg-yellow-400 text-black px-3 py-1 text-sm rounded font-semibold hover:bg-yellow-500"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteDoc(doc(db, "posts", post.id))}
                  className="bg-red-500 text-white px-3 py-1 text-sm rounded font-semibold hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            )}

            {/* Like Button */}
            <div className="flex items-center space-x-4 mt-3">
              <button
                onClick={() => handleLike(post.id)}
                className="text-sm inline-flex items-center space-x-1"
              >
                <ThumbsUp
                  size={16}
                  className={
                    post.likes?.includes(user.uid)
                      ? "text-blue-500"
                      : "text-gray-600"
                  }
                />
                <span
                  className={
                    post.likes?.includes(user.uid)
                      ? "text-blue-500 font-semibold"
                      : "text-gray-600"
                  }
                >
                  {post.likes?.includes(user.uid) ? "Liked" : "Like"}
                </span>
                <span className="text-gray-600">{post.likes?.length || 0}</span>
              </button>
            </div>

            {/* Comment box at top */}
            <div className="flex items-start space-x-2 mt-3 relative">
              <textarea
                placeholder="Write a comment..."
                value={commentMap[post.id] || ""}
                onChange={(e) =>
                  setCommentMap((prev) => ({
                    ...prev,
                    [post.id]: e.target.value,
                  }))
                }
                className="border p-1 flex-1 rounded"
              />
              <div className="flex flex-col space-y-1">
                <button
                  onClick={() => handleComment(post.id)}
                  className="text-xs bg-blue-400 text-white px-2 py-0.5 rounded"
                >
                  Post
                </button>
                <button
                  onClick={() =>
                    setShowEmojiPicker((prev) => ({
                      ...prev,
                      [post.id]: !prev[post.id],
                    }))
                  }
                  className="text-xs bg-yellow-400 px-2 py-0.5 rounded"
                >
                  😀
                </button>
              </div>
              {showEmojiPicker[post.id] && (
                <div className="absolute top-full left-0 z-50 bg-white shadow-md rounded p-2">
                  <EmojiPicker
                    onEmojiClick={(emoji) => addEmoji(post.id, emoji)}
                    width={250}
                  />
                </div>
              )}
            </div>
            {/* Comments */}
            <div className="mt-4 space-y-4">
              {(post.comments || []).map((comment, i) => {
                const commentUser = usersMap[comment.uid];
                return (
                  <div key={i} className="ml-4">
                    <div className="flex border border-2 items-start space-x-2">
                      <img
                        src={commentUser?.photoURL || DEFAULT_AVATAR}
                        className="w-8 h-8 border border-2 rounded-full"
                      />
                      <div className="flex-1 p-2 rounded ">
                        {editCommentMap[`${post.id}-${i}`] !== undefined ? (
                          <div>
                            <textarea
                              value={editCommentMap[`${post.id}-${i}`]}
                              onChange={(e) =>
                                setEditCommentMap((prev) => ({
                                  ...prev,
                                  [`${post.id}-${i}`]: e.target.value,
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
                          <>
                            <p className="font-semibold flex items-center space-x-1">
                              <span>
                                {commentUser?.displayName || comment.author}
                              </span>
                              {comment.role === "admin" && (
                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                                  Admin
                                </span>
                              )}
                              {comment.role === "moderator" && (
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                                  Mod
                                </span>
                              )}
                            </p>
                            <p>{comment.text}</p>
                            <p className="text-xs text-gray-400">
                              {safeFormatDate(comment.createdAt)}
                            </p>
                          </>
                        )}

                        <div className="flex items-center space-x-3 mt-1">
                          <button
                            onClick={() =>
                              setShowReplyBoxMap((prev) => ({
                                ...prev,
                                [`reply-${post.id}-${i}`]:
                                  !prev[`reply-${post.id}-${i}`],
                              }))
                            }
                            className="text-xs text-gray-600 hover:underline"
                          >
                            Reply
                          </button>
                          <button
                            onClick={() => handleLikeComment(post.id, i)}
                            className="text-xs text-gray-600 inline-flex items-center space-x-1 hover:underline"
                          >
                            <ThumbsUp
                              size={14}
                              className={
                                comment.commentLikes?.includes(user.uid)
                                  ? "text-blue-500"
                                  : "text-gray-600"
                              }
                            />
                            <span
                              className={
                                comment.commentLikes?.includes(user.uid)
                                  ? "text-blue-500 font-semibold"
                                  : "text-gray-600"
                              }
                            >
                              {comment.commentLikes?.includes(user.uid)
                                ? "Liked"
                                : "Like"}
                            </span>
                            <span className="text-gray-600">
                              {comment.commentLikes?.length || 0}
                            </span>
                          </button>
                          {(comment.uid === user.uid ||
                            user.role === "admin" ||
                            user.role === "moderator") &&
                            editCommentMap[`${post.id}-${i}`] === undefined && (
                              <>
                                <button
                                  onClick={() =>
                                    setEditCommentMap((prev) => ({
                                      ...prev,
                                      [`${post.id}-${i}`]: comment.text,
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
                              </>
                            )}
                        </div>
                        {/* Replies */}
                        {showReplyBoxMap[`reply-${post.id}-${i}`] && (
                          <div className="flex items-start space-x-2 mt-1 relative">
                            <textarea
                              placeholder="Write a reply..."
                              value={commentMap[`reply-${post.id}-${i}`] || ""}
                              onChange={(e) =>
                                setCommentMap((prev) => ({
                                  ...prev,
                                  [`reply-${post.id}-${i}`]: e.target.value,
                                }))
                              }
                              className="border p-1 flex-1 rounded"
                            />
                            <div className="flex flex-col space-y-1">
                              <button
                                onClick={() =>
                                  handleReply(
                                    post.id,
                                    i,
                                    `reply-${post.id}-${i}`
                                  )
                                }
                                className="text-xs bg-yellow-100 px-2 py-0.5 rounded"
                              >
                                Reply
                              </button>
                              <button
                                onClick={() =>
                                  setShowReplyEmojiPicker((prev) => ({
                                    ...prev,
                                    [`reply-${post.id}-${i}`]:
                                      !prev[`reply-${post.id}-${i}`],
                                  }))
                                }
                                className="text-xs bg-yellow-400 px-2 py-0.5 rounded"
                              >
                                😀
                              </button>
                            </div>
                            {showReplyEmojiPicker[`reply-${post.id}-${i}`] && (
                              <div className="absolute top-full left-0 z-50 bg-white shadow-md rounded p-2">
                                <EmojiPicker
                                  onEmojiClick={(emoji) =>
                                    addReplyEmoji(
                                      `reply-${post.id}-${i}`,
                                      emoji
                                    )
                                  }
                                  width={250}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-3 space-y-3">
                          {(comment.replies || []).map((reply, ri) => {
                            const replyUser = usersMap[reply.uid];
                            const replyKey = `${post.id}-${i}-${ri}`;
                            return (
                              <div
                                key={ri}
                                className="flex items-start space-x-2 bg-gray-100 p-2 rounded shadow-sm"
                              >
                                <img
                                  src={replyUser?.photoURL || DEFAULT_AVATAR}
                                  className="w-5 h-5 rounded-full"
                                />
                                <div className="flex-1">
                                  {editingReplyIndexMap[replyKey] ? (
                                    <div>
                                      <textarea
                                        value={editReplyMap[replyKey]}
                                        onChange={(e) =>
                                          setEditReplyMap((prev) => ({
                                            ...prev,
                                            [replyKey]: e.target.value,
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
                                    <>
                                      <p className="font-semibold flex items-center space-x-1">
                                        <span>
                                          {replyUser?.displayName ||
                                            reply.author}
                                        </span>
                                        {reply.role === "admin" && (
                                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                                            Admin
                                          </span>
                                        )}
                                        {reply.role === "moderator" && (
                                          <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                                            Mod
                                          </span>
                                        )}
                                      </p>
                                      <p>{reply.text}</p>
                                      <p className="text-xs text-gray-400">
                                        {safeFormatDate(reply.createdAt)}
                                      </p>
                                    </>
                                  )}
                                  <div className="flex items-center space-x-3 mt-1">
                                    <button
                                      onClick={() =>
                                        setShowReplyBoxMap((prev) => ({
                                          ...prev,
                                          [`reply-${post.id}-${i}-${ri}`]:
                                            !prev[
                                              `reply-${post.id}-${i}-${ri}`
                                            ],
                                        }))
                                      }
                                      className="text-xs text-gray-600 hover:underline"
                                    >
                                      Reply
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleLikeReply(post.id, i, ri)
                                      }
                                      className="text-xs text-gray-600 inline-flex items-center space-x-1 hover:underline"
                                    >
                                      <ThumbsUp
                                        size={14}
                                        className={
                                          reply.replyLikes?.includes(user.uid)
                                            ? "text-blue-500"
                                            : "text-gray-600"
                                        }
                                      />
                                      <span
                                        className={
                                          reply.replyLikes?.includes(user.uid)
                                            ? "text-blue-500 font-semibold"
                                            : "text-gray-600"
                                        }
                                      >
                                        {reply.replyLikes?.includes(user.uid)
                                          ? "Liked"
                                          : "Like"}
                                      </span>
                                      <span className="text-gray-600">
                                        {reply.replyLikes?.length || 0}
                                      </span>
                                    </button>
                                    {(reply.uid === user.uid ||
                                      user.role === "admin" ||
                                      user.role === "moderator") &&
                                      !editingReplyIndexMap[replyKey] && (
                                        <>
                                          <button
                                            onClick={() => {
                                              setEditingReplyIndexMap(
                                                (prev) => ({
                                                  ...prev,
                                                  [replyKey]: true,
                                                })
                                              );
                                              setEditReplyMap((prev) => ({
                                                ...prev,
                                                [replyKey]: reply.text,
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
                                        </>
                                      )}
                                  </div>

                                  {/* Nested reply box */}
                                  {showReplyBoxMap[
                                    `reply-${post.id}-${i}-${ri}`
                                  ] && (
                                    <div className="flex items-start space-x-2 mt-1 relative">
                                      <textarea
                                        placeholder="Write a reply..."
                                        value={
                                          commentMap[
                                            `reply-${post.id}-${i}-${ri}`
                                          ] || ""
                                        }
                                        onChange={(e) =>
                                          setCommentMap((prev) => ({
                                            ...prev,
                                            [`reply-${post.id}-${i}-${ri}`]:
                                              e.target.value,
                                          }))
                                        }
                                        className="border p-1 flex-1 rounded"
                                      />
                                      <div className="flex flex-col space-y-1">
                                        <button
                                          onClick={() =>
                                            handleReply(
                                              post.id,
                                              i,
                                              `reply-${post.id}-${i}-${ri}`
                                            )
                                          }
                                          className="text-xs bg-yellow-100 px-2 py-0.5 rounded"
                                        >
                                          Reply
                                        </button>
                                        <button
                                          onClick={() =>
                                            setShowReplyEmojiPicker((prev) => ({
                                              ...prev,
                                              [`reply-${post.id}-${i}-${ri}`]:
                                                !prev[
                                                  `reply-${post.id}-${i}-${ri}`
                                                ],
                                            }))
                                          }
                                          className="text-xs bg-yellow-400 px-2 py-0.5 rounded"
                                        >
                                          😀
                                        </button>
                                      </div>
                                      {showReplyEmojiPicker[
                                        `reply-${post.id}-${i}-${ri}`
                                      ] && (
                                        <div className="absolute top-full left-0 z-50 bg-white shadow-md rounded p-2">
                                          <EmojiPicker
                                            onEmojiClick={(emoji) =>
                                              addReplyEmoji(
                                                `reply-${post.id}-${i}-${ri}`,
                                                emoji
                                              )
                                            }
                                            width={250}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
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
}
