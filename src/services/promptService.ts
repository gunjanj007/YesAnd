import axios from 'axios';

const INFLECTION_API_URL = 'https://api.inflection.ai/external/api/inference';
const TEST_API_KEY = '5UlsrRfEkZwQ5LBNm88BTmqNY8QNZHE6i0wCQx4RFXI';

interface Message {
  text: string;
  type: 'Human' | 'Assistant';
}

export interface PromptResponse {
  prompt: string;
  success: boolean;
}

export const generateNextPrompt = async (
  userResponse: string,
  context: string[] = []
): Promise<PromptResponse> => {
  try {
    // Convert conversation history to Inflection format
    const messages: Message[] = context.map(msg => {
      const [speaker, text] = msg.split(': ');
      return {
        text: text,
        type: speaker === 'AI' ? 'Assistant' : 'Human'
      };
    });

    // Add the current user response
    messages.push({
      text: userResponse,
      type: 'Human'
    });

    const requestData = {
      context: messages,
      config: 'Pi-3.1'
    };

    console.log('Sending request to Inflection AI with:', requestData);
    
    // Use the test API key directly for now
    const apiKey = TEST_API_KEY;
    console.log('Using API Key:', apiKey ? 'Present' : 'Missing');

    const response = await axios({
      method: 'post',
      url: INFLECTION_API_URL,
      data: requestData,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000, // 10 second timeout
    });

    console.log('Inflection AI response:', response.data);

    if (!response.data.response) {
      throw new Error('No response from Inflection AI');
    }

    return {
      prompt: response.data.response,
      success: true,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Inflection AI API Error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });

      // Check for specific error types
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timed out. Please try again.');
      } else if (!error.response) {
        throw new Error('Network error. Please check your internet connection.');
      } else if (error.response.status === 401) {
        throw new Error('Authentication failed. Please check your API key.');
      } else if (error.response.status === 403) {
        throw new Error('Access denied. Please check your API permissions.');
      } else {
        throw new Error(`API Error: ${error.response.status} - ${error.response.statusText}`);
      }
    } else {
      console.error('Error generating prompt:', error);
      throw error;
    }
  }
}; 