import React, { useState } from "react";
import { db } from "../firebase";
import {
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";

export default function HomeComments({
  post,
  postUser,
  postAvatar,
  user,
  usersMap,
  handleDeletePost,
  goToProfile,
  safeFormatDate,
}) {
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState(null); // Track reply target
  const [replyText, setReplyText] = useState("");

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!user || !commentText.trim()) return;
    console.log("Submitting comment for post:", post.id);
    const postRef = doc(db, "posts", post.id);
    await updateDoc(postRef, {
      comments: arrayUnion({
        uid: user.uid,
        text: commentText.trim(),
        createdAt: serverTimestamp(),
        replyTo: replyTo || null, // Null for top-level comments
      }),
    });
    setCommentText("");
    setReplyTo(null);
    setReplyText(""); // Reset reply if active
    // Update local state (requires refetch or state management)
    // For now, rely on fetchPosts to refresh
  };

  const handleReplySubmit = async (e, commentId) => {
    e.preventDefault();
    if (!user || !replyText.trim()) return;
    console.log("Submitting reply for comment:", commentId);
    const postRef = doc(db, "posts", post.id);
    await updateDoc(postRef, {
      comments: arrayUnion({
        uid: user.uid,
        text: replyText.trim(),
        createdAt: serverTimestamp(),
        replyTo: commentId,
      }),
    });
    setReplyText("");
    // Update local state (requires refetch)
  };

  return (
    <div className="mt-4">
      <form onSubmit={handleCommentSubmit} className="mb-4">
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Write a comment..."
          className="w-full p-2 border rounded"
        />
        <button
          type="submit"
          className="mt-2 px-3 py-1 bg-blue-500 text-white rounded"
        >
          Post
        </button>
      </form>
      {post.comments?.length > 0 && (
        <div className="ml-4">
          {post.comments.map((comment, index) => (
            <div key={index} className="border p-2 mb-2 rounded">
              <img
                src={usersMap[comment.uid]?.photoURL || postAvatar}
                alt={usersMap[comment.uid]?.displayName || "Unknown User"}
                className="w-8 h-8 rounded-full inline-block mr-2"
              />
              <strong
                className="cursor-pointer"
                onClick={() => comment.uid && goToProfile(comment.uid)}
              >
                {usersMap[comment.uid]?.displayName || "Unknown User"}
              </strong>
              <p className="text-sm text-gray-500">
                {safeFormatDate(comment.createdAt)}
              </p>
              <p>{comment.text}</p>
              {user && (
                <button
                  onClick={() => setReplyTo(index)}
                  className="text-blue-600 hover:underline"
                >
                  Reply
                </button>
              )}
              {replyTo === index && (
                <form onSubmit={(e) => handleReplySubmit(e, index)} className="mt-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    className="w-full p-2 border rounded"
                  />
                  <button
                    type="submit"
                    className="mt-2 px-3 py-1 bg-blue-500 text-white rounded"
                  >
                    Post Reply
                  </button>
                </form>
              )}
              {/* Recursive rendering for replies */}
              {post.comments
                .filter((c) => c.replyTo === index)
                .map((reply, rIndex) => (
                  <div key={rIndex} className="ml-4 border p-2 mb-2 rounded">
                    <img
                      src={usersMap[reply.uid]?.photoURL || postAvatar}
                      alt={usersMap[reply.uid]?.displayName || "Unknown User"}
                      className="w-8 h-8 rounded-full inline-block mr-2"
                    />
                    <strong
                      className="cursor-pointer"
                      onClick={() => reply.uid && goToProfile(reply.uid)}
                    >
                      {usersMap[reply.uid]?.displayName || "Unknown User"}
                    </strong>
                    <p className="text-sm text-gray-500">
                      {safeFormatDate(reply.createdAt)}
                    </p>
                    <p>{reply.text}</p>
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}