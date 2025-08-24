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
  arrayUnion,
  arrayRemove,
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
  const [activeReply, setActiveReply] = useState(null); // Track active reply input
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
        likes: d.data().likes || [],
        comments: d.data().comments || [],
        ...d.data(),
      }));
      setPosts(docs);
    });
    return () => unsub();
  }, []);

  const handleLikePost = async (id) => {
    const postRef = doc(db, "posts", id);
    const post = posts.find((p) => p.id === id);
    const likes = new Set(post.likes || []);
    likes.has(user.uid) ? likes.delete(user.uid) : likes.add(user.uid);
    await updateDoc(postRef, { likes: Array.from(likes) });
  };

  const handleLikeComment = async (postId, commentIndex) => {
    const postRef = doc(db, "posts", postId);
    const post = posts.find((p) => p.id === postId);
    const comment = post.comments[commentIndex];
    const likes = new Set(comment.likes || []);
    likes.has(user.uid) ? likes.delete(user.uid) : likes.add(user.uid);
    const updatedComments = post.comments.map((c, i) =>
      i === commentIndex ? { ...c, likes: Array.from(likes) } : c
    );
    await updateDoc(postRef, { comments: updatedComments });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: updatedComments } : p
      )
    );
  };

  const handleLikeReply = async (postId, commentIndex, replyIndex) => {
    const postRef = doc(db, "posts", postId);
    const post = posts.find((p) => p.id === postId);
    const reply = post.comments[commentIndex].replies[replyIndex];
    const likes = new Set(reply.likes || []);
    likes.has(user.uid) ? likes.delete(user.uid) : likes.add(user.uid);
    const updatedComments = post.comments.map((c, ci) =>
      ci === commentIndex
        ? {
            ...c,
            replies: c.replies.map((r, ri) =>
              ri === replyIndex ? { ...r, likes: Array.from(likes) } : r
            ),
          }
        : c
    );
    await updateDoc(postRef, { comments: updatedComments });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: updatedComments } : p
      )
    );
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
      likes: [],
      replies: [],
    };
    const updatedComments = [...(post.comments || []), newComment];
    await updateDoc(postRef, { comments: updatedComments });
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, comments: updatedComments } : p))
    );
    setCommentMap((prev) => ({ ...prev, [id]: "" }));
  };

  const handleReply = async (postId, commentIndex) => {
    const replyKey = `${postId}-reply-${commentIndex}`;
    const replyText = commentMap[replyKey];
    if (!replyText?.trim()) return;
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    const reply = {
      text: replyText,
      author: user.displayName || user.email || "Unknown User",
      uid: user.uid,
      role: user.role || "user",
      createdAt: new Date().toISOString(),
      likes: [],
    };
    updatedComments[commentIndex].replies = [
      ...(updatedComments[commentIndex].replies || []),
      reply,
    ];
    await updateDoc(doc(db, "posts", postId), { comments: updatedComments });
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
    setCommentMap((prev) => ({ ...prev, [replyKey]: "" }));
    setActiveReply(null); // Close the reply input after submission
  };

  const handleDeleteComment = async (postId, index) => {
    const post = posts.find((p) => p.id === postId);
    if (!post?.comments) return;
    const updatedComments = [...post.comments];
    updatedComments.splice(index, 1);
    await updateDoc(doc(db, "posts", postId), { comments: updatedComments });
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
    await updateDoc(doc(db, "posts", postId), { comments: updatedComments });
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
    setEditCommentMap((prev) => ({ ...prev, [`${postId}-${index}`]: "" }));
  };

  const handleDeletePost = async (postId) => {
    await deleteDoc(doc(db, "posts", postId));
  };

  const handleEditPost = async (postId) => {
    await updateDoc(doc(db, "posts", postId), { content: editedContent });
    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId ? { ...p, content: editedContent } : p
      )
    );
    setEditingPostId(null);
    setEditedContent("");
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
      comments: posts
        .find((p) => p.id === postId)
        ?.comments.map((comment, ci) =>
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
          <div
            key={post.id}
            className="border p-4 rounded mb-4 bg-white shadow-sm sm:p-2"
          >
            <div className="flex justify-between">
              <div className="flex items-center space-x-2">
                <img
                  src={postAvatar}
                  alt="avatar"
                  className="w-8 h-8 rounded-full object-cover cursor-pointer sm:w-6 sm:h-6"
                  onClick={() => goToProfile(post.uid)}
                />
                <p
                  className="font-bold text-gray-800 cursor-pointer"
                  onClick={() => goToProfile(post.uid)}
                >
                  {postUser?.displayName || post.author || "Unknown User"}
                  {usersMap[post.uid]?.isAdmin && (
                    <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                      Admin
                    </span>
                  )}
                  {usersMap[post.uid]?.isModerator && (
                    <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                      Moderator
                    </span>
                  )}
                </p>
              </div>
              {(post.uid === user.uid ||
                user.role === "admin" ||
                user.role === "moderator") && (
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
            <div className="mt-2 text-gray-900 sm:mt-1">
              {editingPostId === post.id ? (
                <div>
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="border p-2 w-full rounded sm:p-1"
                  />
                  <button
                    onClick={() => handleEditPost(post.id)}
                    className="mt-1 text-sm bg-blue-500 text-white px-2 py-1 rounded sm:mt-0.5 sm:px-1 sm:py-0.5"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <p>{post.content}</p>
              )}
            </div>

            <div className="flex items-center space-x-4 mt-2 sm:space-x-2 sm:mt-1">
              <button
                onClick={() => handleLikePost(post.id)}
                className={`flex items-center gap-1 text-sm text-gray-600 hover:underline ${
                  post.likes.includes(user?.uid) ? "text-blue-600 font-semibold" : ""
                }`}
              >
                <ThumbsUp size={14} />
                {post.likes.includes(user?.uid) ? "Liked" : "Like"}
                {post.likes.length > 0 && ` (${post.likes.length})`}
              </button>
              <span className="text-xs text-gray-500">
                {safeFormatDate(post.createdAt)}
              </span>
            </div>

            {/* New Comment input at top */}
            <div className="flex items-start space-x-2 mt-4 sm:space-x-1 sm:mt-2">
              <textarea
                placeholder="Write a comment..."
                value={commentMap[post.id] || ""}
                onChange={(e) =>
                  setCommentMap((prev) => ({
                    ...prev,
                    [post.id]: e.target.value,
                  }))
                }
                className="border p-1 flex-1 rounded sm:p-0.5"
              />
              <button
                onClick={() => handleComment(post.id)}
                className="text-xs bg-yellow-100 text-black-800 px-2 py-0.5 rounded sm:px-1 sm:py-0.5"
              >
                Comment
              </button>
              <button
                onClick={() =>
                  setShowEmojiPicker((prev) => ({
                    ...prev,
                    [post.id]: !prev[post.id],
                  }))
                }
                className="text-xs bg-yellow-400 px-2 py-0.5 rounded sm:px-1 sm:py-0.5"
              >
                😀
              </button>
            </div>
            {showEmojiPicker[post.id] && (
              <div className="fixed md:relative bottom-0 md:bottom-auto left-0 right-0 md:left-auto md:right-auto z-50 md:z-auto">
                <div className="relative max-w-[350px] mx-auto md:mx-0">
                  <button
                    onClick={() =>
                      setShowEmojiPicker((prev) => ({
                        ...prev,
                        [post.id]: false,
                      }))
                    }
                    className="absolute -top-3 -right-3 z-10 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    X
                  </button>
                  <EmojiPicker
                    width="100%"
                    height={350}
                    onEmojiClick={(emoji) => addEmoji(post.id, emoji)}
                  />
                </div>
              </div>
            )}

            {/* Comments */}
            <div className="mt-4 space-y-4 sm:mt-2">
              {(post.comments || []).map((comment, i) => {
                const commentUser = usersMap[comment.uid];
                const commentAvatar = commentUser?.photoURL || DEFAULT_AVATAR;
                return (
                  <div key={i} className="ml-5 relative sm:ml-2.5">
                    {/* Vertical Line for Comments */}
                    {(i > 0 || post.comments.length > 1) && (
                      <div
                        className="absolute left-[-20px] top-0 bottom-0"
                        style={{
                          borderLeft: "2px solid #b1aeae",
                          marginLeft: "-1px",
                          zIndex: 0,
                        }}
                      />
                    )}
                    <div className="flex items-start space-x-2 bg-white p-2 rounded relative" style={{ zIndex: 1 }}>
                      <img
                        src={commentAvatar}
                        alt="avatar"
                        className="w-6 h-6 rounded-full object-cover cursor-pointer sm:w-5 sm:h-5"
                        onClick={() => goToProfile(comment.uid)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 sm:space-x-1">
                          <p
                            className="font-semibold text-gray-800 cursor-pointer"
                            onClick={() => goToProfile(comment.uid)}
                          >
                            {commentUser?.displayName || comment.author}
                            {commentUser?.isAdmin && (
                              <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                                Admin
                              </span>
                            )}
                            {commentUser?.isModerator && (
                              <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                                Moderator
                              </span>
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
                                  [`${post.id}-${i}`]: e.target.value,
                                }))
                              }
                              className="border p-1 w-full rounded sm:p-0.5"
                            />
                            <button
                              onClick={() => handleEditComment(post.id, i)}
                              className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded mt-1 sm:mt-0.5 sm:px-1 sm:py-0.5"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <p className="text-gray-900">{comment.text}</p>
                        )}

                        <div className="mt-1 flex items-center gap-4 text-xs text-gray-600 sm:mt-0.5 sm:gap-2">
                          <button
                            onClick={() =>
                              setActiveReply(
                                activeReply === `${post.id}-reply-${i}`
                                  ? null
                                  : `${post.id}-reply-${i}`
                              )
                            }
                            className="text-blue-600 hover:underline"
                          >
                            Reply
                          </button>
                          <button
                            onClick={() => handleLikeComment(post.id, i)}
                            className={`flex items-center gap-1 hover:underline ${
                              comment.likes?.includes(user?.uid)
                                ? "text-blue-600 font-semibold"
                                : "text-gray-600"
                            }`}
                          >
                            <ThumbsUp size={14} />
                            {comment.likes?.includes(user?.uid) ? "Liked" : "Like"}
                            {comment.likes?.length > 0 && ` (${comment.likes.length})`}
                          </button>
                          {comment.uid === user.uid &&
                            editCommentMap[`${post.id}-${i}`] === undefined && (
                              <div className="space-x-2">
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
                                  onClick={() => handleDeleteComment(post.id, i)}
                                  className="text-xs text-red-500 hover:underline"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                        </div>

                        {/* Reply Input */}
                        {activeReply === `${post.id}-reply-${i}` && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleReply(post.id, i);
                            }}
                            className="flex items-start space-x-2 mt-1 sm:space-x-1 sm:mt-0.5"
                          >
                            <textarea
                              name="replyText"
                              placeholder={`Replying to ${comment.author}...`}
                              value={commentMap[`${post.id}-reply-${i}`] || ""}
                              onChange={(e) =>
                                setCommentMap((prev) => ({
                                  ...prev,
                                  [`${post.id}-reply-${i}`]: e.target.value,
                                }))
                              }
                              className="border p-1 flex-1 rounded sm:p-0.5"
                              autoFocus
                            />
                            <button
                              type="submit"
                              className="text-xs bg-yellow-100 text-black-800 px-2 py-0.5 rounded sm:px-1 sm:py-0.5"
                            >
                              Reply
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveReply(null)}
                              className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded sm:px-1 sm:py-0.5"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() =>
                                setShowReplyEmojiPicker((prev) => ({
                                  ...prev,
                                  [`${post.id}-reply-${i}`]:
                                    !prev[`${post.id}-reply-${i}`],
                                }))
                              }
                              className="text-xs bg-yellow-400 px-2 py-0.5 rounded sm:px-1 sm:py-0.5"
                            >
                              😀
                            </button>
                          </form>
                        )}
                        {showReplyEmojiPicker[`${post.id}-reply-${i}`] && (
                          <div className="fixed md:relative bottom-0 md:bottom-auto left-0 right-0 md:left-auto md:right-auto z-50 md:z-auto">
                            <div className="relative max-w-[350px] mx-auto md:mx-0">
                              <button
                                onClick={() =>
                                  setShowReplyEmojiPicker((prev) => ({
                                    ...prev,
                                    [`${post.id}-reply-${i}`]: false,
                                  }))
                                }
                                className="absolute -top-3 -right-3 z-10 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                              >
                                X
                              </button>
                              <EmojiPicker
                                width="100%"
                                height={350}
                                onEmojiClick={(emoji) =>
                                  addReplyEmoji(`${post.id}-reply-${i}`, emoji)
                                }
                              />
                            </div>
                          </div>
                        )}

                        {/* Replies with Gap */}
                        {comment.replies.length > 0 && (
                          <div className="ml-5 mt-4 space-y-2 relative sm:ml-2.5 sm:mt-2">
                            {/* Vertical Line for Replies */}
                            <div
                              className="absolute left-[-20px] top-0 bottom-0"
                              style={{
                                borderLeft: "2px solid #b1aeae",
                                marginLeft: "-1px",
                                zIndex: 0,
                              }}
                            />
                            {(comment.replies || []).map((reply, ri) => {
                              const replyUser = usersMap[reply.uid];
                              const replyAvatar = replyUser?.photoURL || DEFAULT_AVATAR;
                              const replyKey = `${post.id}-${i}-${ri}`;
                              return (
                                <div
                                  key={ri}
                                  className="flex items-start space-x-2 bg-white p-2 rounded relative"
                                  style={{ zIndex: 1 }}
                                >
                                  {/* Horizontal Line for Reply */}
                                  {ri === 0 && (
                                    <div
                                      className="absolute left-[-20px] top-[50%]"
                                      style={{
                                        width: "20px",
                                        borderBottom: "2px solid #b1aeae",
                                        marginLeft: "-1px",
                                        transform: "translateY(-50%)",
                                        zIndex: 0,
                                      }}
                                    />
                                  )}
                                  <img
                                    src={replyAvatar}
                                    alt="avatar"
                                    className="w-5 h-5 rounded-full object-cover cursor-pointer sm:w-4 sm:h-4"
                                    onClick={() => goToProfile(reply.uid)}
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 sm:space-x-1">
                                      <p
                                        className="font-semibold text-gray-800 cursor-pointer"
                                        onClick={() => goToProfile(reply.uid)}
                                      >
                                        {replyUser?.displayName || reply.author}
                                        {replyUser?.isAdmin && (
                                          <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                                            Admin
                                          </span>
                                        )}
                                        {replyUser?.isModerator && (
                                          <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                                            Moderator
                                          </span>
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
                                              [replyKey]: e.target.value,
                                            }))
                                          }
                                          className="border p-1 w-full rounded sm:p-0.5"
                                        />
                                        <button
                                          onClick={() =>
                                            handleEditReply(post.id, i, ri)
                                          }
                                          className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded mt-1 sm:mt-0.5 sm:px-1 sm:py-0.5"
                                        >
                                          Save
                                        </button>
                                      </div>
                                    ) : (
                                      <p className="text-gray-900">{reply.text}</p>
                                    )}

                                    <div className="mt-1 flex items-center gap-4 text-xs text-gray-600 sm:mt-0.5 sm:gap-2">
                                      <button
                                        onClick={() =>
                                          setActiveReply(
                                            activeReply === `${post.id}-reply-${i}-${ri}`
                                              ? null
                                              : `${post.id}-reply-${i}-${ri}`
                                          )
                                        }
                                        className="text-blue-600 hover:underline"
                                      >
                                        Reply
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleLikeReply(post.id, i, ri)
                                        }
                                        className={`flex items-center gap-1 hover:underline ${
                                          reply.likes?.includes(user?.uid)
                                            ? "text-blue-600 font-semibold"
                                            : "text-gray-600"
                                        }`}
                                      >
                                        <ThumbsUp size={14} />
                                        {reply.likes?.includes(user?.uid)
                                          ? "Liked"
                                          : "Like"}
                                        {reply.likes?.length > 0 &&
                                          ` (${reply.likes.length})`}
                                      </button>
                                      {reply.uid === user.uid &&
                                        !editingReplyIndexMap[replyKey] && (
                                          <div className="space-x-2">
                                            <button
                                              onClick={() => {
                                                setEditingReplyIndexMap((prev) => ({
                                                  ...prev,
                                                  [replyKey]: true,
                                                }));
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
                                          </div>
                                        )}
                                    </div>

                                    {/* Nested Reply Input */}
                                    {activeReply === `${post.id}-reply-${i}-${ri}` && (
                                      <form
                                        onSubmit={(e) => {
                                          e.preventDefault();
                                          handleReply(post.id, i, ri);
                                        }}
                                        className="flex items-start space-x-2 mt-1 sm:space-x-1 sm:mt-0.5"
                                      >
                                        <textarea
                                          name="replyText"
                                          placeholder={`Replying to ${reply.author}...`}
                                          value={
                                            commentMap[
                                              `${post.id}-reply-${i}-${ri}`
                                            ] || ""
                                          }
                                          onChange={(e) =>
                                            setCommentMap((prev) => ({
                                              ...prev,
                                              [`${post.id}-reply-${i}-${ri}`]:
                                                e.target.value,
                                            }))
                                          }
                                          className="border p-1 flex-1 rounded sm:p-0.5"
                                          autoFocus
                                        />
                                        <button
                                          type="submit"
                                          className="text-xs bg-yellow-100 text-black-800 px-2 py-0.5 rounded sm:px-1 sm:py-0.5"
                                        >
                                          Reply
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setActiveReply(null)}
                                          className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded sm:px-1 sm:py-0.5"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={() =>
                                            setShowReplyEmojiPicker((prev) => ({
                                              ...prev,
                                              [`${post.id}-reply-${i}-${ri}`]:
                                                !prev[`${post.id}-reply-${i}-${ri}`],
                                            }))
                                          }
                                          className="text-xs bg-yellow-400 px-2 py-0.5 rounded sm:px-1 sm:py-0.5"
                                        >
                                          😀
                                        </button>
                                      </form>
                                    )}
                                    {showReplyEmojiPicker[
                                      `${post.id}-reply-${i}-${ri}`
                                    ] && (
                                      <div className="fixed md:relative bottom-0 md:bottom-auto left-0 right-0 md:left-auto md:right-auto z-50 md:z-auto">
                                        <div className="relative max-w-[350px] mx-auto md:mx-0">
                                          <button
                                            onClick={() =>
                                              setShowReplyEmojiPicker((prev) => ({
                                                ...prev,
                                                [`${post.id}-reply-${i}-${ri}`]:
                                                  false,
                                              }))
                                            }
                                            className="absolute -top-3 -right-3 z-10 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                                          >
                                            X
                                          </button>
                                          <EmojiPicker
                                            width="100%"
                                            height={350}
                                            onEmojiClick={(emoji) =>
                                              addReplyEmoji(
                                                `${post.id}-reply-${i}-${ri}`,
                                                emoji
                                              )
                                            }
                                          />
                                        </div>
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
}