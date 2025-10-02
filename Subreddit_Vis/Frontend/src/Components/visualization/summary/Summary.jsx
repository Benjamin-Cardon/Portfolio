import React from "react";
import InfoButton from '../../misc/InfoButton.jsx';
export default function Summary({ layoutStyle }) {
  return (
    <div id='summaryContainer' style={layoutStyle}>
      <InfoButton />
      <h1>Summary</h1>
    </div>
  );
}