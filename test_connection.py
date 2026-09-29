import asyncio
import json
import os

import websockets
from dotenv import load_dotenv


load_dotenv()

API_KEY = os.getenv("ASSEMBLYAI_API_KEY")

if not API_KEY:
    raise RuntimeError("ASSEMBLYAI_API_KEY was not found in .env")

WS_URL = "wss://agents.assemblyai.com/v1/ws"


async def test_connection():
    print("Connecting to AssemblyAI Voice Agent...")

    async with websockets.connect(
        WS_URL,
        additional_headers={
            "Authorization": f"Bearer {API_KEY}"
        },
    ) as ws:

        print("WebSocket connected!")

        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "system_prompt": (
                    "You are VoiceDesk AI, a friendly customer support "
                    "voice assistant."
                ),
                "greeting": "Hello! Welcome to VoiceDesk AI. How can I help you?",
                "output": {
                    "voice": "ivy"
                },
            },
        }))

        print("Session configuration sent.")
        print("Waiting for AssemblyAI...")

        while True:
            message = await ws.recv()
            data = json.loads(message)

            print("Event:", data.get("type"))

            if data.get("type") == "session.ready":
                print("\nSUCCESS!")
                print("VoiceDesk AI is connected to AssemblyAI.")
                print("Session ID:", data.get("session_id"))
                break

            if data.get("type") == "error":
                print("\nAssemblyAI returned an error:")
                print(data)
                break


if __name__ == "__main__":
    asyncio.run(test_connection())