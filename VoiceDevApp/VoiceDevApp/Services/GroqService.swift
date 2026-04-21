import Foundation

final class GroqService: LLMService {
    private let apiKey: String

    init(apiKey: String) {
        self.apiKey = apiKey
    }

    func send(messages: [Message]) async throws -> String {
        guard !apiKey.isEmpty else { throw LLMError.missingAPIKey }
        guard let url = URL(string: AppConfig.groqBaseURL) else { throw LLMError.invalidURL }

        let requestMessages = messages.map { ["role": $0.role.rawValue, "content": $0.content] }
        let body: [String: Any] = [
            "model": AppConfig.groqModel,
            "messages": requestMessages,
            "max_tokens": 2048,
            "temperature": 0.7
        ]

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        var lastError: Error = LLMError.networkError("Unknown")
        for attempt in 0..<3 {
            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse else {
                    throw LLMError.networkError("Invalid response")
                }
                guard http.statusCode == 200 else {
                    let body = String(data: data, encoding: .utf8) ?? ""
                    throw LLMError.networkError("HTTP \(http.statusCode): \(body)")
                }
                let decoded = try JSONDecoder().decode(GroqResponse.self, from: data)
                guard let content = decoded.choices.first?.message.content else {
                    throw LLMError.emptyResponse
                }
                return content
            } catch let error as LLMError {
                // Don't retry on auth errors
                if case .missingAPIKey = error { throw error }
                lastError = error
            } catch {
                lastError = error
            }
            if attempt < 2 {
                try await Task.sleep(nanoseconds: UInt64(pow(2.0, Double(attempt))) * 1_000_000_000)
            }
        }
        throw lastError
    }
}

enum LLMError: LocalizedError {
    case missingAPIKey
    case invalidURL
    case networkError(String)
    case emptyResponse

    var errorDescription: String? {
        switch self {
        case .missingAPIKey:   return "Brak klucza API. Ustaw go w Ustawieniach."
        case .invalidURL:      return "Nieprawidłowy URL API."
        case .networkError(let m): return "Błąd sieci: \(m)"
        case .emptyResponse:   return "Pusta odpowiedź od API."
        }
    }
}

private struct GroqResponse: Decodable {
    let choices: [Choice]
    struct Choice: Decodable {
        let message: MessageContent
    }
    struct MessageContent: Decodable {
        let content: String
    }
}
