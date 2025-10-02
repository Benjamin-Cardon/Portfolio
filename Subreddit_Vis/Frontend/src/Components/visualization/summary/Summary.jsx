import React from "react";
import InfoButton from '../../misc/InfoButton.jsx';
import SummaryGraph from './SummaryGraph.jsx';
export default function Summary({ layoutStyle }) {
  return (
    <div id='summaryContainer' style={{ ...layoutStyle, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'stretch', gap: '1vw', padding: '1.5vw' }}>
      <InfoButton />
      <SummaryGraph />
      <h3> Word/User, Percentile, Share </h3>
    </div >
  );
}