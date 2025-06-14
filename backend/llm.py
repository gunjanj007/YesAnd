import aiohttp
import json  # Import JSON for parsing
import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

API_KEY = os.getenv("INFLECTION_API_KEY")
API_URL = os.getenv("INFLECTION_API_URL")


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
                # Parse the response content as JSON
                response_text = await response.text()
                return json.loads(response_text)  # Convert string to JSON object
            else:
                raise Exception(f"Error: {response.status}, {await response.text()}")