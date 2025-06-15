import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// IMPORTANT: Replace 'YOUR_API_KEY_HERE' with your actual Gemini API key.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

type Message = {
  speaker: 'user' | 'ai';
  text: string;
};

type GameMode = 'MainMenu' | 'YesAnd' | 'QuestionsOnly';

function App() {
  const [gameMode, setGameMode] = useState<GameMode>('MainMenu');
  const [transcript, setTranscript] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [aiSpeaking, setAiSpeaking] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);

  const gameModeRef = useRef(gameMode);
  const transcriptRef = useRef(transcript);
  const aiSpeakingRef = useRef(aiSpeaking);

  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { aiSpeakingRef.current = aiSpeaking; }, [aiSpeaking]);

  // Simplified stopListening: always tries to stop if recognitionRef exists.
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        // console.log("DEBUG: stopListening calling recognitionRef.current.stop()");
        recognitionRef.current.stop();
      } catch (e) {
        // This catch is mostly for safety; stop() itself rarely throws if called when not active.
        // console.warn("DEBUG: Error in recognitionRef.current.stop() (may be benign):", e);
      }
    }
  }, []); // No dependencies, as it only interacts with recognitionRef

  const startListening = useCallback(() => {
    console.log(`DEBUG: startListening called. isListening (state): ${isListening}, aiSpeakingRef.current: ${aiSpeakingRef.current}`);
    if (recognitionRef.current && !aiSpeakingRef.current && !isListening) {
      console.log("DEBUG: Attempting recognitionRef.current.start()");
      try {
        recognitionRef.current.start();
      } catch (e: any) {
        console.error("DEBUG: Error calling recognitionRef.current.start():", e);
        if (recognitionRef.current && e.name === 'InvalidStateError') {
          console.log("DEBUG: InvalidStateError in startListening. Attempting to stop (onend should handle restart).");
          // Stop recognition; onend handler should attempt restart if appropriate
          stopListening();
        } else {
          // For other errors, ensure listening state is false
          setIsListening(false);
        }
      }
    } else {
      let logMsg = "DEBUG: startListening conditions not met or recognitionRef not current.";
      if (!recognitionRef.current) logMsg += " recognitionRef.current is null.";
      if (aiSpeakingRef.current) logMsg += " aiSpeakingRef.current is true.";
      if (isListening) logMsg += " isListening (state) is true.";
      console.log(logMsg);
    }
  }, [isListening, stopListening]); // stopListening is a dependency now

  // Refs for callbacks to be used in SpeechRecognition event handlers
  const startListeningCbRef = useRef(startListening);
  useEffect(() => { startListeningCbRef.current = startListening; }, [startListening]);

  const getGeminiResponseCallable = useCallback(async (
    userInput: string,
    currentPGameMode: GameMode,
    conversationHistory: Message[]
  ): Promise<string> => {
    // if (GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
    //   const warning = "Warning: GEMINI_API_KEY is set to placeholder...";
    //   console.warn(warning); alert(warning);
    //   return "I need a real API key!";
    // }
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;
    const contents: any[] = [];
    if (conversationHistory.length === 0) {
      if (currentPGameMode === 'YesAnd') contents.push({ role: 'user', parts: [{ text: "You are an AI improv comedian... Always start with 'Yes, and '..." }] }, { role: 'model', parts: [{ text: "Got it! You start!" }] });
      else if (currentPGameMode === 'QuestionsOnly') contents.push({ role: 'user', parts: [{ text: "You are an AI improv comedian... All responses MUST be a question..." }] }, { role: 'model', parts: [{ text: "Sounds fun, doesn't it?" }] });
    }
    conversationHistory.forEach(msg => contents.push({ role: msg.speaker === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] }));
    contents.push({ role: 'user', parts: [{ text: userInput }] });

    try {
      const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents, generationConfig: { temperature: 0.8, topK: 40, topP: 0.95, maxOutputTokens: 150 }, safetySettings: [{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }] }) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ error: { message: "Unknown API error" } })); throw new Error(`API request failed: ${response.status}. ${errorData?.error?.message}`); }
      const data = await response.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        let text = data.candidates[0].content.parts[0].text.trim();
        if (currentPGameMode === 'YesAnd' && !text.toLowerCase().startsWith('yes, and ')) text = "Yes, and " + text.substring(text.toLowerCase().startsWith('yes and ') ? 8 : (text.toLowerCase().startsWith('and ') ? 0 : 0));
        else if (currentPGameMode === 'QuestionsOnly' && text.length > 0 && !text.endsWith('?')) text += '?';
        else if (currentPGameMode === 'QuestionsOnly' && text.length === 0) text = "Is that a question?";
        return text;
      } else if (data.promptFeedback?.blockReason) { return `My response was blocked (reason: ${data.promptFeedback.blockReason}). Let's try a different line!`; }
      return "Sorry, I received an unusual response.";
    } catch (error: any) { console.error('Error calling Gemini API:', error); return `Sorry, an error occurred: ${error.message}` }
  }, []);

  const speak = useCallback((text: string, onEndCallback?: () => void) => {
    if (!('speechSynthesis' in window)) { alert('TTS not supported.'); setAiSpeaking(false); if (onEndCallback) onEndCallback(); return; }
    stopListening();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.onend = () => { setAiSpeaking(false); if (onEndCallback) onEndCallback(); if (gameModeRef.current !== 'MainMenu') startListeningCbRef.current(); };
    utterance.onerror = (event) => { console.error('Speech synthesis error:', event); setAiSpeaking(false); if (onEndCallback) onEndCallback(); if (gameModeRef.current !== 'MainMenu') startListeningCbRef.current(); };
    window.speechSynthesis.speak(utterance);
  }, [stopListening]); // startListeningCbRef is stable, gameModeRef is stable

  const handleUserSpeech = useCallback(async (text: string) => {
    if (!text || aiSpeakingRef.current) return;
    const newUserMessage: Message = { speaker: 'user', text };
    const historyForApi = [...transcriptRef.current];
    setTranscript(prev => [...prev, newUserMessage]);
    setInterimTranscript('');
    setAiSpeaking(true);
    try {
      const aiResponseText = await getGeminiResponseCallable(text, gameModeRef.current, historyForApi);
      if (aiResponseText) { const newAiMessage: Message = { speaker: 'ai', text: aiResponseText }; setTranscript(prev => [...prev, newAiMessage]); speak(aiResponseText); }
      else { const fallback = "Sorry, no response."; const newAiMsg: Message = { speaker: 'ai', text: fallback }; setTranscript(prev => [...prev, newAiMsg]); speak(fallback); }
    } catch (error) { console.error("Error in handleUserSpeech:", error); const errorMsg = "Oops! AI error."; const newAiMsg: Message = { speaker: 'ai', text: errorMsg }; setTranscript(prev => [...prev, newAiMsg]); speak(errorMsg); }
  }, [getGeminiResponseCallable, speak]);

  const handleUserSpeechCbRef = useRef(handleUserSpeech);
  useEffect(() => { handleUserSpeechCbRef.current = handleUserSpeech; }, [handleUserSpeech]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition API not supported.');
      alert('Speech Recognition API not supported. Please use Chrome or Edge.');
      return;
    }

    // If already initialized, or if it was initialized and then nulled by cleanup, don't re-init
    if (recognitionRef.current && typeof recognitionRef.current.stop === 'function') {
        // console.log("DEBUG: SpeechRecognition already initialized, skipping setup.");
        return;
    }
    
    console.log("DEBUG: Initializing SpeechRecognition...");
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log("DEBUG: SpeechRecognition ONSTART fired.");
      setIsListening(true);
      setInterimTranscript('');
    };

    recognition.onend = () => {
      console.log("DEBUG: SpeechRecognition ONEND fired.");
      setIsListening(false);
      setInterimTranscript('');
      if (gameModeRef.current !== 'MainMenu' && !aiSpeakingRef.current) {
        console.log("DEBUG: ONEND trying to restart listening via startListeningCbRef.current()");
        setTimeout(() => startListeningCbRef.current(), 50); 
      }
    };

    recognition.onerror = (event: any) => {
      console.error('DEBUG: SpeechRecognition ONERROR fired:', event.error);
      setIsListening(false);
      setInterimTranscript('');
      if (event.error === 'not-allowed') {
        alert("Microphone access was denied. Please allow microphone access to use voice input.");
      } else if (event.error === 'no-speech') {
        // Potentially auto-restart if desired, but can loop if mic is off.
        // For now, just log. User can click button to try again.
        console.log("DEBUG: SpeechRecognition error: no-speech.");
      }
    };

    recognition.onresult = (event: any) => {
      // console.log("DEBUG: SpeechRecognition ONRESULT fired.");
      let finalTranscript = '';
      let currentInterim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        else currentInterim += event.results[i][0].transcript;
      }
      setInterimTranscript(currentInterim);
      if (finalTranscript.trim() && !aiSpeakingRef.current) {
        handleUserSpeechCbRef.current(finalTranscript.trim());
      }
    };

    return () => {
      console.log("DEBUG: Cleanup function for SpeechRecognition useEffect running.");
      if (recognitionRef.current) {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        try {
            // console.log("DEBUG: Cleanup calling recognitionRef.current.abort() & stop()");
            recognitionRef.current.abort(); // Try to force stop immediately
            recognitionRef.current.stop();
        } catch (e) { /* ignore */ }
        recognitionRef.current = null; // Important: nullify the ref
      }
    };
  }, []); // Empty array: Run once on mount, cleanup on unmount.

  const selectGame = useCallback((mode: GameMode) => {
    setGameMode(mode);
    setTranscript([]);
    setInterimTranscript('');
    stopListening(); 
    if (mode !== 'MainMenu') {
      let instruction = mode === "YesAnd" ? "Let's play Yes, And! You start." : "Questions Only! You go first.";
      setAiSpeaking(true);
      speak(instruction);
    }
  }, [speak, stopListening]);

  useEffect(() => {
    if (gameMode !== 'MainMenu') {
      if (!aiSpeaking && !isListening) startListeningCbRef.current();
      else if (aiSpeaking && isListening) stopListening();
    } else {
      if (isListening) stopListening();
    }
  }, [gameMode, aiSpeaking, isListening, stopListening]);

  return (
    <div className="container mt-4">
      <header className="text-center mb-4">
        <h1>Improv Agent</h1>
        <p className="lead">Your Personal AI Improvisation Partner</p>
        <p className="fst-italic"><small>Powered by Gemini</small></p>
      </header>

      {gameMode === 'MainMenu' && (
        <div className="row justify-content-center">
          <div className="col-md-8 text-center main-menu-buttons">
            <h2 className="mb-3">Choose a Game</h2>
            <button className="btn btn-primary-custom m-2" onClick={() => selectGame('YesAnd')}>
              Yes, and...
            </button>
            <button className="btn btn-secondary-custom m-2" onClick={() => selectGame('QuestionsOnly')}>
              Questions Only
            </button>
          </div>
        </div>
      )}

      {gameMode !== 'MainMenu' && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3 playing-header">
            <h2>Playing: {gameMode === 'YesAnd' ? 'Yes, and...' : 'Questions Only'}</h2>
            <button className="btn btn-sm btn-end-game" onClick={() => selectGame('MainMenu')}>
              End Game
            </button>
          </div>
          <div className="transcript-card mb-3" style={{ minHeight: '300px', maxHeight: '50vh', overflowY: 'auto' }} ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
            <div className="card-body p-2 p-md-3">
              {transcript.map((msg, index) => (
                <div key={index} className={`message-row d-flex ${msg.speaker === 'user' ? 'justify-content-end' : 'justify-content-start'} mb-2`}>
                  <div className={`message-bubble ${msg.speaker}`}>
                    <span className="message-speaker">{msg.speaker === 'user' ? 'You' : 'AI'}</span>
                    {msg.text}
                  </div>
                </div>
              ))}
              {interimTranscript && <div className="interim-transcript mb-2"><em>{interimTranscript}...</em></div>}
              {aiSpeaking && transcript.length > 0 && transcript[transcript.length -1].speaker === 'user' && (
                <div className="thinking-indicator mb-2">
                  <span className="message-speaker">AI</span>
                  <em>Thinking...</em>
                </div>
              )}
            </div>
          </div>
          <div className="text-center mt-3">
            {isListening && !aiSpeaking && <div className="status-alert alert-listening" role="alert">Listening... Speak now! <span className="d-block d-md-inline">(Or say "Stop listening")</span></div>}
            {aiSpeaking && <div className="status-alert alert-ai-responding" role="alert">AI is responding...</div>}
            {!isListening && !aiSpeaking && (
              <button className="btn-speak-now" onClick={startListeningCbRef.current}> {/* Use ref here */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-mic-fill" viewBox="0 0 16 16"><path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z"/><path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5"/></svg>
                Tap to Speak
              </button>
            )}
          </div>
        </div>
      )}
       <footer className="text-center mt-5">
        <p><small>Note: Uses browser's Speech Recognition & Synthesis. Best in Chrome/Edge. <br/>If speech input stops, try clicking "Tap to Speak".</small></p>
      </footer>
    </div>
  );
}

export default App;
