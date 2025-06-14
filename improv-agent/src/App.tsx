import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// IMPORTANT: Replace 'YOUR_API_KEY_HERE' with your actual Gemini API key.
// Consider using environment variables or a backend proxy for production to keep your key secure.
const GEMINI_API_KEY = 'YOUR_API_KEY_HERE';

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

  // Refs for state values accessed in memoized callbacks
  const gameModeRef = useRef(gameMode);
  const transcriptRef = useRef(transcript);
  const aiSpeakingRef = useRef(aiSpeaking);

  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { aiSpeakingRef.current = aiSpeaking; }, [aiSpeaking]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && recognitionRef.current.listeningStatus) { // Check a hypothetical listeningStatus
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("Error stopping recognition (may already be stopped):", e);
      }
    }
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !aiSpeakingRef.current && !isListening) { // Use ref for aiSpeaking
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Error starting recognition:", e);
        if (recognitionRef.current && (e as DOMException).name === 'InvalidStateError') {
          // Attempt to recover from InvalidStateError by stopping and restarting
          try {
            recognitionRef.current.stop();
          } catch (stopError) {
            console.warn("Error stopping recognition during recovery:", stopError);
          }
          setTimeout(() => {
            try {
              recognitionRef.current?.start();
            } catch (restartError) {
              console.error("Error restarting recognition after recovery:", restartError);
            }
          }, 100);
        }
      }
    }
  }, [isListening]); // isListening is a direct dependency here for the condition

  const getGeminiResponseCallable = useCallback(async (
    userInput: string,
    currentPGameMode: GameMode, // Renamed to avoid conflict with state
    conversationHistory: Message[]
  ): Promise<string> => {
    if (GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
      const warning = "Warning: GEMINI_API_KEY is set to placeholder. Please replace 'YOUR_API_KEY_HERE' in App.tsx with your actual Gemini API key.";
      console.warn(warning);
      alert(warning);
      return "Yes, and I need a real API key to talk to Gemini! Can you set that up for me?";
    }
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
    const contents: any[] = [];

    if (conversationHistory.length === 0) {
      if (currentPGameMode === 'YesAnd') {
        contents.push({
          role: 'user',
          parts: [{ text: "You are an AI improv comedian. We are playing 'Yes, and...'. I'll say something, and you continue the scene. Always start your response with 'Yes, and ' and keep it to 1-2 concise sentences." }]
        });
        contents.push({
          role: 'model',
          parts: [{ text: "Got it! I'm ready to 'Yes, and' anything. You start!" }]
        });
      } else if (currentPGameMode === 'QuestionsOnly') {
        contents.push({
          role: 'user',
          parts: [{ text: "You are an AI improv comedian. We are playing 'Questions Only'. All responses, including yours, MUST be in the form of a question. Keep your response to 1-2 concise sentences. If I don't ask a question, you can remind me of the rule, also in question form." }]
        });
        contents.push({
          role: 'model',
          parts: [{ text: "Sounds like fun, doesn't it? What's your first question?" }]
        });
      }
    }

    conversationHistory.forEach(msg => {
      contents.push({
        role: msg.speaker === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      });
    });

    contents.push({
      role: 'user',
      parts: [{ text: userInput }]
    });

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          contents: contents,
          generationConfig: { temperature: 0.8, topK: 40, topP: 0.95, maxOutputTokens: 150, },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          ]
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: "Unknown API error and non-JSON response" } }));
        console.error('Gemini API Error:', response.status, errorData);
        let errorMessage = `API request failed: ${response.status}.`;
        if (errorData && errorData.error && errorData.error.message) {
          errorMessage += ` Message: ${errorData.error.message}`;
        }
        if (response.status === 400 && errorData?.error?.message?.toLowerCase().includes("api key not valid")) {
          errorMessage = "The Gemini API key is not valid. Please replace 'YOUR_API_KEY_HERE' in the code. (Error from API)";
          alert(errorMessage);
        } else if (response.status === 403) {
          errorMessage = "Gemini API request was forbidden (403). This might be due to API key permissions or other restrictions. (Error from API)";
          alert(errorMessage);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
        let text = data.candidates[0].content.parts[0].text.trim();
        if (currentPGameMode === 'YesAnd') {
          if (!text.toLowerCase().startsWith('yes, and ')) {
            if (text.toLowerCase().startsWith('yes and ')) { text = "Yes, and " + text.substring(8); }
            else if (text.toLowerCase().startsWith('and ')) { text = "Yes, " + text; }
            else { text = "Yes, and " + text; }
          }
        } else if (currentPGameMode === 'QuestionsOnly') {
          if (text.length > 0 && !text.endsWith('?')) { text += '?'; }
          else if (text.length === 0) { text = "Is that a question?"; }
        }
        return text;
      } else if (data.promptFeedback && data.promptFeedback.blockReason) {
        const blockReason = data.promptFeedback.blockReason;
        const safetyRatingsInfo = (data.promptFeedback.safetyRatings || []).map((r: any) => `${r.category}: ${r.probability}`).join(', ');
        const blockMessage = `My response was blocked (reason: ${blockReason}). ${safetyRatingsInfo ? `Details: ${safetyRatingsInfo}. ` : ''}Let's try a different line!`;
        console.warn('Gemini API Blocked:', blockReason, data.promptFeedback.safetyRatings);
        return blockMessage;
      } else {
        console.error('Unexpected Gemini API response structure:', data);
        return "Sorry, I received an unusual response from the AI.";
      }
    } catch (error: any) {
      console.error('Error calling Gemini API:', error);
      if (error.message.includes("API key is not valid") || error.message.includes("API request was forbidden")) {
        return error.message;
      }
      return "Sorry, an error occurred while talking to the AI. Check the console for details.";
    }
  }, []); // GEMINI_API_KEY is a top-level const, so not a dependency here.

  const speak = useCallback((text: string, onEndCallback?: () => void) => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech not supported in this browser.');
      setAiSpeaking(false); // Ensure AI speaking is false if TTS not supported
      if (onEndCallback) onEndCallback();
      return;
    }
    // setAiSpeaking(true); // This is now set before calling speak in handleUserSpeech
    stopListening();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.onend = () => {
      setAiSpeaking(false);
      if (onEndCallback) onEndCallback();
      // Conditional restart of listening based on gameModeRef (current value)
      if (gameModeRef.current !== 'MainMenu') {
         startListening();
      }
    };
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setAiSpeaking(false);
      if (onEndCallback) onEndCallback();
      if (gameModeRef.current !== 'MainMenu') {
        startListening();
      }
    };
    window.speechSynthesis.speak(utterance);
  }, [stopListening, startListening]); // gameMode is accessed via ref, setAiSpeaking is stable

  const handleUserSpeech = useCallback(async (text: string) => {
    if (!text || aiSpeakingRef.current) return;

    const newUserMessage: Message = { speaker: 'user', text };
    const historyForApi = [...transcriptRef.current];

    setTranscript(prev => [...prev, newUserMessage]);
    setInterimTranscript('');
    setAiSpeaking(true); // Indicate AI is about to process and speak

    try {
      const aiResponseText = await getGeminiResponseCallable(text, gameModeRef.current, historyForApi);
      
      // speak will handle setting aiSpeaking to false after utterance.
      // No need to explicitly set aiSpeaking to false here before speak,
      // as speak itself is async in terms of when onend is called.
      if (aiResponseText) {
        const newAiMessage: Message = { speaker: 'ai', text: aiResponseText };
        setTranscript(prev => [...prev, newAiMessage]);
        speak(aiResponseText);
      } else {
        const fallbackMessage = "Sorry, I couldn't think of a response.";
        const newAiMessage: Message = { speaker: 'ai', text: fallbackMessage };
        setTranscript(prev => [...prev, newAiMessage]);
        speak(fallbackMessage);
      }
    } catch (error) {
      console.error("Error getting AI response in handleUserSpeech:", error);
      const errorMessage = "Oops! Something went wrong with the AI. Let's try that again.";
      const newAiMessage: Message = { speaker: 'ai', text: errorMessage };
      setTranscript(prev => [...prev, newAiMessage]);
      speak(errorMessage); // This will also setAiSpeaking(false) on end
    }
  }, [getGeminiResponseCallable, speak, setTranscript, setInterimTranscript]);


  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      if (!recognitionRef.current) { // Initialize only once
        recognitionRef.current = new SpeechRecognition();
        const recognition = recognitionRef.current;
        recognition.continuous = true; // Keep listening even after a pause
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
          setInterimTranscript('');
        };

        recognition.onend = () => {
          setIsListening(false);
          setInterimTranscript('');
          // Only restart if not in MainMenu, AI is not speaking, and recognition was intentionally stopped (not due to error)
          if (gameModeRef.current !== 'MainMenu' && !aiSpeakingRef.current) {
             setTimeout(() => startListening(), 50); // Brief delay before attempting restart
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          // Common errors: 'no-speech', 'audio-capture', 'not-allowed', 'network'
          setIsListening(false);
          setInterimTranscript('');
          if (event.error === 'not-allowed') {
            alert("Microphone access was denied. Please allow microphone access to use voice input.");
          } else if (event.error === 'no-speech') {
            // Optionally restart listening if no speech was detected and AI is not speaking
            if (gameModeRef.current !== 'MainMenu' && !aiSpeakingRef.current) {
                // startListening(); // Or with a delay
            }
          }
        };

        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          let currentInterim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              currentInterim += event.results[i][0].transcript;
            }
          }
          setInterimTranscript(currentInterim);
          if (finalTranscript.trim() && !aiSpeakingRef.current) { // Use ref
            handleUserSpeech(finalTranscript.trim());
          }
        };
      }
    } else {
      console.warn('Speech Recognition API not supported in this browser.');
      alert('Speech Recognition API not supported. Please use Chrome or Edge.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        stopListening(); // Ensure it's stopped when component unmounts or effect re-runs
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleUserSpeech, startListening, stopListening]); // gameMode, aiSpeaking are handled by refs inside callbacks


  const selectGame = useCallback((mode: GameMode) => {
    setGameMode(mode);
    setTranscript([]); // Clear transcript for new game
    setInterimTranscript(''); // Clear interim transcript
    stopListening(); // Stop any active listening

    if (mode !== 'MainMenu') {
      let instruction = "";
      if (mode === "YesAnd") instruction = "Let's play Yes, And! You start.";
      if (mode === "QuestionsOnly") instruction = "Questions Only! You go first.";
      
      setAiSpeaking(true); // AI is "speaking" the instruction
      speak(instruction, () => {
        // setAiSpeaking(false) is handled by speak's onEnd
        // startListening will be called by speak's onEnd if gameMode is not MainMenu
      });
    }
  }, [speak, stopListening, setGameMode, setTranscript, setInterimTranscript]);


  // Effect to manage listening state based on game mode and AI speaking status
  useEffect(() => {
    if (gameMode !== 'MainMenu' && !aiSpeaking && !isListening) {
      // If a game is active, AI is not speaking, and we are not listening, try to start.
      // This can help resume listening after AI finishes speaking or if recognition stops unexpectedly.
      startListening();
    } else if ((gameMode === 'MainMenu' || aiSpeaking) && isListening) {
      // If we are back in menu, or AI is speaking, but we are somehow still listening, stop.
      stopListening();
    }
  }, [gameMode, aiSpeaking, isListening, startListening, stopListening]);


  return (
    <div className="container mt-4">
      <header className="text-center mb-4">
        <h1>Improv Agent</h1>
        <p className="lead">Your Personal AI Improvisation Partner</p>
        <p className="fst-italic"><small>Powered by Gemini</small></p>
      </header>

      {gameMode === 'MainMenu' && (
        <div className="row justify-content-center">
          <div className="col-md-8 text-center main-menu-buttons"> {/* Adjusted col width */}
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

          <div className="transcript-card mb-3" style={{ minHeight: '300px', maxHeight: '50vh', overflowY: 'auto' }} ref={(el) => {
            if (el) { el.scrollTop = el.scrollHeight; }
          }}>
            <div className="card-body p-2 p-md-3"> {/* Adjusted padding */}
              {transcript.map((msg, index) => (
                <div key={index} className={`message-row d-flex ${msg.speaker === 'user' ? 'justify-content-end' : 'justify-content-start'} mb-2`}>
                  <div className={`message-bubble ${msg.speaker}`}>
                    <span className="message-speaker">{msg.speaker === 'user' ? 'You' : 'AI'}</span>
                    {msg.text}
                  </div>
                </div>
              ))}
              {interimTranscript && (
                 <div className="interim-transcript mb-2">
                   <em>{interimTranscript}...</em>
                 </div>
              )}
               {aiSpeaking && transcript.length > 0 && transcript[transcript.length -1].speaker === 'user' && (
                <div className="thinking-indicator mb-2">
                  <span className="message-speaker">AI</span>
                  <em>Thinking...</em>
                </div>
              )}
            </div>
          </div>

          <div className="text-center mt-3">
            {isListening && !aiSpeaking && (
              <div className="status-alert alert-listening" role="alert">
                Listening... Speak now! <span className="d-block d-md-inline">(Or say "Stop listening")</span>
              </div>
            )}
            {aiSpeaking && ( 
              <div className="status-alert alert-ai-responding" role="alert">
                AI is responding...
              </div>
            )}
            {/* Button is only rendered if gameMode !== 'MainMenu' due to parent conditional */}
            {!isListening && !aiSpeaking && (
              <button className="btn-speak-now" onClick={startListening}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-mic-fill" viewBox="0 0 16 16">
                  <path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z"/>
                  <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5"/>
                </svg>
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
