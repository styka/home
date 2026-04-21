# VoiceDevApp — iOS Voice Assistant for Developers

iOS app (SwiftUI, iOS 17+) that lets you speak Polish questions to an AI programming assistant,
see answers rendered as Markdown, and hear them read aloud.

## Architecture

- **STT**: `SFSpeechRecognizer` with `pl-PL` locale — on-device, free, Apple
- **LLM**: Groq API (`llama-3.3-70b-versatile`) — free tier, 30 req/min, ultra-fast
- **TTS**: `AVSpeechSynthesizer` with `pl-PL` voice — on-device, free, Apple
- **Markdown**: `swift-markdown-ui` SwiftPM package (gonzalezreal/swift-markdown-ui)
- **Persistence**: `UserDefaults` + `Codable` (chat history, API key, settings)

## Key files

| File | Purpose |
|------|---------|
| `App/AppConfig.swift` | API key (UserDefaults), system prompt, model ID, constants |
| `Services/GroqService.swift` | REST calls to Groq API with 3× retry on network errors |
| `Services/SpeechRecognizer.swift` | STT wrapper — publishes `transcript` and `isListening` |
| `Services/SpeechSynthesizer.swift` | TTS wrapper — strips Markdown before speaking |
| `Features/Chat/ChatViewModel.swift` | Orchestrates STT→LLM→TTS, persists history to UserDefaults |
| `Features/Chat/ChatView.swift` | Main UI: message scroll, mic button, text input |
| `Features/Chat/MessageBubble.swift` | Renders assistant messages with MarkdownUI, user with plain Text |
| `Features/Settings/SettingsView.swift` | API key input, TTS toggle, voice list |

## Running

Requires Mac with Xcode 15+ and a physical iPhone (STT needs real device, not Simulator).

1. `open VoiceDevApp.xcodeproj` in Xcode
2. First run: Xcode will resolve the `swift-markdown-ui` package (~30 s)
3. Select your iPhone as destination
4. Cmd+R to build and run
5. In app → gear icon → paste Groq API key (free account at console.groq.com)

## Adding a new LLM provider

1. Create `Services/XyzService.swift` implementing the `LLMService` protocol
2. In `ChatViewModel.swift` change the `llmService` computed var to return the new service
3. Optionally expose model selection in `SettingsView`

## To switch to Google Gemini

Replace `GroqService` with a `GeminiService` that calls:
`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
Headers: `x-goog-api-key: YOUR_KEY`

## Bundle ID

Change `PRODUCT_BUNDLE_IDENTIFIER` in `project.pbxproj` from `com.yourname.VoiceDevApp`
to your own reverse-domain identifier before signing.
