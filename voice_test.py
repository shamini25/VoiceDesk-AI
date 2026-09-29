import asyncio
import base64
import json
import os

import sounddevice as sd
import websockets
from dotenv import load_dotenv


load_dotenv()

API_KEY = os.getenv("ASSEMBLYAI_API_KEY")

if not API_KEY:
    raise RuntimeError("ASSEMBLYAI_API_KEY not found in .env")


WS_URL = "wss://agents.assemblyai.com/v1/ws"

SAMPLE_RATE = 24000
CHANNELS = 1
DTYPE = "int16"
INPUT_DEVICE = 1


async def send_microphone(ws):
    loop = asyncio.get_running_loop()
    audio_queue = asyncio.Queue()

    def audio_callback(indata, frames, time, status):
        if status:
            print("Microphone:", status)

        audio_bytes = indata.copy().tobytes()

        loop.call_soon_threadsafe(
            audio_queue.put_nowait,
            audio_bytes
        )

    with sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype=DTYPE,
        device=INPUT_DEVICE,
        callback=audio_callback,
        blocksize=4800,
    ):
        print("\n🎤 Microphone is ON")
        print("Speak to VoiceDesk AI...")
        print("Press Ctrl+C to stop.\n")

        while True:
            audio_bytes = await audio_queue.get()

            await ws.send(json.dumps({
                "type": "input.audio",
                "audio": base64.b64encode(audio_bytes).decode("utf-8"),
            }))


async def receive_messages(ws):
    async for raw_message in ws:
        event = json.loads(raw_message)
        event_type = event.get("type")

        if event_type == "session.ready":
            print("✅ Voice session ready!")

        elif event_type == "transcript.user.delta":
            text = event.get("text", "")
            print(f"\rYou: {text}", end="", flush=True)

        elif event_type == "transcript.user":
            text = event.get("text", "")
            print(f"\nYou: {text}")

        elif event_type == "transcript.agent":
            text = event.get("text", "")
            print(f"VoiceDesk AI: {text}")

        elif event_type == "reply.started":
            print("\n🤖 VoiceDesk AI is thinking...")

        elif event_type == "reply.done":
            print("✅ Response complete")

        elif event_type == "session.error":
            print("\n❌ Session error:")
            print(event)

        else:
            # Useful while developing
            print(f"\nEvent: {event_type}")


async def main():

    print("Connecting to VoiceDesk AI...")

    headers = {
        "Authorization": f"Bearer {API_KEY}"
    }

    async with websockets.connect(
        WS_URL,
        additional_headers=headers,
    ) as ws:

        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "system_prompt": (
                    "You are VoiceDesk AI, a professional and friendly "
                    "customer support assistant. "
                    "Keep your responses short, natural and conversational. "
                    "Help customers clearly and politely."
                ),
                "greeting": (
                    "Hello! I'm VoiceDesk AI. "
                    "How can I help you today?"
                ),
                "output": {
                    "voice": "anna"
                },
            },
        }))

        print("Configuration sent.")
        print("Waiting for session...")

        receiver = asyncio.create_task(
            receive_messages(ws)
        )

        await asyncio.sleep(1)

        microphone = asyncio.create_task(
            send_microphone(ws)
        )

        try:
            await asyncio.gather(
                receiver,
                microphone
            )

        except KeyboardInterrupt:
            print("\nStopping VoiceDesk AI...")

        finally:
            receiver.cancel()
            microphone.cancel()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nVoiceDesk AI stopped.")