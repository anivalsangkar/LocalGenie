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
