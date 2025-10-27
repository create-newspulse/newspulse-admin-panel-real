import { useState, useEffect, useRef } from 'react';

const KiranOSChatPanel = () => {
  const [selectedAI, setSelectedAI] = useState('gpt');
  const [voiceLang, setVoiceLang] = useState('en-US');
  const [input, setInput] = useState('');
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const recognitionRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);
  const chatBoxRef = useRef(null);

  // ✅ Load chat from memory
  useEffect(() => {
    const savedChat = localStorage.getItem('kiranos_chat_history');
    if (savedChat) setChat(JSON.parse(savedChat));
  }, []);

  // ✅ Save chat & auto-scroll
  useEffect(() => {
    localStorage.setItem('kiranos_chat_history', JSON.stringify(chat));
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [chat]);

  // ✅ Translate non-English voice input to English
  const autoTranslateToEnglish = async (text, lang) => {
    if (lang === 'en-US') return text;
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang.slice(0, 2)}&tl=en&dt=t&q=${encodeURIComponent(text)}`);
      const data = await res.json();
      return data[0][0][0];
    } catch (err) {
      console.error('Translation error:', err);
      return text;
    }
  };

  // ✅ Speak response out loud
  const speakText = (text) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    window.speechSynthesis.speak(utter);
  };

  // ✅ Handle GPT message send
  const handleSend = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setIsTyping(true);

    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message: input, model: selectedAI })
    });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await res.text();
      console.warn('Non-JSON reply from /api/ai/chat:', text.slice(0, 300));
      setChat(prev => [...prev, { role: 'user', text: input }, { role: 'ai', text: 'Server returned a non-JSON response. Please try again.' }]);
      setInput('');
      setLoading(false);
      setIsTyping(false);
      return;
    }
    const data = await res.json();
    const reply = data.reply;

    speakText(reply);
    setChat(prev => [...prev, { role: 'user', text: input }, { role: 'ai', text: reply }]);
    setInput('');
    setLoading(false);
    setIsTyping(false);
  };

  // ✅ Voice Input with Admin Commands
  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Voice recognition not supported');
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = voiceLang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();

      // 🔐 Voice admin commands
      if (transcript.includes('clear chat')) {
        handleClearChat();
        speakText("Chat cleared.");
        return;
      }

      if (transcript.includes('reset assistant')) {
        speakText("Resetting now.");
        setTimeout(() => window.location.reload(), 1000);
        return;
      }

      if (transcript.includes('stop speaking')) {
        window.speechSynthesis.cancel();
        return;
      }

      if (transcript.includes('who are you')) {
        const msg = "I am KiranOS, your AI Manager and assistant.";
        speakText(msg);
        setChat(prev => [...prev, { role: 'user', text: transcript }, { role: 'ai', text: msg }]);
        return;
      }

      // 🌐 Auto-translate to English before sending to GPT
      const translated = await autoTranslateToEnglish(transcript, voiceLang);
      setInput(translated);

      // 📊 Count voice usage
      const count = parseInt(localStorage.getItem(`voice_count_${voiceLang}`)) || 0;
      localStorage.setItem(`voice_count_${voiceLang}`, count + 1);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  // ✅ Clear chat manually
  const handleClearChat = () => {
    setChat([]);
    localStorage.removeItem('kiranos_chat_history');
  };

  return (
    <div className="p-4 w-full max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">🤖 KiranOS AI Panel</h2>

      {/* 🎙️ Language Selector */}
      <label className="block mb-1 font-medium">🎙️ Voice Input Language:</label>
      <select
        value={voiceLang}
        onChange={(e) => setVoiceLang(e.target.value)}
        className="mb-4 p-2 border rounded w-full"
      >
        <option value="en-US">🇺🇸 English (US)</option>
        <option value="hi-IN">🇮🇳 Hindi</option>
        <option value="gu-IN">🇮🇳 Gujarati</option>
      </select>

      {/* 🔘 GPT Selector (GPT only for now) */}
      <select value={selectedAI} onChange={(e) => setSelectedAI(e.target.value)} className="mb-4 p-2 border rounded">
        <option value="gpt">🤖 GPT-4</option>
      </select>

      {/* 💬 Chat History */}
      <div ref={chatBoxRef} className="border p-4 h-80 overflow-y-auto bg-white rounded shadow mb-4">
        {chat.map((msg, i) => (
          <div key={i} className={`mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
            <span className="inline-block p-2 rounded bg-gray-100 animate-fadeIn">
              <strong>{msg.role === 'user' ? 'You' : selectedAI.toUpperCase()}:</strong> {msg.text}
            </span>
          </div>
        ))}
        {isTyping && (
          <div className="text-left text-gray-400 animate-pulse">{selectedAI.toUpperCase()} is typing...</div>
        )}
      </div>

      {/* 🧠 Input + Control Buttons */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-grow border p-2 rounded"
          placeholder="Ask something..."
        />
        <button onClick={handleSend} className="bg-blue-600 text-white p-2 rounded">Send</button>
        <button onClick={handleVoiceInput} className="bg-green-500 text-white p-2 rounded">🎙️</button>
        <button onClick={handleClearChat} className="bg-red-500 text-white p-2 rounded">🗑️</button>
      </div>

      {loading && <p className="mt-2 text-sm text-gray-500">Generating response...</p>}
    </div>
  );
};

export default KiranOSChatPanel;
