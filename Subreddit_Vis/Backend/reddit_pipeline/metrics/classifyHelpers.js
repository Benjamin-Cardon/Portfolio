export function classify_comment(comment) {
  const body = (comment.data.body || "").trim();
  const author = comment.data.author
  const isEmptyText = body.length === 0;
  const isDeletedText = body === "[deleted]";
  const isRemovedText = body === "[removed]";
  const isNotValidText = isEmptyText || isDeletedText || isRemovedText
  const isDeletedAuthor = author == "[deleted]"
  const isAutoModAuthor = author == "AutoModerator"
  const isLikelyBot = isAutoModAuthor || /bot$/i.test(author || "");
  const isRepliedTo = comment.data?.replies?.data?.children?.length ?? 0 > 0;
  return { isEmptyText, isDeletedText, isRemovedText, isDeletedAuthor, isAutoModAuthor, isLikelyBot, isRepliedTo, isNotValidText }
}

export function classify_post(post) {
  const rawTitle = (post.data.title || "").trim();
  const rawSelftext = (post.data.selftext || "").trim();
  const author = (post.data.author || "").trim();

  const isTitleDeleted = rawTitle === "[deleted]";
  const isTitleRemoved = rawTitle === "[removed]";
  const isBodyDeleted = rawSelftext === "[deleted]";
  const isBodyRemoved = rawSelftext === "[removed]";

  const hasTitleText = rawTitle.length > 0 && !isTitleDeleted && !isTitleRemoved;
  const hasBodyText = rawSelftext.length > 0 && !isBodyDeleted && !isBodyRemoved;

  // This is the key: any real text at all → valid
  const hasAnyText = hasTitleText || hasBodyText;
  const isNotValidText = !hasAnyText;
  const isDeletedAuthor = author === "[deleted]";
  const isAutoModAuthor = author === "AutoModerator";
  const isLikelyBot = isAutoModAuthor || /bot$/i.test(author || "");
  const isRepliedTo = post.data.num_comments > 0;
  return { isDeletedAuthor, isAutoModAuthor, isLikelyBot, isNotValidText, isRepliedTo }
}