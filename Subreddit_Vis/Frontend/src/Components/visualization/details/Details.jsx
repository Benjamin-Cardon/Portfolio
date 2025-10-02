import React from "react";
import InfoButton from '../../misc/InfoButton.jsx';

export default function Details({ layoutStyle }) {
  return (
    <div id='detailsContainer' style={layoutStyle}>
      <InfoButton />
      <h1>Details</h1>
    </div>
  );
}