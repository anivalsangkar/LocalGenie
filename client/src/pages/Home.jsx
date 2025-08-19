import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import sidetab from "../icons/sidetab.png";
import Sidebar from '../components/Sidebar';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import mic from "../icons/voicePrompt.png";
import profile from "../icons/profile.png";
import location from "../icons/location.png";
import logoImg from "../assets/location-logo-blue.png";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const navigate = useNavigate();

  // Refs for recording lifecycle
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const listenTimerRef = useRef(null);
  const streamRef = useRef(null);
  const navigatingRef = useRef(false); // prevent double navigation race

  // ✅ Persona -> relocation mode:
  const initialPersona = localStorage.getItem('persona'); // 'relocating' | 'exploring' | null
  const [relocationMode] = useState(initialPersona === 'relocating');

  // Stable session id per tab
  const sessionId = useMemo(
    () => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  // ---------- intent + extraction ----------
  const detectRelocationIntent = (text) => {
    const t = (text || "").toLowerCase();
    const keys = [
      "planning to move", "plan to move",
      "move to", "moving to", "moving in", "moving",
      "relocate to", "relocating to", "relocation",
      "where should i live", "what should i prepare"
    ];
    return keys.some(k => t.includes(k));
  };

  // grabs place after "to" or "in", allows state abbreviations (e.g., ", CA")
  const extractLocation = (text) => {
    const m =
      (text || "").match(
        /(?:to|in)\s+([A-Za-z][A-Za-z\s]+?(?:,\s*[A-Za-z]{2})?)(?:\?|\.|,|$)/i
      );
    return m ? m[1].trim() : "";
  };

  // ---------------------- helpers ----------------------
  const getSupportedMimeType = () => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/webm',
      'audio/ogg'
    ];
    for (const type of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(type)) return type;
      } catch {}
    }
    return ''; // let browser decide
  };

  const toast = (msg) => alert(msg); // swap for your Snackbar/Toast

  const stopListeningSafely = () => {
    if (listenTimerRef.current) {
      clearTimeout(listenTimerRef.current);
      listenTimerRef.current = null;
    }
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch {}
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    } catch {}
    setIsRecording(false);
  };

  // 🔊 Gate TTS behind a flag (speakIt)
  const handleSend = async (text, speakIt = false) => {
    const cleaned = (text || '').trim();
    if (!cleaned) return;

    // show user's message
    setMessages(prev => [...prev, { from: 'user', text: cleaned }]);

    // 👉 If the message looks like a relocation question, jump to the wizard
    if (detectRelocationIntent(cleaned)) {
      if (!navigatingRef.current) {
        navigatingRef.current = true;
        // show a single ack bubble
        setMessages(prev => [...prev, { from: 'bot', text: "Great! Let’s help you get started" }]);
        const destination = extractLocation(cleaned);
        navigate("/profile-setup-1", {
          state: { destination, initialQuery: cleaned }
        });
        // allow future navigations after a short tick
        setTimeout(() => { navigatingRef.current = false; }, 250);
      }
      return; // stop normal chat flow
    }

    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5050/api/generate', {
        prompt: cleaned,
        sessionId,
        relocationMode
      });

      const reply = (res.data?.reply || "Sorry, I didn’t catch that. Try again.").trim();
      setMessages(prev => [...prev, { from: 'bot', text: reply }]);

      if (speakIt && reply) {
        try { window.speechSynthesis.cancel(); } catch {}
        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.lang = 'en-US';
        utterance.rate = 1;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error('OpenAI API error:', err);
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: '⚠️ Sorry, something went wrong. Please try again.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleMicClick = async () => {
    // toggle stop if already recording
    if (isRecording) {
      stopListeningSafely();
      return;
    }

    chunksRef.current = [];

    try {
      // 1) Ask for mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 2) Choose a supported mime type
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;

      // 3) Collect chunks
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      // 4) Start recording
      const SLICE_MS = 200;
      setIsRecording(true);
      mediaRecorder.start(SLICE_MS);

      // ⏱️ Auto-stop after N seconds
      listenTimerRef.current = setTimeout(() => {
        stopListeningSafely();
      }, 8000);

      // Record ~5s
      await new Promise((r) => setTimeout(r, 5000));

      // 5) Flush and stop
      mediaRecorder.requestData();
      await new Promise((resolve) => {
        mediaRecorder.onstop = resolve;
        mediaRecorder.stop();
      });

      // 6) Stop tracks & cleanup UI state
      stopListeningSafely();

      // 7) Build audio blob
      const blobType = mimeType || 'audio/webm';
      const ext = /ogg/.test(blobType) ? 'ogg' : 'webm';
      const blob = new Blob(chunksRef.current, { type: blobType });

      // rough duration estimate
      const approxDurationMs = chunksRef.current.length * 200;

      // client-side sanity guard
      const MIN_BYTES = 2000; // ~2KB
      const MIN_MS = 600;     // ~0.6s
      if (blob.size < MIN_BYTES || approxDurationMs < MIN_MS) {
        toast("No speech detected. Try speaking a bit longer and closer to the mic.");
        return;
      }

      const formData = new FormData();
      formData.append('audio', blob, `voice.${ext}`);

      // 8) Send to Whisper
      const { data } = await axios.post(
        'http://localhost:5050/api/whisper/transcribe',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const transcribedText = (data?.transcript || '').trim();
      if (data?.warning === 'no_text' || !transcribedText) {
        toast('No text detected from audio. Please speak clearly and try again.');
        return;
      }

      // Voice path → speak the answer too.
      // If this is a relocation-style utterance, handleSend will navigate.
      handleSend(transcribedText, true);
    } catch (err) {
      console.error('Mic/Whisper error:', err);
      toast('Microphone or transcription failed. Check permissions and server logs.');
      stopListeningSafely();
    }
  };

  const styles = {
    container: { display: 'flex', backgroundColor: '#f6f8fb', height: '100vh', fontFamily: 'Arial, sans-serif' },
    content: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px', position: 'relative' },
    topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    logoImg: { height: '40px', objectFit: 'contain' },
    modePill: { marginLeft: 12, padding: '6px 10px', borderRadius: 999, fontSize: 12, background: '#DCEBFE', color: '#1559EA' },
    center: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
    assistantText: { backgroundColor: '#e6f0ff', padding: '16px', borderRadius: '12px', textAlign: 'left', marginBottom: '20px' },
    suggestion: { width: '320px', height: '38px', borderRadius: '12px', padding: '8px 12px', backgroundColor: '#DCEBFE', fontWeight: 500, fontSize: '14px', lineHeight: '20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', cursor: 'pointer', marginBottom: '10px', boxSizing: 'border-box' },
    suggestionsContainer: { position: 'absolute', bottom: '90px', right: '32px', zIndex: 10 },
    chatContainer: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px 0', width: '100%' },
    locationContainer: { display: 'flex', alignItems: 'center', gap: '4px', padding: '12px 10px 12px 24px', borderRadius: '9999px', width: '146px', height: '32px' },
    icon: { width: '24px', height: '24px' },
    text: { fontWeight: 500, fontSize: '14px', lineHeight: '20px', color: '#1A1A1A', opacity: 0.36 },
    iconButton: { width: '44px', height: '44px', cursor: 'pointer' },
    micButton: { cursor: 'pointer', filter: isRecording ? 'drop-shadow(0 0 8px #1559EA)' : 'none' },
    loadingText: { fontSize: '14px', color: '#888', marginTop: '10px' }
  };

  return (
    <div style={styles.container}>
      {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
      <div style={styles.content}>
        <div style={styles.topBar}>
          <img src={sidetab} alt="menu" style={styles.iconButton} onClick={() => setSidebarOpen(true)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={logoImg} alt="LocalGenie Logo" style={styles.logoImg} />
            {relocationMode && <div style={styles.modePill}>Relocating mode</div>}
          </div>
          <img src={profile} alt="profile" style={styles.iconButton} />
        </div>

        <div style={styles.center}>
          {messages.length === 0 && (
            <>
              <div style={styles.locationContainer}>
                <img src={location} alt="location" style={styles.icon} />
                <span style={styles.text}>New York, NY</span>
              </div>

              <div style={styles.assistantText}>
                <strong>Hi, I'm <span style={{ color: '#1559EA' }}>LocalGenie</span></strong><br />
                {relocationMode
                  ? 'Tell me about your move—city, budget, commute, safety, schools…'
                  : 'Ask me about neighborhoods, things to do, safety, and local tips.'}
              </div>

              <img
                src={mic}
                style={styles.micButton}
                alt={isRecording ? "Stop recording" : "Start recording"}
                onClick={handleMicClick}
                title={isRecording ? "Tap to stop" : "Tap to speak"}
              />
            </>
          )}

          <div style={styles.chatContainer}>
            {messages.map((msg, i) => (
              <ChatBubble key={i} text={msg.text} alignment={msg.from === 'user' ? 'right' : 'left'} />
            ))}
            {loading && <div style={styles.loadingText}>LocalGenie is thinking...</div>}
          </div>
        </div>

        {messages.length === 0 && (
          <div style={styles.suggestionsContainer}>
            {[
              "I’m planning to move to Los Angeles, CA soon, what should I prepare?",
              "I’m planning to move to Greenwood, CA soon, what should I prepare?",
              "Find a quiet café with Wi-Fi nearby",
              "Show top-rated hotels in San Francisco",
              "Is it safe to travel to downtown Chicago now?"
            ].map((s, i) => (
              <div key={i} style={styles.suggestion} onClick={() => handleSend(s, false)}>
                {s}
              </div>
            ))}
          </div>
        )}

        {/* ChatInput passes only text -> defaults to text-only reply */}
        <ChatInput placeholder="Input your prompt" onSend={handleSend} />
      </div>
    </div>
  );
}



/*
import { useState, useMemo, useRef } from 'react';
import axios from 'axios';

import sidetab from "../icons/sidetab.png";
import Sidebar from '../components/Sidebar';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import mic from "../icons/voicePrompt.png";
import profile from "../icons/profile.png";
import location from "../icons/location.png";
import logoImg from "../assets/location-logo-blue.png";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Refs for recording lifecycle
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const listenTimerRef = useRef(null);
  const streamRef = useRef(null);

  // ✅ Persona -> relocation mode:
  const initialPersona = localStorage.getItem('persona'); // 'relocating' | 'exploring' | null
  const [relocationMode] = useState(initialPersona === 'relocating');

  // Stable session id per tab
  const sessionId = useMemo(
    () => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  // ---------------------- helpers ----------------------
  const getSupportedMimeType = () => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/webm',
      'audio/ogg'
    ];
    for (const type of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(type)) return type;
      } catch {}
    }
    return ''; // let browser decide
  };

  const toast = (msg) => alert(msg); // swap for your Snackbar/Toast

  const stopListeningSafely = () => {
    if (listenTimerRef.current) {
      clearTimeout(listenTimerRef.current);
      listenTimerRef.current = null;
    }
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch {}
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    } catch {}
    setIsRecording(false);
  };

  // 🔊 Gate TTS behind a flag (speakIt)
  const handleSend = async (text, speakIt = false) => {
    const cleaned = (text || '').trim();
    if (!cleaned) return;

    const userMessage = { from: 'user', text: cleaned };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:5050/api/generate', {
        prompt: cleaned,
        sessionId,
        relocationMode
      });

      const reply = (res.data?.reply || "Sorry, I didn’t catch that. Try again.").trim();
      setMessages(prev => [...prev, { from: 'bot', text: reply }]);

      if (speakIt && reply) {
        try { window.speechSynthesis.cancel(); } catch {}
        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.lang = 'en-US';
        utterance.rate = 1;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error('OpenAI API error:', err);
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: '⚠️ Sorry, something went wrong. Please try again.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleMicClick = async () => {
    // toggle stop if already recording
    if (isRecording) {
      stopListeningSafely();
      return;
    }

    chunksRef.current = [];

    try {
      // 1) Ask for mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 2) Choose a supported mime type
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;

      // 3) Collect chunks
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      // 4) Start recording with a small timeslice for better duration estimate
      const SLICE_MS = 200;
      setIsRecording(true);
      mediaRecorder.start(SLICE_MS);

      // ⏱️ Auto-stop after N seconds to avoid hanging on silence
      listenTimerRef.current = setTimeout(() => {
        stopListeningSafely();
      }, 8000); // 8s max listen

      // Record ~5s (user can also tap the mic again to stop sooner)
      await new Promise((r) => setTimeout(r, 5000));

      // 5) Flush and stop
      mediaRecorder.requestData();
      await new Promise((resolve) => {
        mediaRecorder.onstop = resolve;
        mediaRecorder.stop();
      });

      // 6) Stop tracks & cleanup UI state
      stopListeningSafely();

      // 7) Build audio blob
      const blobType = mimeType || 'audio/webm';
      const ext = /ogg/.test(blobType) ? 'ogg' : 'webm';
      const blob = new Blob(chunksRef.current, { type: blobType });

      // rough duration estimate from chunk count * timeslice
      const approxDurationMs = chunksRef.current.length * 200;

      // client-side sanity guard (mirrors server tiny-blob guard)
      const MIN_BYTES = 2000; // ~2KB
      const MIN_MS = 600;     // ~0.6s
      if (blob.size < MIN_BYTES || approxDurationMs < MIN_MS) {
        toast("No speech detected. Try speaking a bit longer and closer to the mic.");
        return;
      }

      const formData = new FormData();
      formData.append('audio', blob, `voice.${ext}`);

      // 8) Send to Whisper
      const { data } = await axios.post(
        'http://localhost:5050/api/whisper/transcribe',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      // Backend now returns { transcript, warning? }
      const transcribedText = (data?.transcript || '').trim();
      if (data?.warning === 'no_text' || !transcribedText) {
        toast('No text detected from audio. Please speak clearly and try again.');
        return;
      }

      // Voice path → speak the answer too
      handleSend(transcribedText, true);
    } catch (err) {
      console.error('Mic/Whisper error:', err);
      toast('Microphone or transcription failed. Check permissions and server logs.');
      stopListeningSafely();
    }
  };

  const styles = {
    container: { display: 'flex', backgroundColor: '#f6f8fb', height: '100vh', fontFamily: 'Arial, sans-serif' },
    content: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px', position: 'relative' },
    topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    logoImg: { height: '40px', objectFit: 'contain' },
    modePill: { marginLeft: 12, padding: '6px 10px', borderRadius: 999, fontSize: 12, background: '#DCEBFE', color: '#1559EA' },
    center: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
    assistantText: { backgroundColor: '#e6f0ff', padding: '16px', borderRadius: '12px', textAlign: 'left', marginBottom: '20px' },
    suggestion: { width: '240px', height: '38px', borderRadius: '12px', padding: '8px 12px', backgroundColor: '#DCEBFE', fontWeight: 500, fontSize: '14px', lineHeight: '20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', cursor: 'pointer', marginBottom: '10px', boxSizing: 'border-box' },
    suggestionsContainer: { position: 'absolute', bottom: '90px', right: '32px', zIndex: 10 },
    chatContainer: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px 0', width: '100%' },
    locationContainer: { display: 'flex', alignItems: 'center', gap: '4px', padding: '12px 10px 12px 24px', borderRadius: '9999px', width: '146px', height: '32px' },
    icon: { width: '24px', height: '24px' },
    text: { fontWeight: 500, fontSize: '14px', lineHeight: '20px', color: '#1A1A1A', opacity: 0.36 },
    iconButton: { width: '44px', height: '44px', cursor: 'pointer' },
    micButton: { cursor: 'pointer', filter: isRecording ? 'drop-shadow(0 0 8px #1559EA)' : 'none' },
    loadingText: { fontSize: '14px', color: '#888', marginTop: '10px' }
  };

  return (
    <div style={styles.container}>
      {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
      <div style={styles.content}>
        <div style={styles.topBar}>
          <img src={sidetab} alt="menu" style={styles.iconButton} onClick={() => setSidebarOpen(true)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={logoImg} alt="LocalGenie Logo" style={styles.logoImg} />
            {relocationMode && <div style={styles.modePill}>Relocating mode</div>}
          </div>
          <img src={profile} alt="profile" style={styles.iconButton} />
        </div>

        <div style={styles.center}>
          {messages.length === 0 && (
            <>
              <div style={styles.locationContainer}>
                <img src={location} alt="location" style={styles.icon} />
                <span style={styles.text}>New York, NY</span>
              </div>

              <div style={styles.assistantText}>
                <strong>Hi, I'm <span style={{ color: '#1559EA' }}>LocalGenie</span></strong><br />
                {relocationMode
                  ? 'Tell me about your move—city, budget, commute, safety, schools…'
                  : 'Ask me about neighborhoods, things to do, safety, and local tips.'}
              </div>

              <img
                src={mic}
                style={styles.micButton}
                alt={isRecording ? "Stop recording" : "Start recording"}
                onClick={handleMicClick}
                title={isRecording ? "Tap to stop" : "Tap to speak"}
              />
            </>
          )}

          <div style={styles.chatContainer}>
            {messages.map((msg, i) => (
              <ChatBubble key={i} text={msg.text} alignment={msg.from === 'user' ? 'right' : 'left'} />
            ))}
            {loading && <div style={styles.loadingText}>LocalGenie is thinking...</div>}
          </div>
        </div>

        {messages.length === 0 && (
          <div style={styles.suggestionsContainer}>
            {[
              "Find a quiet café with Wi-Fi nearby",
              "Show top-rated hotels in San Francisco",
              "Is it safe to travel to downtown Chicago now?"
            ].map((s, i) => (
              <div key={i} style={styles.suggestion} onClick={() => handleSend(s, false)}>
                {s}
              </div>
            ))}
          </div>
        )}

        
        <ChatInput placeholder="Input your prompt" onSend={handleSend} />
      </div>
    </div>
  );
}
*/



/*
import { useState, useMemo } from 'react';
import axios from 'axios';

import sidetab from "../icons/sidetab.png";
import Sidebar from '../components/Sidebar';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import mic from "../icons/voicePrompt.png";
import profile from "../icons/profile.png";
import location from "../icons/location.png";
import logoImg from "../assets/location-logo-blue.png";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ Persona -> relocation mode:
  //    'relocating' => true, otherwise false (including 'exploring' or null)
  const initialPersona = localStorage.getItem('persona'); // 'relocating' | 'exploring' | null
  const [relocationMode] = useState(initialPersona === 'relocating');

  // Stable session id per tab
  const sessionId = useMemo(
    () => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  const handleSend = async (text) => {
    if (!text.trim()) return;

    const userMessage = { from: 'user', text };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:5050/api/generate', {
        prompt: text,
        sessionId,
        relocationMode
      });

      const reply = res.data.reply || "Sorry, I didn’t catch that. Try again.";
      const botMessage = { from: 'bot', text: reply };
      setMessages(prev => [...prev, botMessage]);

      // (kept) speak every reply
      const utterance = new SpeechSynthesisUtterance(reply);
      utterance.lang = 'en-US';
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('OpenAI API error:', err);
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: '⚠️ Sorry, something went wrong. Please try again.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleMicClick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'voice.webm');

        try {
          const response = await axios.post('http://localhost:5050/api/whisper/transcribe', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          const transcribedText = response.data.text;
          if (transcribedText) {
            handleSend(transcribedText);
          }
        } catch (err) {
          console.error('Whisper API error:', err);
        }
      };

      mediaRecorder.start();
      setTimeout(() => mediaRecorder.stop(), 5000);
    } catch (err) {
      console.error('Mic error:', err);
    }
  };

  const styles = {
    container: { display: 'flex', backgroundColor: '#f6f8fb', height: '100vh', fontFamily: 'Arial, sans-serif' },
    content: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px', position: 'relative' },
    topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    logoImg: { height: '40px', objectFit: 'contain' },
    modePill: { marginLeft: 12, padding: '6px 10px', borderRadius: 999, fontSize: 12, background: '#DCEBFE', color: '#1559EA' },
    center: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
    assistantText: { backgroundColor: '#e6f0ff', padding: '16px', borderRadius: '12px', textAlign: 'left', marginBottom: '20px' },
    suggestion: { width: '240px', height: '38px', borderRadius: '12px', padding: '8px 12px', backgroundColor: '#DCEBFE', fontWeight: 500, fontSize: '14px', lineHeight: '20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', cursor: 'pointer', marginBottom: '10px', boxSizing: 'border-box' },
    suggestionsContainer: { position: 'absolute', bottom: '90px', right: '32px', zIndex: 10 },
    chatContainer: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px 0', width: '100%' },
    locationContainer: { display: 'flex', alignItems: 'center', gap: '4px', padding: '12px 10px 12px 24px', borderRadius: '9999px', width: '146px', height: '32px' },
    icon: { width: '24px', height: '24px' },
    text: { fontWeight: 500, fontSize: '14px', lineHeight: '20px', color: '#1A1A1A', opacity: 0.36 },
    iconButton: { width: '44px', height: '44px', cursor: 'pointer' },
    micButton: { cursor: 'pointer' },
    loadingText: { fontSize: '14px', color: '#888', marginTop: '10px' }
  };

  return (
    <div style={styles.container}>
      {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
      <div style={styles.content}>
        <div style={styles.topBar}>
          <img src={sidetab} alt="menu" style={styles.iconButton} onClick={() => setSidebarOpen(true)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={logoImg} alt="LocalGenie Logo" style={styles.logoImg} />
            {relocationMode && <div style={styles.modePill}>Relocating mode</div>}
          </div>
          <img src={profile} alt="profile" style={styles.iconButton} />
        </div>

        <div style={styles.center}>
          {messages.length === 0 && (
            <>
              <div style={styles.locationContainer}>
                <img src={location} alt="location" style={styles.icon} />
                <span style={styles.text}>New York, NY</span>
              </div>

              <div style={styles.assistantText}>
                <strong>Hi, I'm <span style={{ color: '#1559EA' }}>LocalGenie</span></strong><br />
                {relocationMode
                  ? 'Tell me about your move—city, budget, commute, safety, schools…'
                  : 'Ask me about neighborhoods, things to do, safety, and local tips.'}
              </div>

              <img src={mic} style={styles.micButton} alt="mic" onClick={handleMicClick} />
            </>
          )}

          <div style={styles.chatContainer}>
            {messages.map((msg, i) => (
              <ChatBubble key={i} text={msg.text} alignment={msg.from === 'user' ? 'right' : 'left'} />
            ))}
            {loading && <div style={styles.loadingText}>LocalGenie is thinking...</div>}
          </div>
        </div>

        {messages.length === 0 && (
          <div style={styles.suggestionsContainer}>
            {[
              "Find a quiet café with Wi-Fi nearby",
              "Show top-rated hotels in San Francisco",
              "Is it safe to travel to downtown Chicago now?"
            ].map((s, i) => (
              <div key={i} style={styles.suggestion} onClick={() => handleSend(s)}>
                {s}
              </div>
            ))}
          </div>
        )}

        <ChatInput placeholder="Input your prompt" onSend={handleSend} />
      </div>
    </div>
  );
}
*/

/*
import { useState, useMemo } from 'react';
import axios from 'axios';

import sidetab from "../icons/sidetab.png";
import Sidebar from '../components/Sidebar';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import mic from "../icons/voicePrompt.png";
import profile from "../icons/profile.png";
import location from "../icons/location.png";
import logoImg from "../assets/location-logo-blue.png";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // 🔹 Relocation mode (ON by default) + stable sessionId
  const [relocationMode, setRelocationMode] = useState(true);
  const sessionId = useMemo(
    () => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  const handleSend = async (text) => {
    if (!text.trim()) return;

    const userMessage = { from: 'user', text };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:5050/api/generate', {
        prompt: text,
        sessionId,
        relocationMode
      });

      const reply = res.data.reply || "Sorry, I didn’t catch that. Try again.";
      const botMessage = { from: 'bot', text: reply };
      setMessages(prev => [...prev, botMessage]);

      // keep your current behavior (speaks for both text & voice)
      speak(reply);
    } catch (err) {
      console.error('OpenAI API error:', err);
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: '⚠️ Sorry, something went wrong. Please try again.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const speak = (text) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 1;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  };

  const handleMicClick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'voice.webm');

        try {
          const response = await axios.post('http://localhost:5050/api/whisper/transcribe', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          const transcribedText = response.data.text;
          if (transcribedText) {
            handleSend(transcribedText);
          }
        } catch (err) {
          console.error('Whisper API error:', err);
        }
      };

      mediaRecorder.start();
      setTimeout(() => mediaRecorder.stop(), 5000); // 5 sec voice input
    } catch (err) {
      console.error('Mic error:', err);
    }
  };

  // Toggle relocation mode; if turning ON, reset backend session so the flow starts fresh
  const toggleRelocationMode = async () => {
    const next = !relocationMode;
    setRelocationMode(next);

    if (next) {
      try {
        await axios.post('http://localhost:5050/api/generate', {
          prompt: '',
          sessionId,
          relocationMode: true,
          reset: true
        });
        setMessages(prev => [
          ...prev,
          { from: 'bot', text: 'Relocation mode is ON. I’ll ask a few quick questions to tailor your plan.' }
        ]);
      } catch (e) {
        console.error('Failed to reset relocation session', e);
      }
    }
  };

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
    logoImg: {
      height: '40px',
      objectFit: 'contain',
    },
    modePill: {
      marginLeft: 12,
      padding: '6px 10px',
      borderRadius: 999,
      fontSize: 12,
      background: relocationMode ? '#DCEBFE' : '#eee',
      color: relocationMode ? '#1559EA' : '#666',
      cursor: 'pointer',
      userSelect: 'none'
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
      width: '100%',
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
    },
    loadingText: {
      fontSize: '14px',
      color: '#888',
      marginTop: '10px',
    }
  };

  return (
    <div style={styles.container}>
      {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
      <div style={styles.content}>
        <div style={styles.topBar}>
          <img src={sidetab} alt="menu" style={styles.iconButton} onClick={() => setSidebarOpen(true)} />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src={logoImg} alt="LocalGenie Logo" style={styles.logoImg} />
            <div
              style={styles.modePill}
              onClick={toggleRelocationMode}
              title="Toggle relocation-guided mode"
            >
              Relocation: {relocationMode ? 'On' : 'Off'}
            </div>
          </div>
          <img src={profile} alt="profile" style={styles.iconButton} />
        </div>

        <div style={styles.center}>
          {messages.length === 0 && (
            <>
              <div style={styles.locationContainer}>
                <img src={location} alt="location" style={styles.icon} />
                <span style={styles.text}>New York, NY</span>
              </div>

              <div style={styles.assistantText}>
                <strong>Hi, I'm <span style={{ color: '#1559EA' }}>LocalGenie</span></strong><br />
                Your smart assistant for travel tips, safety, and planning—just say the word.
              </div>

            
              <img
                src={mic}
                style={styles.micButton}
                alt="mic"
                onClick={handleMicClick}
              />
            </>
          )}

          <div style={styles.chatContainer}>
            {messages.map((msg, i) => (
              <ChatBubble
                key={i}
                text={msg.text}
                alignment={msg.from === 'user' ? 'right' : 'left'}
              />
            ))}
            {loading && <div style={styles.loadingText}>LocalGenie is thinking...</div>}
          </div>
        </div>

        {messages.length === 0 && (
          <div style={styles.suggestionsContainer}>
            {[
              "I want to relocate to Los Angeles",
              "Best neighborhoods for families near Austin",
              "What’s the commute like in Seattle?"
            ].map((s, i) => (
              <div key={i} style={styles.suggestion} onClick={() => handleSend(s)}>
                {s}
              </div>
            ))}
          </div>
        )}

        <ChatInput placeholder="Input your prompt" onSend={handleSend} />
      </div>
    </div>
  );
}
*/



/*
import { useState } from 'react';
import axios from 'axios';

import sidetab from "../icons/sidetab.png";
import Sidebar from '../components/Sidebar';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import mic from "../icons/voicePrompt.png";
import profile from "../icons/profile.png";
import location from "../icons/location.png";
import logoImg from "../assets/location-logo-blue.png";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async (text) => {
    if (!text.trim()) return;

    const userMessage = { from: 'user', text };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:5050/api/generate', { prompt: text });
      const reply = res.data.reply || "Sorry, I didn’t catch that. Try again.";
      const botMessage = { from: 'bot', text: reply };
      setMessages(prev => [...prev, botMessage]);

      speak(reply); // ✅ Speak reply using TTS
    } catch (err) {
      console.error('OpenAI API error:', err);
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: '⚠️ Sorry, something went wrong. Please try again.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const handleMicClick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'voice.webm');

        try {
          const response = await axios.post('http://localhost:5050/api/whisper/transcribe', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          const transcribedText = response.data.text;
          if (transcribedText) {
            handleSend(transcribedText);
          }
        } catch (err) {
          console.error('Whisper API error:', err);
        }
      };

      mediaRecorder.start();
      setTimeout(() => mediaRecorder.stop(), 5000); // 5 sec voice input
    } catch (err) {
      console.error('Mic error:', err);
    }
  };

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
    logoImg: {
      height: '40px', // ✅ Adjust as needed
      objectFit: 'contain',
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
      width: '100%',
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
    },
    loadingText: {
      fontSize: '14px',
      color: '#888',
      marginTop: '10px',
    }
  };

  return (
    <div style={styles.container}>
      {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
      <div style={styles.content}>
        <div style={styles.topBar}>
          <img src={sidetab} alt="menu" style={styles.iconButton} onClick={() => setSidebarOpen(true)} />
          <img src={logoImg} alt="LocalGenie Logo" style={styles.logoImg} /> 
          <img src={profile} alt="profile" style={styles.iconButton} />
        </div>

        <div style={styles.center}>
          {messages.length === 0 && (
            <>
              <div style={styles.locationContainer}>
                <img src={location} alt="location" style={styles.icon} />
                <span style={styles.text}>New York, NY</span>
              </div>

              <div style={styles.assistantText}>
                <strong>Hi, I'm <span style={{ color: '#1559EA' }}>LocalGenie</span></strong><br />
                Your smart assistant for travel tips, safety, and planning—just say the word.
              </div>

             
              <img
                src={mic}
                style={styles.micButton}
                alt="mic"
                onClick={handleMicClick}
              />
            </>
          )}

          <div style={styles.chatContainer}>
            {messages.map((msg, i) => (
              <ChatBubble
                key={i}
                text={msg.text}
                alignment={msg.from === 'user' ? 'right' : 'left'}
              />
            ))}
            {loading && <div style={styles.loadingText}>LocalGenie is thinking...</div>}
          </div>
        </div>

        {messages.length === 0 && (
          <div style={styles.suggestionsContainer}>
            {[
              "Find a quiet café with Wi-Fi nearby",
              "Show top-rated hotels in San Francisco",
              "Is it safe to travel to downtown Chicago now?"
            ].map((s, i) => (
              <div key={i} style={styles.suggestion} onClick={() => handleSend(s)}>
                {s}
              </div>
            ))}
          </div>
        )}

        <ChatInput placeholder="Input your prompt" onSend={handleSend} />
      </div>
    </div>
  );
}
*/



/*
import { useState } from 'react';
import axios from 'axios';

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
  const [loading, setLoading] = useState(false);

  const handleSend = async (text) => {
    if (!text.trim()) return;

    const userMessage = { from: 'user', text };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:5050/api/generate', { prompt: text });
      const reply = res.data.reply || "Sorry, I didn’t catch that. Try again.";
      const botMessage = { from: 'bot', text: reply };
      setMessages(prev => [...prev, botMessage]);

      speak(reply); // ✅ Speak reply using TTS
    } catch (err) {
      console.error('OpenAI API error:', err);
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: '⚠️ Sorry, something went wrong. Please try again.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const handleMicClick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'voice.webm');

        try {
          const response = await axios.post('http://localhost:5050/api/whisper/transcribe', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          const transcribedText = response.data.text;
          if (transcribedText) {
            handleSend(transcribedText);
          }
        } catch (err) {
          console.error('Whisper API error:', err);
        }
      };

      mediaRecorder.start();
      setTimeout(() => mediaRecorder.stop(), 5000); // 5 sec voice input
    } catch (err) {
      console.error('Mic error:', err);
    }
  };

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
      width: '100%',
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
    },
    loadingText: {
      fontSize: '14px',
      color: '#888',
      marginTop: '10px',
    }
  };

  return (
    <div style={styles.container}>
      {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
      <div style={styles.content}>
        <div style={styles.topBar}>
          <img src={sidetab} alt="menu" style={styles.iconButton} onClick={() => setSidebarOpen(true)} />
          <div style={styles.logo}>Logo</div>
          <img src={profile} alt="profile" style={styles.iconButton} />
        </div>

        <div style={styles.center}>
          {messages.length === 0 && (
            <>
              <div style={styles.locationContainer}>
                <img src={location} alt="location" style={styles.icon} />
                <span style={styles.text}>New York, NY</span>
              </div>

              <div style={styles.assistantText}>
                <strong>Hi, I'm <span style={{ color: '#1559EA' }}>LocalGenie</span></strong><br />
                Your smart assistant for travel tips, safety, and planning—just say the word.
              </div>

              {/* ✅ Trigger voice recording on click }
              <img
                src={mic}
                style={styles.micButton}
                alt="mic"
                onClick={handleMicClick}
              />
            </>
          )}

          <div style={styles.chatContainer}>
            {messages.map((msg, i) => (
              <ChatBubble
                key={i}
                text={msg.text}
                alignment={msg.from === 'user' ? 'right' : 'left'}
              />
            ))}
            {loading && <div style={styles.loadingText}>LocalGenie is thinking...</div>}
          </div>
        </div>

        {messages.length === 0 && (
          <div style={styles.suggestionsContainer}>
            {[
              "Find a quiet café with Wi-Fi nearby",
              "Show top-rated hotels in San Francisco",
              "Is it safe to travel to downtown Chicago now?"
            ].map((s, i) => (
              <div key={i} style={styles.suggestion} onClick={() => handleSend(s)}>
                {s}
              </div>
            ))}
          </div>
        )}

        <ChatInput placeholder="Input your prompt" onSend={handleSend} />
      </div>
    </div>
  );
}
*/




/*
import { useState } from 'react';
import axios from 'axios';

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
  const [loading, setLoading] = useState(false);

  const handleSend = async (text) => {
    if (!text.trim()) return;

    const userMessage = { from: 'user', text };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:5050/api/generate', {
        prompt: text,
      });

      const reply = res.data.reply || "Sorry, I didn’t catch that. Try again.";
      const botMessage = { from: 'bot', text: reply };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error('OpenAI API error:', err);
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: '⚠️ Sorry, something went wrong. Please try again.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

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
      width: '100%',
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
    },
    loadingText: {
      fontSize: '14px',
      color: '#888',
      marginTop: '10px',
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
              <ChatBubble
                key={i}
                text={msg.text}
                alignment={msg.from === 'user' ? 'right' : 'left'}
              />
            ))}
            {loading && <div style={styles.loadingText}>LocalGenie is thinking...</div>}
          </div>
        </div>

        {messages.length === 0 && (
          <div style={styles.suggestionsContainer}>
            {[
              "Find a quiet café with Wi-Fi nearby",
              "Show top-rated hotels in San Francisco",
              "Is it safe to travel to downtown Chicago now?"
            ].map((s, i) => (
              <div key={i} style={styles.suggestion} onClick={() => handleSend(s)}>
                {s}
              </div>
            ))}
          </div>
        )}

        {/* ✅ Pass working handler to ChatInput }
        <ChatInput placeholder="Input your prompt" onSend={handleSend} />
      </div>
    </div>
  );
}
*/




/*
import { useState } from 'react';
import axios from 'axios';

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
  const [loading, setLoading] = useState(false);

  const handleSend = async (text) => {
    if (!text.trim()) return;

    const userMessage = { from: 'user', text };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:5050/api/generate', {
        prompt: text,
      });

      const reply = res.data.reply || "Sorry, I didn’t catch that. Try again.";
      const botMessage = { from: 'bot', text: reply };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error('OpenAI API error:', err);
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: '⚠️ Sorry, something went wrong. Please try again.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

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
      width: '100%',
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
    },
    loadingText: {
      fontSize: '14px',
      color: '#888',
      marginTop: '10px',
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
              <ChatBubble
                key={i}
                text={msg.text}
                alignment={msg.from === 'user' ? 'right' : 'left'}
              />
            ))}
            {loading && <div style={styles.loadingText}>LocalGenie is thinking...</div>}
          </div>
        </div>

        {messages.length === 0 && (
          <div style={styles.suggestionsContainer}>
            {[
              "Find a quiet café with Wi-Fi nearby",
              "Show top-rated hotels in San Francisco",
              "Is it safe to travel to downtown Chicago now?"
            ].map((s, i) => (
              <div key={i} style={styles.suggestion} onClick={() => handleSend(s)}>
                {s}
              </div>
            ))}
          </div>
        )}

        <ChatInput placeholder="Input your prompt" onSend={handleSend} />
      </div>
    </div>
  );
}
*/



/*
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
*/
