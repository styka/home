import Foundation

@MainActor
final class ChatViewModel: ObservableObject {
    @Published var messages: [Message] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    let speechRecognizer = SpeechRecognizer()
    let speechSynthesizer = SpeechSynthesizer()

    private var llmService: LLMService { GroqService(apiKey: AppConfig.groqAPIKey) }

    init() { loadHistory() }

    func sendCurrentTranscript() {
        let text = speechRecognizer.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        speechRecognizer.stopListening()
        send(text: text)
    }

    func send(text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        messages.append(Message(role: .user, content: trimmed))
        saveHistory()
        Task { await callLLM() }
    }

    func clearHistory() {
        messages = []
        saveHistory()
    }

    private func callLLM() async {
        isLoading = true
        errorMessage = nil

        var ctx: [Message] = [Message(role: .system, content: AppConfig.systemPrompt)]
        ctx.append(contentsOf: messages.suffix(AppConfig.maxHistoryMessages))

        do {
            let response = try await llmService.send(messages: ctx)
            messages.append(Message(role: .assistant, content: response))
            saveHistory()
            if AppConfig.ttsEnabled {
                speechSynthesizer.speak(response)
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    private func saveHistory() {
        guard let data = try? JSONEncoder().encode(messages) else { return }
        UserDefaults.standard.set(data, forKey: "chatHistory")
    }

    private func loadHistory() {
        guard let data = UserDefaults.standard.data(forKey: "chatHistory"),
              let saved = try? JSONDecoder().decode([Message].self, from: data) else { return }
        messages = saved
    }
}
