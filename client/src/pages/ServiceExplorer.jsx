import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import sidetab from "../icons/sidetab.png";
import profile from "../icons/profile.png";

const services = [
  { id: 1, name: "Plumbing", emoji: "🔧" },
  { id: 2, name: "Home Cleaning", emoji: "🧹" },
  { id: 3, name: "Electrician", emoji: "💡" },
  { id: 4, name: "Grocery Delivery", emoji: "🛒" },
  { id: 5, name: "AC Repair", emoji: "❄️" },
  { id: 6, name: "Car Service", emoji: "🚗" },
  { id: 7, name: "Internet Setup", emoji: "🌐" },
  { id: 8, name: "Laundry", emoji: "🧺" },
];

export default function ServiceExplorer() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredServices = services.filter((service) =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const styles = {
    page: {
      display: "flex",
      height: "100vh",
      backgroundColor: "#f6f8fb",
      fontFamily: "Arial, sans-serif",
    },
    sidebarWrapper: {
      position: "relative",
    },
    content: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "16px",
    },
    topBar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      padding: "16px 0",
    },
    iconButton: {
      width: "36px",
      height: "36px",
      cursor: "pointer",
    },
    logo: {
      fontSize: "20px",
      fontWeight: "bold",
      color: "#1559EA",
    },
    searchBox: {
      padding: "10px 16px",
      fontSize: "16px",
      width: "60%",
      maxWidth: "400px",
      marginBottom: "24px",
      borderRadius: "8px",
      border: "1px solid #ccc",
      outline: "none",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
      gap: "16px",
      width: "100%",
      maxWidth: "800px",
    },
    card: {
      backgroundColor: "#ffffff",
      borderRadius: "12px",
      padding: "20px",
      textAlign: "center",
      fontSize: "16px",
      fontWeight: "500",
      boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
      cursor: "pointer",
      transition: "transform 0.2s",
    },
  };

  return (
    <div style={styles.page}>
      {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}

      <div style={styles.content}>
        <div style={styles.topBar}>
          <img
            src={sidetab}
            alt="menu"
            style={styles.iconButton}
            onClick={() => setSidebarOpen(true)}
          />
          <div style={styles.logo}>LocalGenie</div>
          <img src={profile} alt="Profile" style={styles.iconButton} />
        </div>

        <input
          type="text"
          placeholder="Search for a service..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchBox}
        />

        <div style={styles.grid}>
          {filteredServices.map((service) => (
            <div key={service.id} style={styles.card}>
              <div style={{ fontSize: "32px" }}>{service.emoji}</div>
              {service.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
