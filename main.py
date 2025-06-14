from llm import get_inflection_response
import asyncio
from keys import GAMES

game = "YesAnd"  # Example game, adjust as needed
system_prompt = GAMES[game]  # Assuming 'game' is the key in the GAMES dict

async def conversation():
    messages = [{"role": "system", "content": system_prompt}]

    while True:
        user_input = input("You: ")
        if user_input.lower() in ["exit", "quit"]:
            print("Conversation ended.")
            break

        messages.append({"role": "user", "content": user_input})
        response = await get_inflection_response(messages)
        print("System:", response["choices"][0]["message"]["content"])
        messages.append({"role": "system", "content": response})

asyncio.run(conversation())