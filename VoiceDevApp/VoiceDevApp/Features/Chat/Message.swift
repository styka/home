import Foundation

struct Message: Identifiable, Codable, Equatable {
    let id: UUID
    let role: Role
    let content: String
    let createdAt: Date

    init(id: UUID = UUID(), role: Role, content: String, createdAt: Date = Date()) {
        self.id = id
        self.role = role
        self.content = content
        self.createdAt = createdAt
    }

    enum Role: String, Codable {
        case user
        case assistant
        case system
    }
}
