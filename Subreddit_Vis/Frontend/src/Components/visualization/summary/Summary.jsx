import React from "react";
import InfoButton from '../../misc/InfoButton.jsx';
import SummaryGraph from './SummaryGraph.jsx';
export default function Summary({ layoutStyle }) {
  return (
    <div id='summaryContainer' style={{ ...layoutStyle, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'stretch', gap: '.5vw', padding: '1.5vw' }}>

      <InfoButton />
      <SummaryGraph />
      <h3> Word/User, Percentile, Share </h3>
    </div >
  );
}
// The summary graph should be concious of who is selected, (who is mouse overed?), and use the filtered data to display where they fall onto the distribution of users as a logarithmically shortened histogram graph. The summary field should display the information quantitatively.
// Sizing at this point is partially an issue of font-size. The text in the box isn't changing dynamically, so it squishes the graph upon resize.