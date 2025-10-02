import React from 'react';
import infoIcon from './info-button-icon.jpg';

export default function InfoButton() {
  return <div style={{ position: 'absolute', top: '2px', right: '2px' }}>
    <img src={infoIcon} height='15vw' length='15vw'></img>
  </div >
}