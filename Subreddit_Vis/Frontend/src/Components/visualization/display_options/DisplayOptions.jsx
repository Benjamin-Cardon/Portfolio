import React from "react";
import InfoButton from '../../misc/InfoButton.jsx';
export default function DisplayOptions({ layoutStyle }) {
  return (
    <div id='displayOptionsContainer' style={layoutStyle}>
      <InfoButton />
      <h1>opt</h1>
    </div>
  );
}