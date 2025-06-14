from backend.llm import get_inflection_response
import asyncio
from backend.games import GAMES
from backend.speech import speech_to_text, text_to_speech


game = "YesAnd"  # Example game, adjust as needed
system_prompt = GAMES[game]  # Assuming 'game' is the key in the GAMES dict

async def conversation():
    messages = [{"role": "system", "content": system_prompt}]

    while True:
        text_to_speech("You can speak now.")
        user_input = speech_to_text()
        print("You:", user_input)  # Optional: Print user input for debugging
        if user_input.lower() in ["exit", "quit"]:
            text_to_speech("Conversation ended.")
            break

        messages.append({"role": "user", "content": user_input})
        response = await get_inflection_response(messages)
        system_response = response["choices"][0]["message"]["content"]
        print(system_response)
        print("System:", system_response)  # Optional: Print system response for debugging
        text_to_speech(system_response)
        messages.append({"role": "system", "content": system_response})

asyncio.run(conversation())