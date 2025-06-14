import axios from 'axios';
import { generateNextPrompt } from './promptService';

const RESEMBLE_API_URL = 'https://api.resemble.ai/v2';

export interface ResembleVoiceResponse {
  audio_url: string;
  success: boolean;
}

export const generateVoiceResponse = async (
  text: string,
  voiceId: string = 'default'
): Promise<ResembleVoiceResponse> => {
  try {
    console.log('Generating voice for text:', text);
    console.log('Using Resemble API key:', process.env.REACT_APP_RESEMBLE_API_KEY ? 'Present' : 'Missing');
    console.log('Using project ID:', process.env.REACT_APP_RESEMBLE_PROJECT_ID ? 'Present' : 'Missing');

    const response = await axios.post(
      `${RESEMBLE_API_URL}/projects/${process.env.REACT_APP_RESEMBLE_PROJECT_ID}/clips`,
      {
        body: text,
        voice_uuid: voiceId,
        is_public: false,
        is_archived: false,
        output_format: 'mp3'
      },
      {
        headers: {
          'Authorization': `Token token=${process.env.REACT_APP_RESEMBLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Resemble API response:', response.data);

    if (!response.data.item?.audio_src) {
      throw new Error('No audio URL in response');
    }

    return {
      audio_url: response.data.item.audio_src,
      success: true,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Resemble API Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
    } else {
      console.error('Error generating voice response:', error);
    }
    throw error;
  }
};

export const playAudio = (audioUrl: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log('Playing audio from URL:', audioUrl);
    
    const audio = new Audio(audioUrl);
    
    audio.oncanplaythrough = () => {
      console.log('Audio can play through');
    };
    
    audio.onplay = () => {
      console.log('Audio started playing');
    };
    
    audio.onended = () => {
      console.log('Audio playback completed');
      resolve();
    };
    
    audio.onerror = (error) => {
      console.error('Audio playback error:', error);
      reject(error);
    };

    // Start playing
    audio.play().catch(error => {
      console.error('Error starting audio playback:', error);
      reject(error);
    });
  });
};

// Helper function to check environment variables
const checkEnvVars = () => {
  const apiKey = process.env.REACT_APP_RESEMBLE_API_KEY;
  const projectId = process.env.REACT_APP_RESEMBLE_PROJECT_ID;
  
  if (!apiKey) {
    throw new Error('REACT_APP_RESEMBLE_API_KEY is not set in environment variables');
  }
  if (!projectId) {
    throw new Error('REACT_APP_RESEMBLE_PROJECT_ID is not set in environment variables');
  }
  
  return { apiKey, projectId };
};

export const testResembleCredentials = async (): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('Testing Resemble API connection...');
    
    // Check environment variables first
    const { apiKey, projectId } = checkEnvVars();
    console.log('API Key present:', apiKey ? 'Yes' : 'No');
    console.log('Project ID:', projectId);

    // Try to get project details
    const response = await axios.get(
      `${RESEMBLE_API_URL}/projects/${projectId}`,
      {
        headers: {
          'Authorization': `Token token=${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Project details:', response.data);

    if (response.data.item) {
      return {
        success: true,
        message: 'Successfully connected to Resemble API!'
      };
    } else {
      return {
        success: false,
        message: 'Project not found. Please check your project ID.'
      };
    }

  } catch (error) {
    if (error instanceof Error && error.message.includes('environment variables')) {
      return {
        success: false,
        message: error.message
      };
    }
    
    if (axios.isAxiosError(error)) {
      console.error('Resemble API Test Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });

      if (error.response?.status === 401) {
        return {
          success: false,
          message: 'Invalid API key. Please check your REACT_APP_RESEMBLE_API_KEY.'
        };
      } else if (error.response?.status === 404) {
        return {
          success: false,
          message: 'Project not found. Please check your REACT_APP_RESEMBLE_PROJECT_ID.'
        };
      }
    }
    
    return {
      success: false,
      message: 'Error testing credentials: ' + (error instanceof Error ? error.message : 'Unknown error')
    };
  }
};

export const listProjects = async (): Promise<{ success: boolean; message: string; projectUuid?: string }> => {
  try {
    console.log('Getting default Resemble project...');
    console.log('API Key present:', process.env.REACT_APP_RESEMBLE_API_KEY ? 'Yes' : 'No');

    const response = await axios.get(
      `${RESEMBLE_API_URL}/projects`,
      {
        headers: {
          'Authorization': `Token token=${process.env.REACT_APP_RESEMBLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        params: {
          page: 1,
          page_size: 10
        }
      }
    );

    console.log('Projects response:', response.data);

    if (response.data.items && response.data.items.length > 0) {
      const defaultProject = response.data.items[0];
      console.log('Default project:', defaultProject);
      
      return {
        success: true,
        message: `Found default project: ${defaultProject.name}`,
        projectUuid: defaultProject.uuid
      };
    } else {
      return {
        success: false,
        message: 'No projects found'
      };
    }

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('List Projects Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });

      if (error.response?.status === 401) {
        return {
          success: false,
          message: 'Invalid API key. Please check your REACT_APP_RESEMBLE_API_KEY.'
        };
      }
    }
    
    return {
      success: false,
      message: 'Error listing projects: ' + (error instanceof Error ? error.message : 'Unknown error')
    };
  }
};

export const testWelcomeMessage = async (): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('Testing welcome message synthesis...');
    const welcomeText = "Okay, let's play 'Questions Only'! I'll start";
    
    const response = await axios.post(
      `${RESEMBLE_API_URL}/projects/${process.env.REACT_APP_RESEMBLE_PROJECT_ID}/clips`,
      {
        body: welcomeText,
        voice_uuid: 'default',
        is_public: false,
        is_archived: false,
        output_format: 'mp3'
      },
      {
        headers: {
          'Authorization': `Token token=${process.env.REACT_APP_RESEMBLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Welcome message response:', response.data);

    if (response.data.item?.audio_src) {
      // Try to play the audio
      try {
        await playAudio(response.data.item.audio_src);
        return {
          success: true,
          message: 'Successfully generated and played welcome message!'
        };
      } catch (playError) {
        console.error('Error playing audio:', playError);
        return {
          success: false,
          message: 'Generated audio but failed to play it. Check console for details.'
        };
      }
    } else {
      return {
        success: false,
        message: 'No audio URL in response'
      };
    }

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Welcome Message Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });

      if (error.response?.status === 401) {
        return {
          success: false,
          message: 'Invalid API key. Please check your REACT_APP_RESEMBLE_API_KEY.'
        };
      }
    }
    
    return {
      success: false,
      message: 'Error testing welcome message: ' + (error instanceof Error ? error.message : 'Unknown error')
    };
  }
};

export const testGameStart = async (): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('Testing game start flow...');
    
    // First, get the prompt from Inflection AI
    console.log('Getting prompt from Inflection AI...');
    const promptResponse = await generateNextPrompt(
      '', // Empty string for first message
      [] // Empty history for first message
    );
    
    console.log('Inflection AI response:', promptResponse);

    // Then, send it to Resemble for voice synthesis
    console.log('Sending to Resemble for voice synthesis...');
    const response = await axios.post(
      `${RESEMBLE_API_URL}/projects/${process.env.REACT_APP_RESEMBLE_PROJECT_ID}/clips`,
      {
        body: promptResponse.prompt,
        voice_uuid: 'default',
        is_public: false,
        is_archived: false,
        output_format: 'mp3'
      },
      {
        headers: {
          'Authorization': `Token token=${process.env.REACT_APP_RESEMBLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Resemble response:', response.data);

    if (response.data.item?.audio_src) {
      // Try to play the audio
      try {
        await playAudio(response.data.item.audio_src);
        return {
          success: true,
          message: `Successfully generated and played: "${promptResponse.prompt}"`
        };
      } catch (playError) {
        console.error('Error playing audio:', playError);
        return {
          success: false,
          message: 'Generated audio but failed to play it. Check console for details.'
        };
      }
    } else {
      return {
        success: false,
        message: 'No audio URL in response'
      };
    }

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Game Start Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });

      if (error.response?.status === 401) {
        return {
          success: false,
          message: 'Invalid API key. Please check your REACT_APP_RESEMBLE_API_KEY.'
        };
      }
    }
    
    return {
      success: false,
      message: 'Error testing game start: ' + (error instanceof Error ? error.message : 'Unknown error')
    };
  }
}; 