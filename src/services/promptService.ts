import axios from 'axios';

const INFERENTIAL_API_URL = 'https://api.inferential.ai/v1';

export interface PromptResponse {
  prompt: string;
  success: boolean;
}

export const generateNextPrompt = async (
  userResponse: string,
  context: string[] = []
): Promise<PromptResponse> => {
  try {
    const response = await axios.post(
      `${INFERENTIAL_API_URL}/generate`,
      {
        prompt: `Given the following improv conversation context and user response, generate a creative, engaging follow-up question that builds on the user's response. The question should be whimsical, unexpected, and encourage creative thinking.

Context: ${context.join('\n')}
User Response: ${userResponse}

Generate a follow-up question:`,
        max_tokens: 100,
        temperature: 0.8,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_INFERENTIAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      prompt: response.data.choices[0].text.trim(),
      success: true,
    };
  } catch (error) {
    console.error('Error generating prompt:', error);
    throw error;
  }
}; 