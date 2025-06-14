import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

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

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      // setIsListening(false); // This will be handled by onend
    }
  }, [isListening]); // recognitionRef is stable

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening && !aiSpeaking) {
      try {
        recognitionRef.current.start();
        // setIsListening(true); // This will be handled by onstart
      } catch (e) {
        console.error("Error starting recognition:", e);
        if (recognitionRef.current && (e as DOMException).name === 'InvalidStateError') {
          recognitionRef.current.stop();
          setTimeout(() => recognitionRef.current?.start(), 50);
        }
      }
    }
  }, [isListening, aiSpeaking]); // recognitionRef is stable

  // --- Basic AI Response Logic (Placeholders) ---
  const generateYesAndResponse = useCallback((userInput: string): string => {
    const responses = [
      "that reminds me of a time I went to the moon!",
      "it suddenly started raining marshmallows!",
      "a talking squirrel offered us some tea.",
      "we discovered a hidden treasure map!",
      "the floor turned into a giant trampoline!"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }, []);

  const generateQuestionsOnlyResponse = useCallback((userInput: string): string => {
    if (!userInput.endsWith('?')) {
      return "Hmm, that didn't sound like a question, did it?";
    }
    const responses = [
      "why do you ask that?",
      "can you believe it?",
      "what would happen if that were true?",
      "is that really what you think?",
      "shouldn't we consider other possibilities?"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }, []);
  // --- End AI Response Logic ---

  const speak = useCallback((text: string, onEndCallback?: () => void) => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech not supported in this browser.');
      if (onEndCallback) onEndCallback();
      return;
    }
    setAiSpeaking(true);
    stopListening();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.onend = () => {
      setAiSpeaking(false);
      if (onEndCallback) onEndCallback();
      if (gameMode !== 'MainMenu') {
        startListening();
      }
    };
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setAiSpeaking(false);
      if (onEndCallback) onEndCallback();
      if (gameMode !== 'MainMenu') {
        startListening();
      }
    };
    window.speechSynthesis.speak(utterance);
  }, [gameMode, stopListening, startListening, setAiSpeaking]); // setAiSpeaking is stable

  const handleUserSpeech = useCallback((text: string) => {
    if (!text) return;
    const newUserMessage: Message = { speaker: 'user', text };
    setTranscript(prev => [...prev, newUserMessage]);
    setInterimTranscript('');

    if (gameMode === 'YesAnd') {
      const aiResponseText = "Yes, and " + generateYesAndResponse(text);
      const newAiMessage: Message = { speaker: 'ai', text: aiResponseText };
      setTranscript(prev => [...prev, newAiMessage]);
      speak(aiResponseText);
    } else if (gameMode === 'QuestionsOnly') {
      const aiResponseText = generateQuestionsOnlyResponse(text);
      const newAiMessage: Message = { speaker: 'ai', text: aiResponseText };
      setTranscript(prev => [...prev, newAiMessage]);
      speak(aiResponseText);
    }
  }, [gameMode, generateYesAndResponse, generateQuestionsOnlyResponse, speak, setTranscript, setInterimTranscript]); // state setters are stable

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript('');
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
        if (gameMode !== 'MainMenu' && !aiSpeaking) {
          setTimeout(() => startListening(), 100); // Use memoized startListening
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setInterimTranscript('');
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
        if (finalTranscript && !aiSpeaking) {
          handleUserSpeech(finalTranscript.trim());
        }
      };
    } else {
      console.warn('Speech Recognition API not supported in this browser.');
      alert('Speech Recognition API not supported in this browser. Please try Chrome or Edge.');
    }

    return () => {
      recognitionRef.current?.stop();
    };
  }, [gameMode, aiSpeaking, handleUserSpeech, startListening, setIsListening, setInterimTranscript]); // Added dependencies

  const selectGame = useCallback((mode: GameMode) => {
    setGameMode(mode);
    setTranscript([]);
    if (mode !== 'MainMenu') {
      let instruction = "";
      if (mode === "YesAnd") instruction = "Let's play Yes, And! You start.";
      if (mode === "QuestionsOnly") instruction = "Questions Only! You go first.";
      speak(instruction, () => {
        startListening();
      });
    } else {
      stopListening();
    }
  }, [speak, startListening, stopListening, setGameMode, setTranscript]); // Added dependencies

  useEffect(() => {
    if (gameMode !== 'MainMenu' && !aiSpeaking && !isListening) {
      startListening();
    }
  }, [gameMode, aiSpeaking, isListening, startListening]); // Added startListening

  return (
    <div className="container mt-4">
      <header className="text-center mb-4">
        <h1>Improv Agent</h1>
        <p className="lead">Your Personal AI Improvisation Partner</p>
      </header>

      {gameMode === 'MainMenu' && (
        <div className="row justify-content-center">
          <div className="col-md-6 text-center">
            <h2>Choose a Game</h2>
            <button className="btn btn-primary btn-lg m-2" onClick={() => selectGame('YesAnd')}>
              Yes, and...
            </button>
            <button className="btn btn-secondary btn-lg m-2" onClick={() => selectGame('QuestionsOnly')}>
              Questions Only
            </button>
          </div>
        </div>
      )}

      {gameMode !== 'MainMenu' && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2>Playing: {gameMode === 'YesAnd' ? 'Yes, and...' : 'Questions Only'}</h2>
            <button className="btn btn-sm btn-outline-danger" onClick={() => selectGame('MainMenu')}>
              End Game
            </button>
          </div>

          <div className="card mb-3" style={{ minHeight: '300px', maxHeight: '50vh', overflowY: 'auto' }}>
            <div className="card-body">
              {transcript.map((msg, index) => (
                <div key={index} className={`mb-2 ${msg.speaker === 'user' ? 'text-end' : 'text-start'}`}>
                  <span className={`badge ${msg.speaker === 'user' ? 'bg-primary' : 'bg-success'}`}>
                    {msg.speaker === 'user' ? 'You' : 'AI'}
                  </span>
                  <p className="mb-0 ms-1 me-1 d-inline">{msg.text}</p>
                </div>
              ))}
              {interimTranscript && (
                 <div className="mb-2 text-end text-muted">
                   <em>{interimTranscript}...</em>
                 </div>
              )}
            </div>
          </div>

          <div className="text-center">
            {isListening && !aiSpeaking && (
              <div className="alert alert-info" role="alert">
                Listening... Speak now!
              </div>
            )}
            {aiSpeaking && (
              <div className="alert alert-light" role="alert">
                AI is speaking...
              </div>
            )}
            {!isListening && !aiSpeaking && (
              <button className="btn btn-success" onClick={startListening}>
                Start Listening
              </button>
            )}
          </div>
        </div>
      )}
       <footer className="text-center mt-5 text-muted">
        <p><small>Note: Uses browser's Speech Recognition and Synthesis. Best experienced in Chrome or Edge.</small></p>
      </footer>
    </div>
  );
}

export default App;
