import { useState, useRef } from "react";
import send from "../icons/send.png";
import mic from "../icons/voicePrompt.png";

export default function ChatInput({ placeholder, onSend }) {
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const styles = {
    container: {
      display: 'flex',
      alignItems: 'center',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      padding: '8px 12px',
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
      fontFamily: 'Arial, sans-serif',
    },
    input: {
      flex: 1,
      border: 'none',
      outline: 'none',
      fontSize: '14px',
      padding: '8px',
      fontFamily: 'inherit',
    },
    icon: {
      width: '20px',
      height: '20px',
      marginLeft: '10px',
      cursor: 'pointer',
    },
  };

  const handleSend = () => {
    if (inputText.trim() !== "") {
      onSend(inputText);
      setInputText("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  const handleMicClick = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          try {
            const res = await fetch('http://localhost:5050/api/whisper', {
              method: 'POST',
              body: formData
            });

            const data = await res.json();
            if (data.text) {
              onSend(data.text); // Send transcribed text
            } else {
              alert('No text detected from audio');
            }
          } catch (err) {
            console.error('Error sending audio to Whisper:', err);
            alert("Whisper transcription failed");
          }
        };

        mediaRecorder.start();
        setIsRecording(true);

        // Optional: stop after 10 seconds max
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            setIsRecording(false);
          }
        }, 10000);
      } catch (err) {
        console.error('Microphone access error:', err);
        alert("Microphone access denied or not supported.");
      }
    } else {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div style={styles.container}>
      <input
        type="text"
        placeholder={placeholder}
        style={styles.input}
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        onClick={handleSend}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
      >
        <img src={send} alt="Send" style={styles.icon} />
      </button>
      <button
        onClick={handleMicClick}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
      >
        <img
          src={mic}
          alt="Mic"
          style={{
            ...styles.icon,
            filter: isRecording ? "drop-shadow(0 0 5px red)" : "none"
          }}
        />
      </button>
    </div>
  );
}







/*
import { useState } from "react";
import send from "../icons/send.png";

export default function ChatInput({ placeholder, onSend }) {
  const [inputText, setInputText] = useState("");

  const styles = {
    container: {
      display: 'flex',
      alignItems: 'center',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      padding: '8px 12px',
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
      fontFamily: 'Arial, sans-serif',
    },
    input: {
      flex: 1,
      border: 'none',
      outline: 'none',
      fontSize: '14px',
      padding: '8px',
      fontFamily: 'inherit',
    },
    icon: {
      width: '20px',
      height: '20px',
      marginLeft: '10px',
      cursor: 'pointer',
    },
  };

  const handleSend = () => {
    if (inputText.trim() !== "") {
      onSend(inputText);
      setInputText("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div style={styles.container}>
      <input
        type="text"
        placeholder={placeholder}
        style={styles.input}
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        onClick={handleSend}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
      >
        <img src={send} alt="Send" style={styles.icon} />
      </button>
    </div>
  );
}
*/


/*
import send from "../icons/send.png"

export default function ChatInput({ placeholder }) {
    const styles = {
        container: {
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '8px 12px',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
            fontFamily: 'Arial, sans-serif',
        },
        input: {
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: '14px',
            padding: '8px',
            fontFamily: 'inherit',
        },
        icon: {
            width: '20px',
            height: '20px',
            marginLeft: '10px',
            cursor: 'pointer',
        },
    };

    return (
        <div style={styles.container}>
            <input type="text" placeholder={placeholder} style={styles.input} />
            <button style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                <img src={send} alt="Send" style={styles.icon} />
            </button>
        </div>
    );
}
*/