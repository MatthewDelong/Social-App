const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

const AUTHOR_FIELDS = ["uid", "authorUid", "authorId", "userId"];
const GROUP_TOP_POSTS = "groupPosts";
const GROUP_TOP_COMMENTS = "groupComments";
const GROUP_TOP_REPLIES = "groupReplies";

async function getUserDisplayName(db, uid) {
  try {
    const snap = await db.collection("users").doc(uid).get();
    return snap.exists ? snap.data().displayName || null : null;
  } catch (_) {
    return null;
  }
}

async function deleteRepliesUnderCommentId(db, commentId) {
  const repliesSnap = await db
    .collection(GROUP_TOP_REPLIES)
    .where("commentId", "==", commentId)
    .get();
  const deletions = repliesSnap.docs.map((d) => d.ref.delete());
  if (deletions.length) await Promise.all(deletions);
  return repliesSnap.size;
}

async function deleteGroupCommentsByAuthor(db, uid, displayName) {
  let removed = 0;
  // Primary: by uid
  const byUid = await db
    .collection(GROUP_TOP_COMMENTS)
    .where("uid", "==", uid)
    .get();
  for (const c of byUid.docs) {
    await deleteRepliesUnderCommentId(db, c.id).catch(() => {});
    await c.ref.delete();
    removed++;
  }
  // Fallback: by author displayName (in case older docs lack uid or mismatch)
  if (removed === 0 && displayName) {
    const byName = await db
      .collection(GROUP_TOP_COMMENTS)
      .where("author", "==", displayName)
      .get();
    for (const c of byName.docs) {
      await deleteRepliesUnderCommentId(db, c.id).catch(() => {});
      await c.ref.delete();
      removed++;
    }
  }
  return removed;
}

async function deleteGroupRepliesByAuthor(db, uid, displayName) {
  let removed = 0;
  // Primary: by uid
  const byUid = await db
    .collection(GROUP_TOP_REPLIES)
    .where("uid", "==", uid)
    .get();
  for (const r of byUid.docs) {
    await r.ref.delete();
    removed++;
  }
  // Fallback: by author displayName
  if (removed === 0 && displayName) {
    const byName = await db
      .collection(GROUP_TOP_REPLIES)
      .where("author", "==", displayName)
      .get();
    for (const r of byName.docs) {
      await r.ref.delete();
      removed++;
    }
  }
  return removed;
}

async function deleteTopLevelPostsByAuthor(db, uid) {
  let deleted = 0;
  const seen = new Set();
  for (const f of AUTHOR_FIELDS) {
    const qs = await db.collection("posts").where(f, "==", uid).get();
    for (const p of qs.docs) {
      if (seen.has(p.id)) continue;
      const commentsSnap = await p.ref
        .collection("comments")
        .get()
        .catch(() => null);
      if (commentsSnap) {
        for (const c of commentsSnap.docs) {
          const repliesSnap = await c.ref
            .collection("replies")
            .get()
            .catch(() => null);
          if (repliesSnap)
            for (const r of repliesSnap.docs) await r.ref.delete();
          await c.ref.delete();
        }
      }
      await p.ref.delete();
      deleted++;
      seen.add(p.id);
    }
  }
  return deleted;
}

async function deleteGroupPostsByAuthor(db, uid, displayName) {
  let deleted = 0;
  // Delete authored group posts and their associated groupComments/groupReplies
  for (const field of AUTHOR_FIELDS) {
    const qs = await db
      .collection(GROUP_TOP_POSTS)
      .where(field, "==", uid)
      .get();
    for (const gp of qs.docs) {
      const postId = gp.id;
      const commentsSnap = await db
        .collection(GROUP_TOP_COMMENTS)
        .where("postId", "==", postId)
        .get();
      for (const c of commentsSnap.docs) {
        await deleteRepliesUnderCommentId(db, c.id).catch(() => {});
        await c.ref.delete();
      }
      await gp.ref.delete();
      deleted++;
    }
  }
  // Fallback: if none matched by uid, try by author displayName
  if (deleted === 0 && displayName) {
    const byName = await db
      .collection(GROUP_TOP_POSTS)
      .where("author", "==", displayName)
      .get();
    for (const gp of byName.docs) {
      const postId = gp.id;
      const commentsSnap = await db
        .collection(GROUP_TOP_COMMENTS)
        .where("postId", "==", postId)
        .get();
      for (const c of commentsSnap.docs) {
        await deleteRepliesUnderCommentId(db, c.id).catch(() => {});
        await c.ref.delete();
      }
      await gp.ref.delete();
      deleted++;
    }
  }
  return deleted;
}

