import { useState } from 'react';
import sidetab from "../icons/sidetab.png";
import Sidebar from '../components/Sidebar';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import mic from "../icons/voicePrompt.png";
import profile from "../icons/profile.png";
import location from "../icons/location.png";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const styles = {
    container: {
      display: 'flex',
      backgroundColor: '#f6f8fb',
      height: '100vh',
      fontFamily: 'Arial, sans-serif',
    },
    content: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '16px',
      position: 'relative',
    },
    topBar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    logo: {
      fontWeight: 'bold',
      color: '#1559EA',
      fontSize: '18px',
      lineHeight: '28px',
    },
    center: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    },
    assistantText: {
      backgroundColor: '#e6f0ff',
      padding: '16px',
      borderRadius: '12px',
      textAlign: 'left',
      marginBottom: '20px',
    },
    suggestion: {
      width: '240px',
      height: '38px',
      borderRadius: '12px',
      padding: '8px 12px',
      backgroundColor: '#DCEBFE',
      fontWeight: 500,
      fontSize: '14px',
      lineHeight: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      cursor: 'pointer',
      marginBottom: '10px',
      boxSizing: 'border-box',
    },
    suggestionsContainer: {
      position: 'absolute',
      bottom: '90px',
      right: '32px',
      zIndex: 10,
    },
    chatContainer: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '16px 0',
    },
    locationContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '12px 10px 12px 24px',
      borderRadius: '9999px',
      width: '146px',
      height: '32px',
    },
    icon: {
      width: '24px',
      height: '24px',
    },
    text: {
      fontWeight: 500,
      fontSize: '14px',
      lineHeight: '20px',
      color: '#1A1A1A',
      opacity: 0.36,
    },
    iconButton: {
      width: '44px',
      height: '44px',
      cursor: 'pointer',
    },
    micButton: {
      cursor: 'pointer',
    }
  };

  return (
    <div style={styles.container}>
      {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
      <div style={styles.content}>

        <div style={styles.topBar}>
          <img
            src={sidetab}
            alt="menu"
            style={styles.iconButton}
            onClick={() => setSidebarOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setSidebarOpen(true)}
          />
          <div style={styles.logo}>Logo</div>
          <img
            src={profile}
            alt="profile"
            style={styles.iconButton}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && console.log('Profile click')}
            onClick={() => console.log('Profile click')}
          />
        </div>

        <div style={styles.center}>
          {messages.length === 0 && (
            <>
              <div style={styles.locationContainer}>
                <img src={location} alt="location" style={styles.icon} />
                <span style={styles.text}>New York, NY</span>
              </div>

              <div style={styles.assistantText}>
                <strong>Hi, I'm <span style={{ color: '#1559EA' }}>LocalGenie</span></strong>
                <br />
                Your smart assistant for travel tips, safety, and planning—just say the word.
              </div>

              <img
                src={mic}
                style={styles.micButton}
                alt="mic"
                role="button"
                tabIndex={0}
                onClick={() => console.log('Mic clicked')}
                onKeyDown={(e) => e.key === 'Enter' && console.log('Mic clicked')}
              />
            </>
          )}

          <div style={styles.chatContainer}>
            {messages.map((msg, i) => (
              <ChatBubble key={i} text={msg.text} alignment={msg.from === 'user' ? 'right' : 'left'} />
            ))}
          </div>
        </div>

        {messages.length === 0 && (
          <div style={styles.suggestionsContainer}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={styles.suggestion}>
                Find a quiet café with Wi-Fi nearby
              </div>
            ))}
          </div>
        )}

        <ChatInput placeholder="Input your prompt" onSend={() => { }} />
      </div>
    </div>
  );
}

