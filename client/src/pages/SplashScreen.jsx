import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/location-logo-blue.png";

const SplashScreen = () => {
    const [showText, setShowText] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Show slogan text after 2s
        const textTimer = setTimeout(() => setShowText(true), 2000);

        // Redirect to signup after 4s
        const redirectTimer = setTimeout(() => navigate("/signup"), 5000);

        return () => {
            clearTimeout(textTimer);
            clearTimeout(redirectTimer);
        };
    }, [navigate]);

    return (
        <div style={styles.page}>
            <img src={logo} alt="LocalGenie Logo" style={styles.logo} />
            {showText && (
                <div style={styles.textBox}>
                    <h2 style={styles.slogan}>Your pocket guide to every corner</h2>
                    <p style={styles.caption}>
                        Multi-modal AI that helps you plan in confidence.
                    </p>
                </div>
            )}
        </div>
    );
};

const styles = {
    page: {
        backgroundColor: "#f6f8fb",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        transition: "all 0.5s ease-in-out",
        fontFamily: "Arial, sans-serif",
    },
    logo: {
        width: "80px",
        height: "80px",
        marginBottom: "16px",
    },
    textBox: {
        textAlign: "center",
        animation: "fadeIn 1s ease-in-out",
    },
    slogan: {
        fontSize: "20px",
        fontWeight: "bold",
        marginBottom: "4px",
    },
    caption: {
        fontSize: "14px",
        color: "#666",
    },
};

export default SplashScreen;

