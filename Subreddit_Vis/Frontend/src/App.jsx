import React from "react";
import Visualization from './Components/visualization/Visualization';
import Search from './Components/search/Search';
export default function App() {
  const currentlyworkingon = true;

  return (
    <div className='debug'>
      {currentlyworkingon ? <Visualization /> : <Search />}
    </div>
  );
}