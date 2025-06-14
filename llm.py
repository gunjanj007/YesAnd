import aiohttp
import asyncio
from keys import *

async def get_inflection_response(messages):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "Pi-3.1",  # Adjust based on your spec
        "messages": messages,
        "temperature": 0.9,
        "stream": False
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(API_URL, headers=headers, json=payload) as response:
            if response.status == 200:
                # Handle streaming response
                result = ""
                async for line in response.content:
                    decoded_line = line.decode("utf-8")
                    result += decoded_line
                return result
            else:
                raise Exception(f"Error: {response.status}, {await response.text()}")