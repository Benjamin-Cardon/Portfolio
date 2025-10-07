import React from "react";
import InfoButton from '../../misc/InfoButton.jsx';
export default function SubredditInfo({ layoutStyle }) {
  return (
    <div id='subredditInfoContainer' style={layoutStyle}>
      <InfoButton />
      <h1>Info</h1>
    </div>
  );
}
// let's include all of the subreddit information in a single component - it's the smallest component in the app, no need to overcomplicate