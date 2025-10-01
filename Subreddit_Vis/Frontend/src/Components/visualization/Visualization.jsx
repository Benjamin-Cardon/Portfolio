import React from "react";

import Summary from './summary/Summary';
import Details from './details/Details';
import DataSelection from './data_selection/DataSelection';
import SubredditInfo from './subreddit_info/SubredditInfo';
import DisplayOptions from './display_options/DisplayOptions';
import DiscourseVisualization from './discourse_visualization/DiscourseVisualization';

export default function Visualization() {
  return (
    <div id='vizualization_main_grid' className='debug-grid' style={{
      display: 'grid', gridTemplateColumns: '2fr 7fr 1fr', gridTemplateRows: '1fr 1fr 8fr', height: 'calc(100vh - 30px)', width: 'calc(100vw - 30px)'
    }}>
      <Summary layoutStyle={{ gridColumnStart: '1', gridColumnEnd: '1', gridRowStart: '1', gridRowEnd: '3', placeSelf: 'stretch', margin: '0', padding: '1.5vw' }} />
      <Details layoutStyle={{ gridColumnStart: '1', gridColumnEnd: '1', gridRowStart: '3', gridRowEnd: '4', placeSelf: 'stretch', margin: '0', padding: '1.5vw' }} />
      <DataSelection layoutStyle={{ gridColumnStart: '2', gridColumnEnd: '2', gridRowStart: '1', gridRowEnd: '1', placeSelf: 'stretch', margin: '0', padding: '1.5vw' }} />
      <SubredditInfo layoutStyle={{ gridColumnStart: '3', gridColumnEnd: '3', gridRowStart: '1', gridRowEnd: '1', placeSelf: 'stretch', margin: '0', padding: '1.5vw' }} />
      <DisplayOptions layoutStyle={{ gridColumnStart: '3', gridColumnEnd: '3', gridRowStart: '2', gridRowEnd: '4', placeSelf: 'stretch', margin: '0', padding: '1.5vw' }} />
      <DiscourseVisualization layoutStyle={{ gridColumnStart: '2', gridColumnEnd: '2', gridRowStart: '2', gridRowEnd: '4', placeSelf: 'stretch', margin: '0', padding: '1.5vw' }} />
    </div>
  );
}