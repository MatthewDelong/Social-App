// src/components/groups/GroupComments.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  setDoc,
} from "firebase/firestore";
import EmojiPicker from "emoji-picker-react";
import { formatDistanceToNow } from "date-fns";
import { ThumbsUp, X } from "lucide-react";
import { db } from "../../firebase";
import { useGroupPermissions } from "../../hooks/useGroupPermissions";
import RoleBadge from "./RoleBadge";

export default function GroupComments({ groupId, postId, currentUser }) {
  // Data
  const [comments, setComments] = useState([]);
  const [repliesByComment, setRepliesByComment] = useState({});

  // Compose state
  const [newComment, setNewComment] = useState("");
  const [replyText, setReplyText] = useState({});
  const [replyOpen, setReplyOpen] = useState({});

  // Edit state
  const [editCommentId, setEditCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [editReplyId, setEditReplyId] = useState(null);
  const [editReplyText, setEditReplyText] = useState("");

  // Emoji modal (Home.jsx style): overlay picker with close X, z-50
  // Keys: "new-comment" | "reply:<commentId>" | "edit-comment:<commentId>" | "edit-reply:<replyId>"
  const [emojiFor, setEmojiFor] = useState(null);

  // Likes
  const [likedComments, setLikedComments] = useState({});
  const [likedReplies, setLikedReplies] = useState({});
  const [likeBusyId, setLikeBusyId] = useState(null);
  const [commentLikeCounts, setCommentLikeCounts] = useState({});
  const [replyLikeCounts, setReplyLikeCounts] = useState({});

  // Errors/loading
  const [error, setError] = useState("");
  const [loadingComments, setLoadingComments] = useState(true);
  const [loadingReplies, setLoadingReplies] = useState(true);

  // “mins ago” ticker
  const [, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Permissions
  const { isMember, isSiteAdmin, canDeleteContent, getUserRole } =
    useGroupPermissions(groupId, currentUser?.uid, currentUser?.isAdmin === true);
  const canPost = useMemo(() => isSiteAdmin || isMember, [isSiteAdmin, isMember]);
  const roleOf = useCallback((uid) => (uid ? getUserRole?.(uid) : null), [getUserRole]);

  // Helpers
  const toDate = (v) => (v?.toDate ? v.toDate() : v instanceof Date ? v : v ? new Date(v) : null);
  const rel = (ts) => {
    const d = toDate(ts);
    if (!d) return "";
    let s = formatDistanceToNow(d, { addSuffix: true }); // "2 minutes ago"
    s = s.replace("about ", "").replace("less than a minute", "just now");
    s = s.replace(" minutes", " mins").replace(" minute", " min");
    s = s.replace(" hours", " hrs").replace(" hour", " hr");
    s = s.replace(" seconds", " secs").replace(" second", " sec");
    return s;
  };

  // Comments listener
  useEffect(() => {
    if (!groupId || !postId) return;
    setLoadingComments(true);
    const qComments = query(
      collection(db, "groupComments"),
      where("groupId", "==", groupId),
      where("postId", "==", postId),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(
      qComments,
      (snap) => {
        setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingComments(false);
      },
      (err) => {
        console.error("Comments listen error:", err);
        setError("Failed to load comments.");
        setLoadingComments(false);
      }
    );
    return () => unsub();
  }, [groupId, postId]);

  // Replies listener
  useEffect(() => {
    if (!groupId || !postId) return;
    setLoadingReplies(true);
    const qReplies = query(
      collection(db, "groupReplies"),
      where("groupId", "==", groupId),
      where("postId", "==", postId),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(
      qReplies,
      (snap) => {
        const byComment = {};
        snap.docs.forEach((d) => {
          const r = { id: d.id, ...d.data() };
          if (!byComment[r.commentId]) byComment[r.commentId] = [];
          byComment[r.commentId].push(r);
        });
        setRepliesByComment(byComment);
        setLoadingReplies(false);
      },
      (err) => {
        console.error("Replies listen error:", err);
        setError("Failed to load replies.");
        setLoadingReplies(false);
      }
    );
    return () => unsub();
  }, [groupId, postId]);

  // “Liked by me” flags (non-blocking, initial)
  useEffect(() => {
    async function loadLikes() {
      if (!currentUser?.uid) return;
      try {
        const newLikedComments = {};
        for (const c of comments) {
          const likeRef = doc(db, "groupComments", c.id, "likes", currentUser.uid);
          const likeSnap = await getDoc(likeRef);
          if (likeSnap.exists()) newLikedComments[c.id] = true;
        }
        setLikedComments(newLikedComments);

        const newLikedReplies = {};
        const allReplies = Object.values(repliesByComment).flat();
        for (const r of allReplies) {
          const likeRef = doc(db, "groupReplies", r.id, "likes", currentUser.uid);
          const likeSnap = await getDoc(likeRef);
          if (likeSnap.exists()) newLikedReplies[r.id] = true;
        }
        setLikedReplies(newLikedReplies);
      } catch (e) {
        console.warn("Load likes failed:", e?.message || e);
      }
    }
    loadLikes();
  }, [comments, repliesByComment, currentUser?.uid]);

  // Live like counts
  useEffect(() => {
    const unsubs = comments.map((c) =>
      onSnapshot(collection(db, "groupComments", c.id, "likes"), (snap) =>
        setCommentLikeCounts((s) => ({ ...s, [c.id]: snap.size }))
      )
    );
    return () => unsubs.forEach((u) => u && u());
  }, [comments]);

  const allReplies = useMemo(() => Object.values(repliesByComment).flat(), [repliesByComment]);
  useEffect(() => {
    const unsubs = allReplies.map((r) =>
      onSnapshot(collection(db, "groupReplies", r.id, "likes"), (snap) =>
        setReplyLikeCounts((s) => ({ ...s, [r.id]: snap.size }))
      )
    );
    return () => unsubs.forEach((u) => u && u());
  }, [allReplies]);

  // Emoji modal controls (Home.jsx style)
  const openEmoji = (key) => setEmojiFor(key);
  const closeEmoji = () => setEmojiFor(null);

  // Insert emoji (matches Home.jsx behavior)
  const insertEmoji = (key, data) => {
    const ch = data?.emoji || data?.native || "";
    if (!ch) return;
    if (key === "new-comment") {
      setNewComment((t) => (t || "") + ch);
      return;
    }
    if (key.startsWith("reply:")) {
      const commentId = key.split(":")[1];
      setReplyText((s) => ({ ...s, [commentId]: (s[commentId] || "") + ch }));
      return;
    }
    if (key.startsWith("edit-comment:")) {
      setEditCommentText((t) => (t || "") + ch);
      return;
    }
    if (key.startsWith("edit-reply:")) {
      setEditReplyText((t) => (t || "") + ch);
    }
  };

  // Create comment
  async function handleAddComment(e) {
    e.preventDefault();
    setError("");
    const content = newComment.trim();
    if (!content) return;
    if (!currentUser?.uid) return setError("You must be signed in to comment.");
    if (!canPost) return setError("Join the group to comment.");

    try {
      await addDoc(collection(db, "groupComments"), {
        groupId,
        postId,
        uid: currentUser.uid,
        author: currentUser.displayName || currentUser.email || "Member",
        authorPhotoURL: currentUser.photoURL || "",
        content,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewComment("");
      closeEmoji();
    } catch (err) {
      console.error("Error adding comment:", err);
      setError(err?.message || "Failed to add comment.");
    }
  }

  // Create reply
  async function handleAddReply(commentId) {
    setError("");
    const text = (replyText[commentId] || "").trim();
    if (!text) return;
    if (!currentUser?.uid) return setError("You must be signed in to reply.");
    if (!canPost) return setError("Join the group to reply.");

    try {
      await addDoc(collection(db, "groupReplies"), {
        groupId,
        postId,
        commentId,
        uid: currentUser.uid,
        author: currentUser.displayName || currentUser.email || "Member",
        authorPhotoURL: currentUser.photoURL || "",
        content: text,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setReplyText((s) => ({ ...s, [commentId]: "" }));
      setReplyOpen((s) => ({ ...s, [commentId]: false }));
      closeEmoji();
    } catch (err) {
      console.error("Error adding reply:", err);
      setError(err?.message || "Failed to add reply.");
    }
  }

  // Reply to a reply (open parent’s reply box, prefill @mention)
  function replyToReply(reply) {
    const at = reply?.author ? `@${reply.author} ` : "";
    setReplyOpen((s) => ({ ...s, [reply.commentId]: true }));
    setReplyText((s) => {
      const prev = s[reply.commentId] || "";
      const next = prev.startsWith(at) ? prev : at + prev;
      return { ...s, [reply.commentId]: next };
    });
  }

  // Edit comment/reply
  function startEditComment(c) {
    setEditReplyId(null);
    setEditReplyText("");
    setEditCommentId(c.id);
    setEditCommentText(c.content || "");
  }
  async function saveEditComment() {
    if (!editCommentId) return;
    const newText = editCommentText.trim();
    if (!newText) return;
    try {
      await updateDoc(doc(db, "groupComments", editCommentId), {
        content: newText,
        updatedAt: serverTimestamp(),
      });
      setEditCommentId(null);
      setEditCommentText("");
      closeEmoji();
    } catch (err) {
      console.error("Error saving comment:", err);
      setError(err?.message || "Failed to save comment.");
    }
  }

  function startEditReply(r) {
    setEditCommentId(null);
    setEditCommentText("");
    setEditReplyId(r.id);
    setEditReplyText(r.content || "");
  }
  async function saveEditReply() {
    if (!editReplyId) return;
    const newText = editReplyText.trim();
    if (!newText) return;
    try {
      await updateDoc(doc(db, "groupReplies", editReplyId), {
        content: newText,
        updatedAt: serverTimestamp(),
      });
      setEditReplyId(null);
      setEditReplyText("");
      closeEmoji();
    } catch (err) {
      console.error("Error saving reply:", err);
      setError(err?.message || "Failed to save reply.");
    }
  }

  // Delete
  async function handleDeleteComment(c) {
    setError("");
    const allowed =
      isSiteAdmin || currentUser?.uid === c.uid || canDeleteContent(c.uid);
    if (!allowed) return setError("You don't have permission to delete this comment.");
    try {
      await deleteDoc(doc(db, "groupComments", c.id));
    } catch (err) {
      console.error("Error deleting comment:", err);
      setError(err?.message || "Failed to delete comment.");
    }
  }
  async function handleDeleteReply(r) {
    setError("");
    const allowed =
      isSiteAdmin || currentUser?.uid === r.uid || canDeleteContent(r.uid);
    if (!allowed) return setError("You don't have permission to delete this reply.");
    try {
      await deleteDoc(doc(db, "groupReplies", r.id));
    } catch (err) {
      console.error("Error deleting reply:", err);
      setError(err?.message || "Failed to delete reply.");
    }
  }

  // Likes
  async function toggleLikeComment(c) {
    if (!currentUser?.uid) return setError("Sign in to like.");
    setLikeBusyId(c.id);
    const likeRef = doc(db, "groupComments", c.id, "likes", currentUser.uid);
    try {
      if (likedComments[c.id]) {
        await deleteDoc(likeRef);
        setLikedComments((s) => ({ ...s, [c.id]: false }));
      } else {
        await setDoc(likeRef, { createdAt: serverTimestamp() }, { merge: true });
        setLikedComments((s) => ({ ...s, [c.id]: true }));
      }
    } catch (e) {
      console.error("Like comment failed:", e);
      setError(e?.message || "Failed to toggle like.");
    } finally {
      setLikeBusyId(null);
    }
  }
  async function toggleLikeReply(r) {
    if (!currentUser?.uid) return setError("Sign in to like.");
    setLikeBusyId(r.id);
    const likeRef = doc(db, "groupReplies", r.id, "likes", currentUser.uid);
    try {
      if (likedReplies[r.id]) {
        await deleteDoc(likeRef);
        setLikedReplies((s) => ({ ...s, [r.id]: false }));
      } else {
        await setDoc(likeRef, { createdAt: serverTimestamp() }, { merge: true });
        setLikedReplies((s) => ({ ...s, [r.id]: true }));
      }
    } catch (e) {
      console.error("Like reply failed:", e);
      setError(e?.message || "Failed to toggle like.");
    } finally {
      setLikeBusyId(null);
    }
  }

  const Author = ({ avatar, name, role, createdAt }) => (
    <div className="flex items-center gap-2">
      <img
        src={avatar || "/api/placeholder/32/32"}
        alt={name}
        className="w-8 h-8 border-2 border-white rounded-full object-cover"
      />
      <div>
        <div className="text-sm font-medium">
          <span className="inline-flex items-center gap-1 align-middle whitespace-nowrap">
            {name}
            {role && (
              <span className="shrink-0 inline-flex items-center leading-none align-middle">
                <RoleBadge role={role} size="xs" />
              </span>
            )}
          </span>
        </div>
        <div className="text-xs text-gray-500">{rel(createdAt)}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-2 text-sm bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* New comment */}
      {canPost ? (
        <form onSubmit={handleAddComment} className="space-y-2">
          <div className="relative">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="w-full p-2 pr-10 border rounded"
            />
            <button
              type="button"
              onClick={() => openEmoji("new-comment")}
              className="absolute right-2 top-2 text-xl"
              title="Add emoji"
              aria-label="Add emoji"
            >
              🙂
            </button>
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50"
            disabled={!newComment.trim()}
          >
            Comment
          </button>
        </form>
      ) : (
        <div className="text-sm text-gray-600 border rounded p-2">
          Join this group to comment.
        </div>
      )}

      {/* Comments list */}
      <div className="space-y-3">
        {loadingComments ? (
          <div className="text-sm text-gray-500">Loading comments…</div>
        ) : comments.length === 0 ? (
          <div className="text-sm text-gray-500">No comments yet.</div>
        ) : (
          comments.map((c) => {
            const role = roleOf(c.uid);
            const canEditDelete =
              isSiteAdmin || currentUser?.uid === c.uid || canDeleteContent(c.uid);
            const isLiked = !!likedComments[c.id];
            const likeCount = commentLikeCounts[c.id] || 0;

            return (
              <div key={c.id} className="border rounded p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <Author
                    avatar={c.authorPhotoURL}
                    name={c.author}
                    role={role}
                    createdAt={c.createdAt}
                  />
                </div>

                {/* Text or Edit box */}
                {editCommentId === c.id ? (
                  <div className="relative">
                    <textarea
                      value={editCommentText}
                      onChange={(e) => setEditCommentText(e.target.value)}
                      className="w-full p-2 pr-10 border rounded text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => openEmoji(`edit-comment:${c.id}`)}
                      className="absolute right-2 top-2 text-xl"
                      title="Add emoji"
                      aria-label="Add emoji"
                    >
                      🙂
                    </button>
                    <div className="mt-2 flex items-center gap-4 text-xs">
                      <button
                        type="button"
                        onClick={saveEditComment}
                        className="text-blue-600 hover:underline"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditCommentId(null);
                          setEditCommentText("");
                          closeEmoji();
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm">{c.content}</div>
                )}

                {/* Action row */}
                <div className="flex items-center gap-4 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setReplyOpen((s) => ({ ...s, [c.id]: !s[c.id] }))
                    }
                    className="text-blue-600 hover:underline"
                  >
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleLikeComment(c)}
                    disabled={likeBusyId === c.id}
                    className={`inline-flex items-center gap-1 hover:underline ${
                      isLiked ? "text-blue-700" : "text-blue-600"
                    }`}
                  >
                    <ThumbsUp size={14} />
                    {isLiked ? "Liked" : "Like"}
                    {likeCount > 0 && <span className="text-gray-600">({likeCount})</span>}
                  </button>
                  {canEditDelete && editCommentId !== c.id && (
                    <button
                      type="button"
                      onClick={() => startEditComment(c)}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                  )}
                  {canEditDelete && (
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(c)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>

                {/* Replies */}
                <div className="pl-6 space-y-2">
                  {loadingReplies ? (
                    <div className="text-xs text-gray-500">Loading replies…</div>
                  ) : (repliesByComment[c.id] || []).length === 0 ? (
                    <div className="text-xs text-gray-500">No replies.</div>
                  ) : (
                    (repliesByComment[c.id] || []).map((r) => {
                      const rRole = roleOf(r.uid);
                      const rCanEditDelete =
                        isSiteAdmin || currentUser?.uid === r.uid || canDeleteContent(r.uid);
                      const rLiked = !!likedReplies[r.id];
                      const rLikeCount = replyLikeCounts[r.id] || 0;

                      return (
                        <div key={r.id} className="space-y-1">
                          <div className="flex items-start gap-2">
                            <img
                              src={r.authorPhotoURL || "/api/placeholder/24/24"}
                              alt={r.author}
                              className="w-6 h-6 border-2 border-white rounded-full object-cover mt-0.5"
                            />
                            <div className="flex-1">
                              <div className="text-xs">
                                <span className="inline-flex items-center gap-1 align-middle whitespace-nowrap">
                                  <span className="font-medium">{r.author}</span>
                                  {rRole && (
                                    <span className="shrink-0 inline-flex items-center leading-none align-middle">
                                      <RoleBadge role={rRole} size="xs" />
                                    </span>
                                  )}
                                </span>
                                <span className="ml-2 text-gray-500">{rel(r.createdAt)}</span>
                              </div>

                              {editReplyId === r.id ? (
                                <div className="relative mt-1">
                                  <textarea
                                    value={editReplyText}
                                    onChange={(e) => setEditReplyText(e.target.value)}
                                    className="w-full p-2 pr-10 border rounded text-sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => openEmoji(`edit-reply:${r.id}`)}
                                    className="absolute right-2 top-2 text-xl"
                                    title="Add emoji"
                                    aria-label="Add emoji"
                                  >
                                    🙂
                                  </button>
                                  <div className="mt-2 flex items-center gap-4 text-xs">
                                    <button
                                      type="button"
                                      onClick={saveEditReply}
                                      className="text-blue-600 hover:underline"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditReplyId(null);
                                        setEditReplyText("");
                                        closeEmoji();
                                      }}
                                      className="text-blue-600 hover:underline"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm mt-1">{r.content}</div>
                              )}

                              {/* Reply action row */}
                              <div className="mt-1 flex items-center gap-4 text-xs">
                                <button
                                  type="button"
                                  onClick={() => replyToReply(r)}
                                  className="text-blue-600 hover:underline"
                                >
                                  Reply
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleLikeReply(r)}
                                  disabled={likeBusyId === r.id}
                                  className={`inline-flex items-center gap-1 hover:underline ${
                                    rLiked ? "text-blue-700" : "text-blue-600"
                                  }`}
                                >
                                  <ThumbsUp size={14} />
                                  {rLiked ? "Liked" : "Like"}
                                  {rLikeCount > 0 && (
                                    <span className="text-gray-600">({rLikeCount})</span>
                                  )}
                                </button>
                                {rCanEditDelete && editReplyId !== r.id && (
                                  <button
                                    type="button"
                                    onClick={() => startEditReply(r)}
                                    className="text-blue-600 hover:underline"
                                  >
                                    Edit
                                  </button>
                                )}
                                {rCanEditDelete && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteReply(r)}
                                    className="text-red-600 hover:underline"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Reply composer */}
                  {canPost && replyOpen[c.id] && (
                    <div className="mt-1">
                      <div className="relative">
                        <textarea
                          value={replyText[c.id] || ""}
                          onChange={(e) =>
                            setReplyText((s) => ({ ...s, [c.id]: e.target.value }))
                          }
                          placeholder="Write a reply…"
                          className="w-full p-2 pr-10 border rounded text-sm"
                          rows={2}
                        />
                        <button
                          type="button"
                          onClick={() => openEmoji(`reply:${c.id}`)}
                          className="absolute right-2 top-2 text-xl"
                          title="Add emoji"
                          aria-label="Add emoji"
                        >
                          🙂
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleAddReply(c.id)}
                          disabled={!(replyText[c.id] || "").trim()}
                          className="px-3 py-1.5 bg-green-600 text-white rounded disabled:opacity-50"
                        >
                          Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplyOpen((s) => ({ ...s, [c.id]: false }))}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Emoji modal (Home.jsx style) */}
      {emojiFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white shadow-lg rounded-lg p-2 border max-w-sm w-full mx-4 relative">
            <button
              onClick={closeEmoji}
              className="absolute top-2 right-2 z-10 bg-gray-100 hover:bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center text-gray-600 font-bold"
              aria-label="Close emoji picker"
              title="Close"
            >
              <X size={18} />
            </button>
            <EmojiPicker
              onEmojiClick={(emojiData) => {
                insertEmoji(emojiFor, emojiData);
              }}
              width={280}
              height={350}
            />
          </div>
        </div>
      )}
    </div>
  );
}