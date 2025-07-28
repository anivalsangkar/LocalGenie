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
