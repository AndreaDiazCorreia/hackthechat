# Ikigai Chat

An intelligent WhatsApp chatbot for managing personal notes using AI-powered content processing. Ikigai serves as your second brain, automatically organizing and retrieving information through natural conversation.

## Overview

Ikigai Chat transforms WhatsApp into a powerful note-taking system that understands context, extracts meaningful information, and stores everything in a structured Notion database. Simply send messages to the bot and it will intelligently categorize your thoughts, recipes, links, tasks, and ideas.

**Key Features:**
- Natural language processing for automatic content classification
- Intelligent tag assignment with support for multiple tags per note
- Advanced search capabilities with fuzzy matching and relevance scoring
- Seamless Notion integration for structured data storage
- Conversational interface with context awareness
- Support for ambiguous content with clarification requests

## Architecture

The system follows a clean layered architecture:

```
WhatsApp User → Baileys WebSocket → Express Backend → OpenAI API → Notion Database
```

**Core Components:**
- **Communication Layer**: WhatsApp integration via Baileys, message parsing and response formatting
- **Processing Layer**: Intent classification using OpenAI, content extraction and database query processing  
- **Data Layer**: Notion API client, database schema management and intelligent search algorithms

## Technology Stack

Built on the solid foundation of the [Baileys Starter](https://github.com/Volt-Chat/baileys-starter) boilerplate, Ikigai Chat extends it with advanced AI capabilities and database integration.

**Backend**: Node.js with TypeScript and Express
**WhatsApp Integration**: Baileys library for WhatsApp Web API
**AI Processing**: OpenAI GPT for content analysis and intent classification
**Database**: Notion API for structured note storage
**Logging**: Pino for structured logging with metadata support
**Testing**: Jest for unit and integration testing

## Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd ikigai-chat
npm install
```

## Configuration

Create a `.env` file based on `.env.example`:

```env
# Server Configuration
PORT=3000
BOT_NAME="Ikigai Bot"
LOG_LEVEL=info
SESSION_NAME=ikigai_session

# AI Configuration  
OPENAI_API_KEY=your_openai_api_key
AI_ENABLED=true
AI_SYSTEM_PROMPT="You are Ikigai, an intelligent assistant for note management."

# Notion Integration
NOTION_API_KEY=your_notion_integration_token
NOTION_DATABASE_ID=your_notion_database_id
```

## Usage

Start the bot in development mode:

```bash
npm run dev
```

For production deployment:

```bash
npm run build
npm start
```

The bot will generate a QR code for WhatsApp Web authentication. Scan it with your phone to connect.

## How It Works

**Saving Notes**: Send any message and Ikigai will automatically extract a title, organize the content, and assign appropriate tags. For example, sending "Pasta recipe: boil pasta, sauté garlic, add tomatoes" creates a structured recipe note.

**Searching Notes**: Ask natural questions like "What recipes do I have?" or "Show me notes about projects" to retrieve relevant information with intelligent ranking.

**Clarification**: When content is ambiguous, Ikigai asks clarifying questions to ensure proper categorization.

**Tag Management**: The system supports multiple tags per note and can suggest tags based on similar existing content.

## Project Structure

```
src/
├── ai/                    # OpenAI integration and prompt management
├── config/                # Environment configuration and settings
├── handlers/              # WhatsApp message processing and routing
├── logger/                # Structured logging with Pino
├── services/              # Core business logic (Notion, intent classification)
├── routes/                # Express API routes
├── server/                # Express server setup
├── socket/                # Baileys WebSocket connection management
├── store/                 # In-memory state management
├── types/                 # TypeScript type definitions
└── index.ts              # Application entry point
```

## Roadmap

### ✅ Completed Features
- **WhatsApp Integration**: Full Baileys implementation with session management
- **OpenAI Integration**: GPT-powered content analysis and intent classification
- **Notion Integration**: Structured note storage with multiple tag support
- **Intelligent Search**: Multi-level search with exact, synonym, and fuzzy matching
- **Conversational Context**: State management for natural dialogue flow

### 🚧 In Progress
- **Enhanced Conversational Responses**: More natural and contextual bot interactions
- **Advanced Content Processing**: Better handling of complex note structures

### 📋 Planned Features
- **User Authentication**: Multi-user support with secure session management
- **Database Customization**: Dynamic schema creation and field configuration
- **Voice Message Support**: Audio transcription and processing for WhatsApp voice notes
- **Calendar Integration**: Automatic event extraction and scheduling capabilities
- **Multi-Language Support**: Intelligent language detection and localized responses
- **Response Personalization**: User-specific communication styles and preferences
- **Advanced Analytics**: Usage patterns and note organization insights
- **Webhook Notifications**: Real-time updates and external integrations

## Contributing

We welcome contributions to Ikigai Chat. Please read our contributing guidelines and ensure all tests pass before submitting pull requests.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Acknowledgments

Built upon the excellent [Baileys Starter](https://github.com/Volt-Chat/baileys-starter) boilerplate by Volt-Chat, which provided the foundational WhatsApp integration and project structure.