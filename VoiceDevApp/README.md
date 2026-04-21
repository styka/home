# VoiceDevApp

Voice-first iOS assistant for developers. Speak Polish questions, get Markdown answers rendered on screen and read aloud.

## Features

- Hold mic to speak in Polish, release to send
- Or type in the text field
- Responses rendered as Markdown (headers, code blocks, bold)
- Automatic Polish TTS (toggleable)
- Chat history persisted between restarts

## Requirements

- Mac with Xcode 15+
- iPhone with iOS 17+ (STT does not work on Simulator)
- Free [Groq API account](https://console.groq.com) (30 req/min free)

## Setup

1. Clone this repo
2. `open VoiceDevApp.xcodeproj` in Xcode
3. Wait for `swift-markdown-ui` package to resolve (~30 s)
4. Select your iPhone as destination, press Cmd+R
5. In app: tap gear icon → paste your Groq API key

### Install Polish voice (for TTS)

iOS Settings → Accessibility → Spoken Content → Voices → Polish → download any voice

### Change bundle ID

In Xcode: click the project → Signing & Capabilities → Bundle Identifier → set your own

## Tech stack

| Layer | Technology |
|-------|-----------|
| UI | SwiftUI |
| STT | Apple SFSpeechRecognizer (pl-PL) |
| LLM | Groq API — llama-3.3-70b-versatile |
| TTS | Apple AVSpeechSynthesizer (pl-PL) |
| Markdown | swift-markdown-ui |
