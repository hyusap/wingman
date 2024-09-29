from fastapi import FastAPI
import os

app = FastAPI()
counter = 0


@app.get("/")
async def increment_counter():
    global counter
    counter += 1

    # Read the contents of parsed.txt
    try:
        with open("parsed.txt", "r") as f:
            parsed_content = f.read().strip()
    except FileNotFoundError:
        parsed_content = "File not found"
    except IOError:
        parsed_content = "Error reading file"

    return parsed_content
