import asyncio
import bleak
from bleak import BleakClient
import wave
from datetime import datetime
import numpy as np
import time
import os
import struct
from scipy.signal import stft, istft
import websockets
import aiohttp

import os
import aiohttp
import threading
import json
import websockets
import asyncio

DEVICE_NAME = "Friend"
SERVICE_UUID = "19B10000-E8F2-537E-4F6C-D104768A1214"
CHARACTERISTIC_UUID = "19B10001-E8F2-537E-4F6C-D104768A1214"

CODEC = "pcm"  # "pcm" or "mulaw"
SAMPLE_RATE = 8000  # Sample rate for the audio
SAMPLE_WIDTH = 2  # 16-bit audio
CHANNELS = 1  # Mono audio
CAPTURE_TIME = 1  # Time to capture audio in seconds

URL = "http://stream.live.vc.bbcmedia.co.uk/bbc_world_service"


DEEPGRAM_URL = f"wss://api.deepgram.com/v1/listen?punctuate=true&model=nova-2&language=en-US&diarize=true&interim_results=false&smart_format=true"


def ulaw2linear(ulaw_byte):
    """Convert a µ-law byte to a 16-bit linear PCM value."""
    EXPONENT_LUT = [0, 132, 396, 924, 1980, 4092, 8316, 16764]
    ulaw_byte = ~ulaw_byte
    sign = ulaw_byte & 0x80
    exponent = (ulaw_byte >> 4) & 0x07
    mantissa = ulaw_byte & 0x0F
    sample = EXPONENT_LUT[exponent] + (mantissa << (exponent + 3))
    if sign != 0:
        sample = -sample

    return sample


def ulaw_bytes_to_pcm16(ulaw_data):
    """Convert a sequence of µ-law encoded bytes to a list of 16-bit PCM values."""
    return [ulaw2linear(byte) for byte in ulaw_data]


async def main():

    async with websockets.connect(
        DEEPGRAM_URL, extra_headers={"Authorization": f"Token {API_KEY}"}
    ) as ws:

        # async def receiver():
        #     async for message in ws:
        #         response = json.loads(message)
        #         words = (
        #             response.get("channel", {})
        #             .get("alternatives", [{}])[0]
        #             .get("words", [])
        #         )
        #         speaker_transcripts = {}

        #         # Group words by speaker
        #         for word_info in words:
        #             speaker = word_info.get("speaker", 0)
        #             word = word_info.get("punctuated_word", "")
        #             if speaker not in speaker_transcripts:
        #                 speaker_transcripts[speaker] = []
        #             speaker_transcripts[speaker].append(word)

        #         # Write sentences grouped by speaker to file
        #         with open("transcripts.txt", "a") as file:
        #             for speaker, transcript in speaker_transcripts.items():
        #                 sentence = " ".join(transcript)
        #                 file.write(f"Speaker {speaker}: {sentence}\n")

        print(
            f"Connected to Deepgram. Request ID: {ws.response_headers.get('dg-request-id')}"
        )

        async def receiver():
            # global ws
            print("RECEIVER")
            async for message in ws:
                print("SOMETHING")
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
                    print(f"Speaker {speaker}: {sentence}")

        print("Discovering AudioRecorder...")
        devices = await bleak.discover(timeout=2.0)
        audio_recorder = None
        for device in devices:
            if device.name:
                print(device.name, device.address, device.rssi)
            if "A297" in device.address:
                audio_recorder = device
            # if device.name == FRIEND_NAME:
            # if device.name == DEVICE_NAME:
            #     audio_recorder = device
            #     break

        if not audio_recorder:
            print("AudioRecorder not found")
            return

        def handle_ble_disconnect(client):
            print("Disconnected from AudioRecorder")

        def filter_audio_data(audio_data):

            if CODEC == "mulaw":
                # pcm16_samples = audioop.ulaw2lin(audio_data, 2)
                # pcm16_samples = struct.unpack('<' + 'h' * (len(pcm16_samples) // 2), pcm16_samples)
                # print(pcm16_samples)
                pcm16_samples = ulaw_bytes_to_pcm16(audio_data)
                audio_data = np.array(pcm16_samples, dtype=np.int16)

            if CODEC == "pcm":
                audio_data = audio_data[: len(audio_data) - len(audio_data) % 2]
                audio_data = np.frombuffer(audio_data, dtype=np.int16)

            # Normalize
            # scaling_factor = 2*32768 / (max(0, np.max(audio_data)) - min(0, np.min(audio_data)))
            # return (audio_data * scaling_factor).astype(np.int16)
            return audio_data

        async def export_audio_data(filtered_audio_data, raw_file, file_extension):
            recordings_dir = "recordings"
            if not os.path.exists(recordings_dir):
                os.makedirs(recordings_dir)
            filename = os.path.join(
                recordings_dir, datetime.now().strftime("%H-%M-%S-%f") + file_extension
            )
            print(filename)
            # filename = os.path.join(recordings_dir, "recording" + file_extension)
            if file_extension == ".txt":
                with open(filename, "w") as file:
                    file.write(str(list(raw_file)))
            else:
                # Directly use the filename with wave.open for .wav files
                with wave.open(filename, "wb") as wav_file:
                    wav_file.setnchannels(CHANNELS)
                    wav_file.setsampwidth(SAMPLE_WIDTH)
                    wav_file.setframerate(SAMPLE_RATE)
                    wav_file.writeframes(
                        filtered_audio_data.tobytes()
                    )  # Ensure data is in bytes format
                # await ws.send(filtered_audio_data.tobytes())

        async def process_audio(audio_data):
            if len(audio_data) == 0:
                print("Warning: Received empty audio data array.")
                return

            filtered_audio_data = filter_audio_data(audio_data)

            export_audio_data(filtered_audio_data, audio_data, ".wav")
            # export_audio_data(filtered_audio_data, audio_data, ".txt")
            pass

        async with BleakClient(
            audio_recorder.address,
            services=[SERVICE_UUID],
            disconnect_callback=handle_ble_disconnect,
        ) as client:
            print("Connected to AudioRecorder")
            services = await client.get_services()
            audio_service = services.get_service(SERVICE_UUID)
            audio_characteristic = audio_service.get_characteristic(CHARACTERISTIC_UUID)

            audio_data = bytearray()
            # end_signal = b"\xFF"

            async def handle_audio_data(sender, data):
                # global ws
                # print("run")
                try:
                    pcm = data[3:]
                    # print(pcm)
                    await ws.send(pcm)
                    audio_data.extend(data[3:])
                except websockets.exceptions.ConnectionClosedOK:
                    # print("WebSocket connection closed normally.")
                    pass
                except Exception as e:
                    print(f"An error occurred: {e}")
                # if data == [end_signal]:
                #     print(f"End signal received after {len(audio_data)} bytes")

            async def record_audio():
                await client.start_notify(audio_characteristic.uuid, handle_audio_data)
                print("Recording audio...")
                await asyncio.sleep(CAPTURE_TIME)
                print("Recording stopped")
                await client.stop_notify(audio_characteristic.uuid)

            async def record_and_process():
                while True:
                    await record_audio()
                    print(len(audio_data))
                    asyncio.ensure_future(process_audio(audio_data.copy()))
                    audio_data.clear()

            await asyncio.gather(record_and_process(), receiver())

            # await record_audio()


asyncio.run(main())
