import React from "react";
import InfoButton from '../../misc/InfoButton.jsx';
import DisplayOptionsConnection from './DisplayOptionsConnection.jsx';
import DisplayOptionsGeneral from './DisplayOptionsGeneral.jsx';
import DisplayOptionsUsers from './DisplayOptionsUsers.jsx';
import DisplayOptionsWords from './DisplayOptionsWords.jsx';
export default function DisplayOptions({ layoutStyle }) {
  return (
    <div id='displayOptionsContainer' style={{ ...layoutStyle, Display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'stretch' }}>
      <InfoButton layoutStyle={{}} />
      <DisplayOptionsGeneral layoutStyle={{}} />
      <DisplayOptionsUsers layoutStyle={{}} />
      <DisplayOptionsWords layoutStyle={{}} />
      <DisplayOptionsConnection layoutStyle={{}} />

    </div >
  );
}
// Display options will conditionally display 4 different display option bites in the panel. The first iis general display, which will always be visible.
