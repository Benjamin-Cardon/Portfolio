import React from "react";
import InfoButton from '../../misc/InfoButton.jsx';

export default function DataSelection({ layoutStyle }) {
  return (
    <div id='dataSelectionContainer' style={{ ...layoutStyle, display: 'flex', flexDirection: 'row' }}>
      <InfoButton />
      <h1>Data Selection</h1>
    </div>
  );
}
