import React, { useState, useEffect } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { generateVoiceResponse, playAudio } from './services/resembleService.ts';
import { generateNextPrompt } from './services/promptService.ts';

interface GameState {
  currentPrompt: string;
  userResponse: string;
  isListening: boolean;
  isSpeaking: boolean;
  conversationHistory: string[];
  currentGame: 'yes-and' | 'questions-only';
  liveTranscript: string;
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    currentPrompt: "Hi! I'm Pi. Let's play 'Yes, and...'! You start.",
    userResponse: '',
    isListening: false,
    isSpeaking: false,
    conversationHistory: [],
    currentGame: 'yes-and',
    liveTranscript: ''
  });

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  useEffect(() => {
    if (transcript) {
      setGameState(prev => ({ 
        ...prev, 
        userResponse: transcript,
        liveTranscript: transcript 
      }));
    }
  }, [transcript]);

  const startListening = () => {
    setGameState(prev => ({ 
      ...prev, 
      isListening: true,
      liveTranscript: '' 
    }));
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true });
  };

  const stopListening = () => {
    setGameState(prev => ({ 
      ...prev, 
      isListening: false,
      liveTranscript: '' 
    }));
    SpeechRecognition.stopListening();
  };

  const handleSubmit = async () => {
    if (!gameState.userResponse) return;

    setGameState(prev => ({ ...prev, isSpeaking: true }));
    
    try {
      // Generate next prompt
      const promptResponse = await generateNextPrompt(
        gameState.userResponse,
        gameState.conversationHistory
      );

      // Generate voice response
      const voiceResponse = await generateVoiceResponse(promptResponse.prompt);
      
      // Play the audio response
      await playAudio(voiceResponse.audio_url);
      
      // Update game state
      setGameState(prev => ({
        ...prev,
        currentPrompt: promptResponse.prompt,
        userResponse: '',
        isSpeaking: false,
        liveTranscript: '',
        conversationHistory: [
          ...prev.conversationHistory,
          `User: ${prev.userResponse}`,
          `AI: ${promptResponse.prompt}`
        ].slice(-6), // Keep last 3 exchanges
      }));
      
      resetTranscript();
    } catch (error) {
      console.error('Error in conversation:', error);
      setGameState(prev => ({ ...prev, isSpeaking: false }));
    }
  };

  const selectGame = (game: 'yes-and' | 'questions-only') => {
    setGameState(prev => ({
      ...prev,
      currentGame: game,
      conversationHistory: [],
      currentPrompt: `Okay, let's play '${game === 'yes-and' ? 'Yes, and...' : 'Questions Only'}'! You start.`
    }));
  };

  if (!browserSupportsSpeechRecognition) {
    return <div className="text-center p-8">Your browser doesn't support speech recognition. Please use a modern browser.</div>;
  }

  return (
    <div className="bg-gray-900 text-gray-200 flex flex-col items-center justify-center min-h-screen p-4 antialiased">
      <div className="w-full max-w-2xl mx-auto flex flex-col space-y-8">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-4xl font-bold text-white">Improv Games with Pi</h1>
          <p className="text-lg text-gray-400 mt-2">A real-time conversational improv agent</p>
          <p className="text-sm text-blue-400 mt-1">Powered by Inflection AI</p>
        </header>

        {/* Main Interaction Area */}
        <main className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center space-y-6 shadow-2xl shadow-blue-500/10">
          {/* Game Selection */}
          <div className="w-full mb-4">
            <p className="text-center text-gray-400 text-sm mb-2">Choose a Game</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => selectGame('yes-and')}
                className={`game-btn px-4 py-2 rounded-lg border-2 border-gray-600 bg-gray-800 text-gray-400 font-semibold transition-all hover:bg-gray-700 ${
                  gameState.currentGame === 'yes-and' ? 'active' : ''
                }`}
              >
                Yes, and...
              </button>
              <button
                onClick={() => selectGame('questions-only')}
                className={`game-btn px-4 py-2 rounded-lg border-2 border-gray-600 bg-gray-800 text-gray-400 font-semibold transition-all hover:bg-gray-700 ${
                  gameState.currentGame === 'questions-only' ? 'active' : ''
                }`}
              >
                Questions Only
              </button>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="text-center">
            <p className="text-xl font-semibold text-blue-300 transition-all duration-300">
              {gameState.isListening ? 'Listening...' : 
               gameState.isSpeaking ? 'Pi is Speaking' : 
               `Ready for '${gameState.currentGame === 'yes-and' ? 'Yes, and...' : 'Questions Only'}'!`}
            </p>
            <p className="text-sm text-gray-500 mt-1 h-5 transition-all duration-300">
              {gameState.isListening ? "Go ahead, I'm all ears!" :
               gameState.isSpeaking ? "Listen to the AI's response." :
               "Click the mic when you're ready."}
            </p>
          </div>

          {/* Microphone Button */}
          <button
            onClick={gameState.isListening ? stopListening : startListening}
            className={`w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out ${
              gameState.isListening 
                ? 'bg-red-600 hover:bg-red-500 listening-glow' 
                : 'bg-blue-600 hover:bg-blue-500'
            } focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 shadow-lg ${
              gameState.isSpeaking ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={gameState.isSpeaking}
          >
            <svg className="w-10 h-10 md:w-12 md:h-12 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path>
              <path d="M17 11h-1c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92z"></path>
            </svg>
          </button>
        </main>

        {/* Transcript Area */}
        <div className="w-full bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4 md:p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">Scene Transcript</h2>
          <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
            {gameState.conversationHistory.map((message, index) => {
              const [speaker, text] = message.split(': ');
              const isAI = speaker === 'AI';
              return (
                <div key={index} className="flex items-start gap-3 animate-fade-in">
                  <span className={`flex-shrink-0 w-8 h-8 rounded-full ${
                    isAI ? 'bg-purple-500/80' : 'bg-blue-500/80'
                  } flex items-center justify-center font-bold text-sm`}>
                    {isAI ? 'PI' : 'YOU'}
                  </span>
                  <div className="bg-gray-700 rounded-lg p-3 text-gray-300">
                    <p>{text}</p>
                  </div>
                </div>
              );
            })}
            {/* Live Transcript */}
            {gameState.isListening && gameState.liveTranscript && (
              <div className="flex items-start gap-3 animate-fade-in">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/80 flex items-center justify-center font-bold text-sm">
                  YOU
                </span>
                <div className="bg-gray-700/50 rounded-lg p-3 text-gray-400">
                  <p>{gameState.liveTranscript}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-gray-600 text-sm">
          <p>Human-AI Interaction Day Hackathon &middot; AGI House</p>
        </footer>
      </div>
    </div>
  );
};

export default App; 