import React from "react";
import InfoButton from '../../misc/InfoButton.jsx';
import PaginationArrow from './PaginationArrow.jsx';
import PaginationBite from './PaginationBite.jsx';

export default function DiscourseVisualization({ layoutStyle }) {
  return (
    <div id='discourseVisualizationContainer' style={layoutStyle}>
      <InfoButton />
      <PaginationArrow />
      <PaginationBite />
      <PaginationArrow />
    </div >
  );
}