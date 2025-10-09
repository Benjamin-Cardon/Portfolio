import React from "react";
import InfoButton from '../../misc/InfoButton.jsx';
import DetailsGraphVis from './DetailsGraphVis.jsx';
import DetailsHeader from './DetailsHeader.jsx';
import DetailsIntroInfo from './DetailsIntroInfo.jsx';
import DetailsList from './DetailsList.jsx';

export default function Details({ layoutStyle }) {
  return (
    <div id='detailsContainer' style={{ ...layoutStyle, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '.5vw' }}>
      <InfoButton />
      <DetailsHeader layoutStyle={{}} />
      <DetailsIntroInfo layoutStyle={{}} />
      <DetailsList layoutStyle={{}} />
      <DetailsGraphVis layoutStyle={{}} />
    </div>
  );
}