import React from "react";
import InfoButton from '../../misc/InfoButton.jsx';

export default function DiscourseVisualization({ layoutStyle }) {
  return (
    <div id='discourseVisualizationContainer' style={layoutStyle}>
      <InfoButton />
      <h1>Visualization</h1>
    </div >
  );
}