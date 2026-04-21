import Foundation

protocol LLMService {
    func send(messages: [Message]) async throws -> String
}
