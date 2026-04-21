import Foundation

enum AppConfig {
    static var groqAPIKey: String {
        get { UserDefaults.standard.string(forKey: "groqAPIKey") ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: "groqAPIKey") }
    }

    static var ttsEnabled: Bool {
        get { UserDefaults.standard.object(forKey: "ttsEnabled") as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: "ttsEnabled") }
    }

    static let systemPrompt = """
    Jesteś pomocnikiem programisty. Odpowiadaj po polsku.
    Używaj Markdown: nagłówki dla sekcji, bloki kodu z językiem, pogrubienie dla kluczowych terminów.
    Bądź zwięzły i konkretny. Jeśli pytanie jest krótkie, odpowiedź też powinna być krótka.
    """

    static let groqModel = "llama-3.3-70b-versatile"
    static let groqBaseURL = "https://api.groq.com/openai/v1/chat/completions"
    static let maxHistoryMessages = 20
}
