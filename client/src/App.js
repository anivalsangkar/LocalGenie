import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import SplashScreen from "./pages/SplashScreen";
import Signup from "./pages/Signup";
import CreateAccount from "./pages/CreateAccount";
import SelectPersona from "./pages/SelectPersona";
import Home from "./pages/Home";
import ServiceExplorer from "./pages/ServiceExplorer";

// NEW: relocation flow pages
import ProfileSetup1 from "./pages/ProfileSetup1";
import ProfileSetup2 from "./pages/ProfileSetup2";
import ProfileSetup3 from "./pages/ProfileSetup3";
import RelocationResults from "./pages/RelocationResults";

// Details + Explore pages
import AreaDetails from "./pages/AreaDetails";
import ExploreMore from "./pages/ExploreMore";
import CompareAreas from "./pages/CompareAreas"; // ⬅️ NEW

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/select-persona" element={<SelectPersona />} />
        <Route path="/home" element={<Home />} />
        <Route path="/services" element={<ServiceExplorer />} />

        <Route path="/profile-setup-1" element={<ProfileSetup1 />} />
        <Route path="/profile-setup-2" element={<ProfileSetup2 />} />
        <Route path="/profile-setup-3" element={<ProfileSetup3 />} />
        <Route path="/relocation-results" element={<RelocationResults />} />

        {/* Explore → Detail page */}
        <Route path="/areas/:slug" element={<AreaDetails />} />
        {/* Detail → Explore More page */}
        <Route path="/areas/:slug/explore" element={<ExploreMore />} />
        {/* Detail → Compare Areas page */}
        <Route path="/areas/:slug/compare" element={<CompareAreas />} /> {/* ⬅️ NEW */}
      </Routes>
    </Router>
  );
}

export default App;




/*
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import SplashScreen from "./pages/SplashScreen";
import Signup from "./pages/Signup";
import CreateAccount from "./pages/CreateAccount";
import SelectPersona from "./pages/SelectPersona";
import Home from "./pages/Home";
import ServiceExplorer from "./pages/ServiceExplorer";

// NEW: relocation flow pages
import ProfileSetup1 from "./pages/ProfileSetup1";
import ProfileSetup2 from "./pages/ProfileSetup2";
import ProfileSetup3 from "./pages/ProfileSetup3";
import RelocationResults from "./pages/RelocationResults";

// Details + Explore pages
import AreaDetails from "./pages/AreaDetails";
import ExploreMore from "./pages/ExploreMore"; // ⬅️ NEW

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/select-persona" element={<SelectPersona />} />
        <Route path="/home" element={<Home />} />
        <Route path="/services" element={<ServiceExplorer />} />

        <Route path="/profile-setup-1" element={<ProfileSetup1 />} />
        <Route path="/profile-setup-2" element={<ProfileSetup2 />} />
        <Route path="/profile-setup-3" element={<ProfileSetup3 />} />
        <Route path="/relocation-results" element={<RelocationResults />} />

        
        <Route path="/areas/:slug" element={<AreaDetails />} />
       
        <Route path="/areas/:slug/explore" element={<ExploreMore />} /> 
      </Routes>
    </Router>
  );
}

export default App;
*/


/*
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import SplashScreen from "./pages/SplashScreen";
import Signup from "./pages/Signup";
import CreateAccount from "./pages/CreateAccount";
import SelectPersona from "./pages/SelectPersona";
import Home from "./pages/Home";
import ServiceExplorer from "./pages/ServiceExplorer";

// NEW: relocation flow pages
import ProfileSetup1 from "./pages/ProfileSetup1";
import ProfileSetup2 from "./pages/ProfileSetup2";
import ProfileSetup3 from "./pages/ProfileSetup3";
import RelocationResults from "./pages/RelocationResults";

// NEW: details page for "Explore more"
import AreaDetails from "./pages/AreaDetails";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/select-persona" element={<SelectPersona />} />
        <Route path="/home" element={<Home />} />
        <Route path="/services" element={<ServiceExplorer />} />

        <Route path="/profile-setup-1" element={<ProfileSetup1 />} />
        <Route path="/profile-setup-2" element={<ProfileSetup2 />} />
        <Route path="/profile-setup-3" element={<ProfileSetup3 />} />
        <Route path="/relocation-results" element={<RelocationResults />} />

        
        <Route path="/areas/:slug" element={<AreaDetails />} />
      </Routes>
    </Router>
  );
}

export default App;
*/


/*
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import SplashScreen from "./pages/SplashScreen";
import Signup from "./pages/Signup";
import CreateAccount from "./pages/CreateAccount";
import SelectPersona from "./pages/SelectPersona";
import Home from "./pages/Home";
import ServiceExplorer from "./pages/ServiceExplorer";

// NEW: relocation flow pages
import ProfileSetup1 from "./pages/ProfileSetup1";
import ProfileSetup2 from "./pages/ProfileSetup2";
import ProfileSetup3 from "./pages/ProfileSetup3";
import RelocationResults from "./pages/RelocationResults"; // make sure this file exists

function App() {
  return (
    <Router>
      <Routes>
       
        <Route path="/" element={<SplashScreen />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/select-persona" element={<SelectPersona />} />
        <Route path="/home" element={<Home />} />
        <Route path="/services" element={<ServiceExplorer />} />

        
        <Route path="/profile-setup-1" element={<ProfileSetup1 />} />
        <Route path="/profile-setup-2" element={<ProfileSetup2 />} />
        <Route path="/profile-setup-3" element={<ProfileSetup3 />} />
        <Route path="/relocation-results" element={<RelocationResults />} />
      </Routes>
    </Router>
  );
}

export default App;
*/



/*
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Signup from "./pages/Signup";
import CreateAccount from "./pages/CreateAccount";
import SelectPersona from "./pages/SelectPersona";
import SplashScreen from "./pages/SplashScreen";
import Home from "./pages/Home";
import ServiceExplorer from "./pages/ServiceExplorer";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/select-persona" element={<SelectPersona />} />
        <Route path="/home" element={<Home />} />
        <Route path="/services" element={<ServiceExplorer />} />
      </Routes>
    </Router>
  );
}

export default App;
*/
/*()
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Signup from "./pages/Signup";
import CreateAccount from "./pages/CreateAccount";
import SelectPersona from "./pages/SelectPersona";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Signup />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/select-persona" element={<SelectPersona />} />
      </Routes>
    </Router>
  );
}

export default App;
*/