async function cascadeDeleteUserData(uid) {
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const FieldValue = admin.firestore.FieldValue;

  const counts = {
    deletedPosts: 0,
    deletedGroupPosts: 0,
    removedComments: 0,
    removedReplies: 0,
    removedLikesFromPosts: 0,
    removedLikesFromGroupPosts: 0,
    removedGroupMemberships: 0,
    removedGroupArrayEntries: 0,
    deletedProfile: 0,
    filteredInlineComments: 0,
    filteredInlineGroupComments: 0,
    deletedStoragePrefixes: 0,
  };

  // Resolve displayName for fallback matching
  const displayName = await getUserDisplayName(db, uid);

  // 1) Delete authored group comments and replies (top-level collections)
  try {
    counts.removedComments += await deleteGroupCommentsByAuthor(
      db,
      uid,
      displayName
    );
  } catch (e) {
    console.error("deleteGroupCommentsByAuthor", e);
  }
  try {
    counts.removedReplies += await deleteGroupRepliesByAuthor(
      db,
      uid,
      displayName
    );
  } catch (e) {
    console.error("deleteGroupRepliesByAuthor", e);
  }

  // 2) Remove likes and inline arrays from top-level posts
  try {
    const liked = await db
      .collection("posts")
      .where("likes", "array-contains", uid)
      .get();
    for (const d of liked.docs) {
      await d.ref.update({ likes: FieldValue.arrayRemove(uid) });
      counts.removedLikesFromPosts++;
    }
  } catch (e) {
    console.error("likes top-level", e);
  }

  try {
    const allPosts = await db.collection("posts").get();
    for (const d of allPosts.docs) {
      const data = d.data() || {};
      let changed = false;
      const update = {};
      if (Array.isArray(data.comments)) {
        const filtered = data.comments
          .filter(
            (c) =>
              c &&
              !AUTHOR_FIELDS.some((f) => c[f] === uid) &&
              (!displayName || c.author !== displayName)
          )
          .map((c) => {
            if (Array.isArray(c.replies)) {
              const nr = c.replies.filter(
                (r) =>
                  r &&
                  !AUTHOR_FIELDS.some((f) => r[f] === uid) &&
                  (!displayName || r.author !== displayName)
              );
              if (nr.length !== c.replies.length) changed = true;
              return { ...c, replies: nr };
            }
            return c;
          });
        if (filtered.length !== data.comments.length) {
          counts.filteredInlineComments +=
            data.comments.length - filtered.length;
          update.comments = filtered;
          changed = true;
        }
      }
      if (Array.isArray(data.likes) && data.likes.includes(uid)) {
        update.likes = FieldValue.arrayRemove(uid);
        changed = true;
      }
      if (changed) await d.ref.update(update).catch(() => {});
    }
  } catch (e) {
    console.error("inline arrays filter (top-level)", e);
  }

  // 3) Group posts: remove likes/inline arrays
  try {
    const gpAll = await db.collection(GROUP_TOP_POSTS).get();
    for (const d of gpAll.docs) {
      const data = d.data() || {};
      let changed = false;
      const update = {};
      if (Array.isArray(data.likes) && data.likes.includes(uid)) {
        update.likes = FieldValue.arrayRemove(uid);
        counts.removedLikesFromGroupPosts++;
        changed = true;
      }
      if (Array.isArray(data.comments)) {
        const filtered = data.comments
          .filter(
            (c) =>
              c &&
              !AUTHOR_FIELDS.some((f) => c[f] === uid) &&
              (!displayName || c.author !== displayName)
          )
          .map((c) => {
            if (Array.isArray(c.replies)) {
              const nr = c.replies.filter(
                (r) =>
                  r &&
                  !AUTHOR_FIELDS.some((f) => r[f] === uid) &&
                  (!displayName || r.author !== displayName)
              );
              if (nr.length !== c.replies.length) changed = true;
              return { ...c, replies: nr };
            }
            return c;
          });
        if (filtered.length !== data.comments.length) {
          counts.filteredInlineGroupComments +=
            data.comments.length - filtered.length;
          update.comments = filtered;
          changed = true;
        }
      }
      if (changed) await d.ref.update(update).catch(() => {});
    }
  } catch (e) {
    console.error("inline arrays filter (groupPosts)", e);
  }

  // 4) Delete authored top-level posts and group posts (and their related group comments)
  try {
    counts.deletedPosts += await deleteTopLevelPostsByAuthor(db, uid);
  } catch (e) {
    console.error("deleteTopLevelPostsByAuthor", e);
  }
  try {
    counts.deletedGroupPosts += await deleteGroupPostsByAuthor(
      db,
      uid,
      displayName
    );
  } catch (e) {
    console.error("deleteGroupPostsByAuthor", e);
  }

  // 5) Remove group memberships
  try {
    const groups = await db.collection("groups").get();
    for (const g of groups.docs) {
      const groupRef = db.collection("groups").doc(g.id);
      await groupRef
        .collection("members")
        .doc(uid)
        .delete()
        .catch(() => {});
      counts.removedGroupMemberships++;
      await groupRef
        .update({ members: FieldValue.arrayRemove(uid) })
        .catch(() => {});
      counts.removedGroupArrayEntries++;
    }
  } catch (e) {
    console.error("group membership removal", e);
  }

  // 6) Delete user profile doc
  try {
    await db.collection("users").doc(uid).delete();
    counts.deletedProfile = 1;
  } catch (e) {
    console.error("delete profile", e);
  }

  // 7) Storage cleanup
  try {
    const prefixes = [
      `avatars/${uid}`,
      `banners/${uid}`,
      `users/${uid}`,
      `user_uploads/${uid}`,
      `posts/${uid}`,
      `images/${uid}`,
    ];
    for (const prefix of prefixes) {
      try {
        await bucket.deleteFiles({ prefix, force: true });
        counts.deletedStoragePrefixes++;
      } catch (_) {}
    }
  } catch (e) {
    console.error("storage cleanup", e);
  }

  return counts;
}

