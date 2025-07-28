import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/location-logo-blue.png";
import { AiOutlineHome, AiOutlineSearch } from "react-icons/ai"; 

const SelectPersona = () => {
  const [selectedPersona, setSelectedPersona] = useState(null);
  //const navigate = useNavigate();

  const handleSelect = (persona) => {
    setSelectedPersona(persona);
    //next-step
  };

  const handleGetStarted = () => {
    if (selectedPersona) {
      console.log("Selected Persona:", selectedPersona);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img src={logo} alt="logo" style={styles.logo} />
        <h2 style={styles.title}>LocalGenie.ai</h2>
        <p style={styles.subtitle}>What brings you here today?</p>
        <p style={styles.caption}>Help LocalGenie tailor your experience</p>

        <div
          onClick={() => handleSelect("relocating")}
          style={{
            ...styles.option,
            ...(selectedPersona === "relocating" ? styles.selected : {}),
          }}
        >
          <div style={styles.iconWrapper}>
            <AiOutlineHome size={36} style={styles.icon} />
          </div>
          <div>
            <strong>Relocating</strong>
            <p style={styles.optionText}>I'm planning to move</p>
          </div>
        </div>

        <div
          onClick={() => handleSelect("exploring")}
          style={{
            ...styles.option,
            ...(selectedPersona === "exploring" ? styles.selected : {}),
          }}
        >
          <div style={styles.iconWrapper}>
            <AiOutlineSearch size={36} style={styles.icon} />
          </div>
          <div>
            <strong>Exploring</strong>
            <p style={styles.optionText}>
              I just want to learn more about an area
            </p>
          </div>
        </div>

        <button
          style={{
            ...styles.button,
            ...(selectedPersona ? {} : styles.disabledButton),
          }}
          onClick={handleGetStarted}
          disabled={!selectedPersona}
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

const styles = {
  page: {
    backgroundColor: "#f6f8fb",
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "white",
    padding: "30px",
    width: "360px",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    textAlign: "center",
    fontFamily: "Arial, sans-serif",
  },
  logo: {
    width: "30px",
    height: "30px",
    marginBottom: "12px",
  },
  title: {
    fontSize: "22px",
    fontWeight: "bold",
    marginBottom: "4px",
  },
  subtitle: {
    fontSize: "16px",
    fontWeight: "600",
    marginBottom: "4px",
  },
  caption: {
    fontSize: "14px",
    color: "#666",
    marginBottom: "16px",
  },
  option: {
    display: "flex",
    alignItems: "center",
    border: "1px solid #ccc",
    padding: "16px",
    borderRadius: "8px",
    marginBottom: "12px",
    cursor: "pointer",
    textAlign: "left",
    gap: "10px",
    transition: "border 0.2s ease",
  },
  selected: {
    borderColor: "#2563eb",
    backgroundColor: "#f0f6ff",
  },
  iconWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    marginRight: "10px",
  },
  icon: {
    color: "#2563eb",
  },
  optionText: {
    fontSize: "13px",
    color: "#555",
    marginTop: "4px",
  },
  button: {
    width: "100%",
    backgroundColor: "#2563eb",
    color: "white",
    padding: "10px",
    border: "none",
    borderRadius: "6px",
    fontWeight: "bold",
    fontSize: "14px",
    cursor: "pointer",
    marginTop: "10px",
  },
  disabledButton: {
    backgroundColor: "#cccccc",
    cursor: "not-allowed",
  },
};

export default SelectPersona;
