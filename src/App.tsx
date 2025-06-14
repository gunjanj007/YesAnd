import React, { useState, useEffect } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { generateVoiceResponse, playAudio, testResembleCredentials, listProjects, testWelcomeMessage, testGameStart } from './services/resembleService.ts';
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
    conversationHistory: [
      "AI: Hi! I'm Pi. Let's play 'Yes, and...'! You start."
    ],
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

  const getSystemPrompt = () => {
    if (gameState.currentGame === 'questions-only') {
      return "You are an AI improv comedian named 'Pi'. You are playing the game 'Questions Only' with a human partner. You must ONLY respond with a question. Never make a statement. Your goal is to keep the rally going. Keep responses short and witty.";
    }
    return "You are an AI improv comedian named 'Pi'. You are playing the game 'Yes, and...'. You must always accept the reality your partner creates and then add a new element to it. Be witty, a little quirky, and keep your responses to 1-2 sentences.";
  };

  const startListening = async () => {
    // If this is the first interaction, start with AI's opening line
    if (gameState.conversationHistory.length === 1) {
      const welcomeMessage = gameState.currentGame === 'yes-and' 
        ? "I'm walking through a magical forest where the trees whisper secrets. What do you see?"
        : "What brings you to this mysterious place?";

      setGameState(prev => ({
        ...prev,
        isSpeaking: true,
        conversationHistory: [...prev.conversationHistory, `AI: ${welcomeMessage}`],
        currentPrompt: welcomeMessage
      }));

      try {
        console.log('Generating welcome message voice...');
        const voiceResponse = await generateVoiceResponse(welcomeMessage);
        console.log('Welcome message voice response:', voiceResponse);
        
        if (voiceResponse.audio_url) {
          console.log('Playing welcome message audio...');
          await playAudio(voiceResponse.audio_url);
          console.log('Welcome message audio played successfully');
        } else {
          console.error('No audio URL in welcome message response');
        }
      } catch (error) {
        console.error('Error with welcome message:', error);
      } finally {
        setGameState(prev => ({
          ...prev,
          isSpeaking: false
        }));
      }
    }

    setGameState(prev => ({ 
      ...prev, 
      isListening: true,
      liveTranscript: '' 
    }));
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true });
  };

  const stopListening = async () => {
    setGameState(prev => ({ 
      ...prev, 
      isListening: false,
      isSpeaking: true
    }));
    SpeechRecognition.stopListening();

    try {
      // Generate AI response using Inflection AI
      console.log('Generating AI response...');
      const promptResponse = await generateNextPrompt(
        gameState.userResponse,
        gameState.conversationHistory
      );
      console.log('AI Response:', promptResponse);

      // Generate voice response using Resemble AI
      console.log('Generating voice response...');
      const voiceResponse = await generateVoiceResponse(promptResponse.prompt);
      console.log('Voice Response:', voiceResponse);
      
      // Update conversation history before playing audio
      setGameState(prev => ({
        ...prev,
        conversationHistory: [
          ...prev.conversationHistory,
          `User: ${prev.userResponse}`,
          `AI: ${promptResponse.prompt}`
        ].slice(-6), // Keep last 3 exchanges
      }));

      // Play the audio response
      if (voiceResponse.audio_url) {
        console.log('Playing audio response...');
        console.log('Audio URL:', voiceResponse.audio_url);
        try {
          await playAudio(voiceResponse.audio_url);
          console.log('Audio playback completed');
        } catch (audioError) {
          console.error('Audio playback error:', audioError);
          // Try to play audio directly as a fallback
          const audio = new Audio(voiceResponse.audio_url);
          audio.onerror = (e) => console.error('Direct audio playback error:', e);
          audio.onended = () => console.log('Direct audio playback completed');
          await audio.play();
        }
      } else {
        console.error('No audio URL in voice response');
      }
      
      // Update final state
      setGameState(prev => ({
        ...prev,
        currentPrompt: promptResponse.prompt,
        userResponse: '',
        isSpeaking: false,
        liveTranscript: ''
      }));
      
      resetTranscript();
    } catch (error) {
      console.error('Error in conversation:', error);
      setGameState(prev => ({ 
        ...prev, 
        isSpeaking: false,
        liveTranscript: ''
      }));
    }
  };

  const selectGame = async (game: 'yes-and' | 'questions-only') => {
    const welcomeMessage = game === 'yes-and' 
      ? "Okay, let's play 'Yes, and...'! I'll start: I'm walking through a magical forest where the trees whisper secrets."
      : "Okay, let's play 'Questions Only'! I'll start: What brings you to this mysterious place?";

    setGameState(prev => ({
      ...prev,
      currentGame: game,
      conversationHistory: [`AI: ${welcomeMessage}`],
      currentPrompt: welcomeMessage,
      isSpeaking: true
    }));

    try {
      // Generate voice response for the welcome message
      const voiceResponse = await generateVoiceResponse(welcomeMessage);
      await playAudio(voiceResponse.audio_url);
      
      setGameState(prev => ({
        ...prev,
        isSpeaking: false
      }));
    } catch (error) {
      console.error('Error playing welcome message:', error);
      setGameState(prev => ({
        ...prev,
        isSpeaking: false
      }));
    }
  };

  const testServices = async () => {
    try {
      // Debug environment variables
      console.log('Environment Variables Debug:', {
        inflectionKey: process.env.REACT_APP_INFLECTION_API_KEY,
        resembleKey: process.env.REACT_APP_RESEMBLE_API_KEY,
        resembleProjectId: process.env.REACT_APP_RESEMBLE_PROJECT_ID
      });

      // Test Inflection AI
      console.log('Testing Inflection AI...');
      const testPrompt = "The sky is blue and the grass is green.";
      console.log('Test prompt:', testPrompt);
      console.log('Environment variables:', {
        inflectionKey: process.env.REACT_APP_INFLECTION_API_KEY ? 'Present' : 'Missing',
        resembleKey: process.env.REACT_APP_RESEMBLE_API_KEY ? 'Present' : 'Missing',
        resembleProjectId: process.env.REACT_APP_RESEMBLE_PROJECT_ID ? 'Present' : 'Missing'
      });
      
      const promptResponse = await generateNextPrompt(
        testPrompt,
        ["AI: Let's test the services!"]
      );
      console.log('Inflection AI Response:', promptResponse);

      // Test Resemble AI
      console.log('Testing Resemble AI...');
      const voiceResponse = await generateVoiceResponse(promptResponse.prompt);
      console.log('Resemble AI Response:', voiceResponse);
      
      // Test audio playback
      console.log('Testing audio playback...');
      console.log('Audio URL:', voiceResponse.audio_url);
      
      try {
        await playAudio(voiceResponse.audio_url);
        console.log('Audio playback completed');
      } catch (audioError) {
        console.error('Audio playback error:', audioError);
        // Try to play audio directly as a fallback
        const audio = new Audio(voiceResponse.audio_url);
        audio.onerror = (e) => console.error('Direct audio playback error:', e);
        audio.onended = () => console.log('Direct audio playback completed');
        await audio.play();
      }
      
      alert('Services test completed! Check console for details.');
    } catch (error) {
      console.error('Service test failed:', error);
      if (error instanceof Error) {
        alert(`Service test failed: ${error.message}\nCheck console for details.`);
      } else {
        alert('Service test failed! Check console for details.');
      }
    }
  };

  if (!browserSupportsSpeechRecognition) {
    return <div className="text-center p-8">Your browser doesn't support speech recognition. Please use a modern browser.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col">
      <header className="p-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-center">Improv Games with Pi</h1>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center">
        {/* Add test buttons at the top */}
        <div className="flex gap-4 mb-4">
          <button
            onClick={async () => {
              const result = await testResembleCredentials();
              alert(result.message);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Test Resemble Credentials
          </button>

          <button
            onClick={async () => {
              const result = await listProjects();
              if (result.success && result.projectUuid) {
                alert(`Default Project:\n\nName: ${result.message}\nID: ${result.projectUuid}`);
              } else {
                alert(result.message);
              }
            }}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Get Default Project
          </button>

          <button
            onClick={async () => {
              const result = await testWelcomeMessage();
              alert(result.message);
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            Test Welcome Message
          </button>

          <button
            onClick={async () => {
              const result = await testGameStart();
              alert(result.message);
            }}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            Test Game Start
          </button>
        </div>

        {/* Game Selection */}
        <div className="flex gap-4 mb-8">
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
             "Click the blob when you're ready."}
          </p>
        </div>

        {/* Animated Blob Button */}
        <button
          onClick={gameState.isListening ? stopListening : startListening}
          className={`relative w-32 h-32 md:w-40 md:h-40 transition-all duration-300 ease-in-out ${
            gameState.isSpeaking ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          disabled={gameState.isSpeaking}
        >
          <div className={`absolute inset-0 ${
            gameState.isListening 
              ? 'bg-gradient-to-r from-purple-500 to-blue-500 blob-listening' 
              : 'bg-gradient-to-r from-blue-500 to-purple-500 blob'
          } transition-all duration-300`} />
          <div className={`absolute inset-0 flex items-center justify-center text-white text-sm font-medium ${
            gameState.isListening ? 'opacity-100' : 'opacity-0'
          } transition-opacity duration-300`}>
            {gameState.isListening ? 'Listening...' : 'Click to Start'}
          </div>
        </button>

        {/* Transcript Area */}
        <div className="w-full bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4 md:p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">Scene Transcript</h2>
          <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
            {gameState.conversationHistory.map((message, index) => {
              const [speaker, text] = message.split(': ');
              const isAI = speaker === 'AI';
              return (
                <div key={index} className={`flex items-start gap-3 animate-fade-in ${isAI ? 'flex-row-reverse' : ''}`}>
                  <span className={`flex-shrink-0 w-8 h-8 rounded-full ${
                    isAI ? 'bg-purple-500/80' : 'bg-blue-500/80'
                  } flex items-center justify-center font-bold text-sm`}>
                    {isAI ? 'PI' : 'YOU'}
                  </span>
                  <div className={`rounded-lg p-3 max-w-[80%] ${
                    isAI 
                      ? 'bg-purple-600/30 text-purple-100' 
                      : 'bg-blue-600/30 text-blue-100'
                  }`}>
                    <p className="text-sm font-medium mb-1">{isAI ? 'Pi' : 'You'}</p>
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
                <div className="bg-blue-600/30 rounded-lg p-3 max-w-[80%] text-blue-100">
                  <p className="text-sm font-medium mb-1">You (speaking...)</p>
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
      </main>
    </div>
  );
};

export default App; 