exports.adminDeleteUser = functions
  .region("europe-west2")
  .https.onCall(async (data, context) => {
    try {
      if (!context.auth)
        throw new functions.https.HttpsError(
          "unauthenticated",
          "Authentication required."
        );
      const requesterUid = context.auth.uid;
      const uid = data && data.uid;
      if (!uid)
        throw new functions.https.HttpsError(
          "invalid-argument",
          "uid required"
        );

      const db = admin.firestore();
      let isAdmin = context.auth.token && context.auth.token.admin === true;
      if (!isAdmin) {
        const snap = await db.collection("users").doc(requesterUid).get();
        isAdmin = snap.exists && !!(snap.data() && snap.data().isAdmin);
      }
      if (!isAdmin)
        throw new functions.https.HttpsError(
          "permission-denied",
          "Admin only."
        );

      const counts = await cascadeDeleteUserData(uid);

      try {
        await admin.auth().deleteUser(uid);
      } catch (e) {
        const code = (e && e.code) || (e && e.errorInfo && e.errorInfo.code);
        if (code !== "auth/user-not-found") {
          console.error("deleteUser auth error", uid, e);
          throw new functions.https.HttpsError(
            "internal",
            e.message || "Failed to delete auth user"
          );
        }
      }

      console.log("adminDeleteUser counts", uid, counts);
      return { ok: true, ...counts };
    } catch (err) {
      console.error("adminDeleteUser error", err);
      if (err instanceof functions.https.HttpsError) throw err;
      throw new functions.https.HttpsError(
        "internal",
        (err && err.message) || "Internal error"
      );
    }
  });

// Optional background trigger
exports.onUserDeleted = functions
  .region("europe-west2")
  .auth.user()
  .onDelete(async (user) => {
    try {
      await cascadeDeleteUserData(user.uid);
    } catch (e) {
      console.error("onUserDeleted cascade", e);
    }
  });
