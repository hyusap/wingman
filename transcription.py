import re
import time
from openai import OpenAI
import io
import base64

# from PIL import Image
import os
import numpy as np


def gpt(prompt, model="gpt-4o-mini"):
    # print("GPT CALLED")
    # return ["Yes", "No"]
    """
    Creates a chat completion using the OpenAI API, with a prompt and an array of images.

    Args:
        prompt (str): The text prompt to send to the API.
        images (list): A list of PIL Image objects.

    Returns:
        dict: Response object from the OpenAI API call.
    """
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    # Start constructing the content
    content = [{"type": "text", "text": prompt}]

    # Construct the messages
    messages = [{"role": "user", "content": content}]

    # Make the API call
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=1,
        max_tokens=2048,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0,
        response_format={"type": "text"},
    )

    return response.choices[0].message.content


# transcript = """
# Person 1: Hello, how
# Person 1: are you.
# Person 2: I am fine,
# Person 2: thank you.
# Person 1: That's good to hear.
# Person 2: Yes, it is.
# Person 1: What are you up to?
# Person 2: Not much, just relaxing.
# Person 1: Sounds nice, but I have a huge rash on my back.
# Person 2: "Uh, okay."
# Person 1: Oh also, I forgot to tell you about how I won at Cal Hacks.
# Person 1: I went there with an awesome team and totally blew everyone away.
# Person 1: We won first place and 2 thousand dollars.
# Person 1: We celebrated by going to the beach after. Then we went to a party.
# Person 2: Okay, talk to you later.
# Person 1: Bye!
# """
transcript = """
Person 1: Hey, how's it going?
Person 2: I'm good, how about you?
Person 1: I'm doing well, just got back from a crazy week at college.
Person 2: Oh really? What happened?
Person 1: Well, first, I slept through my alarm and missed my morning class. I was so embarrassed.
Person 1: Then, later in the week, I had a massive group project due, and everyone was freaking out.
Person 1: We had to pull an all-nighter to finish it on time.
Person 1: But, somehow, we managed to get an A on it!
Person 1: I couldn’t believe it. It was so crazy. Honestly, I'm still recovering from it. 
Person 2: Yikes, did you manage to finish it?
Person 1: Barely! We pulled an all-nighter, but we actually got an A! I couldn’t believe it.
Person 2: That’s awesome, congrats! So, how did you celebrate?
Person 1: Oh, we went to the campus food truck, had way too many tacos, and then just crashed afterward.
Person 2: Haha, sounds like a typical college night.
Person 1: Pretty much! Anyway, what's new with you?
"""


context = []


def parse(sentence, context_len=5):
    # if not sentence.startswith("Person 0") or sentence.startswith("person 0"):
    #     return ""

    context_string = "\n".join(context[-context_len:])

    directions = """
        Read this conversation and return a single word that will tell us if a person is making one of the following conversaional mistakes
        1. 30 words or more before the other partner speaks : return "Let the other person speak".
        2. Saying something embarassing: return "Wtf? You goofy.".
        3. Feel free to write any 3 word complaint about the person.
        """

    prompt = directions + context_string + "\n" + sentence

    response = gpt(prompt)

    # print(response)
    print(sentence)
    return response

    # if response == "NONE":
    #     return "All good"
    # else:
    #     return response


import os
import json
import websockets
import asyncio
import pyaudio

API_KEY = (
    "0b5616b51b719a410c5b97e92eb64eea4ff1c3f7"  # Replace with your Deepgram API key
)

DEEPGRAM_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?punctuate=true"
    "&model=nova-2"
    "&language=en-US"
    "&diarize=true"
    "&interim_results=false"
    "&smart_format=true"
    "&encoding=linear16"
    "&sample_rate=16000"
)


async def transcribe():
    async with websockets.connect(
        DEEPGRAM_URL, extra_headers={"Authorization": f"Token {API_KEY}"}
    ) as ws:
        print(
            f"Connected to Deepgram. Request ID: {ws.response_headers.get('dg-request-id')}"
        )

        # Get the current event loop
        loop = asyncio.get_running_loop()
        audio_queue = asyncio.Queue()

        # Define mic_callback inside so it can access loop and audio_queue
        def mic_callback(input_data, frame_count, time_info, status_flag):
            loop.call_soon_threadsafe(audio_queue.put_nowait, input_data)
            return (input_data, pyaudio.paContinue)

        async def microphone():
            p = pyaudio.PyAudio()

            FORMAT = pyaudio.paInt16  # 16-bit resolution
            CHANNELS = 1  # Mono audio
            RATE = 16000  # Sampling rate
            CHUNK = 1024  # Buffer size

            stream = p.open(
                format=FORMAT,
                channels=CHANNELS,
                rate=RATE,
                input=True,
                frames_per_buffer=CHUNK,
                stream_callback=mic_callback,
            )

            stream.start_stream()

            try:
                while stream.is_active():
                    await asyncio.sleep(0.1)
            finally:
                stream.stop_stream()
                stream.close()
                p.terminate()

        async def receiver():
            async for message in ws:
                response = json.loads(message)
                words = (
                    response.get("channel", {})
                    .get("alternatives", [{}])[0]
                    .get("words", [])
                )
                speaker_transcripts = {}

                # Group words by speaker
                for word_info in words:
                    speaker = word_info.get("speaker", 0)
                    word = word_info.get("punctuated_word", "")
                    if speaker not in speaker_transcripts:
                        speaker_transcripts[speaker] = []
                    speaker_transcripts[speaker].append(word)

                # Print sentences grouped by speaker
                for speaker, transcript in speaker_transcripts.items():
                    sentence = " ".join(transcript)
                    # print(f"Speaker {speaker}: {sentence}")
                    text = f"Person {speaker}: {sentence}"
                    print(text)
                    parsed = parse(text)
                    print(parsed)
                    with open("parsed.txt", "w") as f:
                        f.write(str(parsed))

        async def sender():
            while True:
                data = await audio_queue.get()
                await ws.send(data)

        await asyncio.gather(microphone(), sender(), receiver())


def main():
    try:
        asyncio.run(transcribe())
    except Exception as e:
        print(f"Could not open socket: {e}")


if __name__ == "__main__":
    main()
