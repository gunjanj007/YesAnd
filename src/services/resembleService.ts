import axios from 'axios';

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
    const response = await axios.post(
      `${RESEMBLE_API_URL}/projects/${process.env.REACT_APP_RESEMBLE_PROJECT_ID}/clips`,
      {
        body: text,
        voice_uuid: voiceId,
        is_public: false,
        is_archived: false,
      },
      {
        headers: {
          'Authorization': `Token token=${process.env.REACT_APP_RESEMBLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      audio_url: response.data.item.audio_src,
      success: true,
    };
  } catch (error) {
    console.error('Error generating voice response:', error);
    throw error;
  }
};

export const playAudio = (audioUrl: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio(audioUrl);
    audio.onended = () => resolve();
    audio.onerror = (error) => reject(error);
    audio.play();
  });
}; 