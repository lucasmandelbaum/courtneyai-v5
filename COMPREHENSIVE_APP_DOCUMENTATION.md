# CourtneyAI v5 - Comprehensive Application Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Core Features](#core-features)
4. [Database Schema](#database-schema)
5. [Authentication & Authorization](#authentication--authorization)
6. [AI/ML Capabilities](#aiml-capabilities)
7. [Edge Functions](#edge-functions)
8. [Frontend Components](#frontend-components)
9. [State Management](#state-management)
10. [Payment Integration](#payment-integration)
11. [Usage Tracking & Limits](#usage-tracking--limits)
12. [Media Processing](#media-processing)
13. [Organization Management](#organization-management)
14. [User Interface](#user-interface)
15. [API Integration](#api-integration)
16. [Deployment & Infrastructure](#deployment--infrastructure)

---

## Overview

CourtneyAI v5 is a sophisticated AI-powered video creation platform that transforms product information into engaging video content and social media reels. The application serves as a comprehensive content creation suite for businesses and creators looking to generate professional marketing videos with minimal manual effort.

### Key Value Propositions
- **AI-Driven Content Creation**: Automated script generation and video creation from product data
- **Multi-Media Processing**: Support for photos, videos, and audio content
- **Organization Management**: Multi-tenant architecture supporting team collaboration
- **Usage-Based Billing**: Stripe integration with tiered subscription plans
- **Real-Time Processing**: Live status updates for video generation tasks
- **Professional Output**: High-quality 1080x1920 (9:16) video reels optimized for social media

---

## Architecture & Tech Stack

### Frontend Stack
- **Framework**: Next.js 15 with App Router
- **Runtime**: React 19 with TypeScript
- **UI Libraries**: 
  - NextUI/HeroUI for component library
  - Radix UI for advanced components
  - Framer Motion for animations
  - Tailwind CSS for styling
- **State Management**: Custom React hooks with local state
- **Package Manager**: Yarn

### Backend Stack
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Edge Functions**: Deno-based serverless functions
- **Storage**: Supabase Storage (multiple buckets)
- **Real-time**: Supabase Realtime subscriptions

### Third-Party Services
- **Payment Processing**: Stripe
- **AI Services**: 
  - Fal.ai (LLM and vision models)
  - ElevenLabs (text-to-speech and speech-to-text)
  - Creatomate (video rendering)
- **Models Used**:
  - `deepseek/deepseek-r1` for script generation
  - `anthropic/claude-3.5-sonnet` for image analysis

### Infrastructure
- **Deployment**: Vercel (recommended)
- **CDN**: Supabase Storage with CDN
- **Monitoring**: Structured logging throughout edge functions

---

## Core Features

### 1. Product Management
- **Product Creation**: Support for manual entry and URL-based import
- **Product Data**: Name, description, URL, and thumbnail management
- **Media Association**: Link photos and videos to products
- **Bulk Operations**: Batch processing and management capabilities

### 2. AI Script Generation
- **Automated Script Creation**: AI-powered script generation from product descriptions
- **Hook-Based Templates**: Utilizes categorized hook templates for engaging openings
- **Manual Script Creation**: Alternative manual script editing capability
- **Caption Generation**: Automatic TikTok-style captions with hashtags
- **Script Management**: Full CRUD operations for scripts

### 3. AI Video Generation (Reel Creation)
- **Multi-Step Process**: 
  1. Script selection
  2. Media selection (photos/videos)
  3. Audio generation from script
  4. Video composition and rendering
  5. Subtitle generation and overlay
- **Real-Time Status Updates**: Live progress tracking with detailed status messages
- **Template System**: Configurable video templates
- **Output Format**: 1080x1920 MP4 optimized for social media

### 4. Media Management
- **Upload Support**: Photos (JPEG, PNG) and videos (MP4, MOV)
- **Storage Organization**: User-scoped storage with organized folder structure
- **Media Processing**: Automatic thumbnail generation and metadata extraction
- **Batch Operations**: Multiple file upload and management
- **AI Image Analysis**: Automatic description generation for uploaded images

### 5. Content Organization
- **Project-Based Structure**: Products serve as containers for all content
- **Media Library**: Centralized media management per product
- **Script Library**: Version-controlled script management
- **Reel Gallery**: Generated video collection with status tracking

---

## Database Schema

### Core Tables

#### `users`
- User account information
- Integrates with Supabase Auth
- Links to organization memberships

#### `organizations`
- Multi-tenant organization structure
- Subscription and billing information
- Member management

#### `products`
- Product information and metadata
- User-scoped with RLS (Row Level Security)
- Supports URL and description fields

#### `photos` & `videos`
- Media file metadata and storage paths
- Linked to products via foreign keys
- AI-generated descriptions

#### `scripts`
- AI and manually generated scripts
- Caption and metadata storage
- Hook template tracking

#### `reels`
- Generated video metadata
- Status tracking and progress details
- Links scripts and media through reel_media table

#### `audio`
- Generated audio files from scripts
- Transcription data storage
- Links to reels for video generation

#### `usage_tracking`
- Monthly usage metrics per user
- Supports multiple usage types (scripts, reels, etc.)
- Real-time usage monitoring

### Relationships
- **Hierarchical Structure**: Users → Organizations → Products → Media/Scripts/Reels
- **Many-to-Many**: Reels can include multiple photos and videos
- **Audit Trail**: Timestamps and user tracking on all entities

---

## Authentication & Authorization

### Authentication Methods
- **Email/Password**: Standard authentication
- **Social Logins**: Configurable via Supabase Auth
- **Session Management**: JWT-based with automatic refresh

### Authorization System
- **Row Level Security (RLS)**: Database-level access control
- **Organization-Scoped Access**: Multi-tenant data isolation
- **Role-Based Permissions**: Admin and member roles
- **API Security**: Bearer token validation on all endpoints

### Security Features
- **CORS Protection**: Configured headers for cross-origin requests
- **Input Validation**: Server-side validation on all inputs
- **Rate Limiting**: Built into edge functions
- **Secure Storage**: Encrypted data at rest

---

## AI/ML Capabilities

### 1. Script Generation AI
- **Model**: DeepSeek R1 via Fal.ai
- **Input**: Product name, description, and hook templates
- **Output**: Structured script with content and TikTok caption
- **Features**:
  - Hook-based templates for engagement
  - Brand-safe content guidelines
  - Phonetic optimization for text-to-speech

### 2. Image Analysis AI
- **Model**: Claude 3.5 Sonnet via Fal.ai
- **Input**: Product images
- **Output**: Detailed image descriptions
- **Use Cases**:
  - Automatic alt-text generation
  - Content moderation
  - Media organization

### 3. Audio Generation
- **Service**: ElevenLabs Text-to-Speech
- **Features**:
  - High-quality voice synthesis
  - Word-level timing data
  - Multiple voice options
  - Audio event detection

### 4. Video Composition AI
- **Service**: Creatomate rendering engine
- **Capabilities**:
  - Automatic media sequencing
  - Subtitle generation and positioning
  - Scene transitions
  - Audio synchronization

---

## Edge Functions

### 1. `generate-script`
- **Purpose**: AI-powered script creation
- **Input**: Product ID
- **Process**:
  1. Fetch product data
  2. Select random hook template
  3. Generate script via AI
  4. Parse and save script
  5. Update usage metrics
- **Output**: Script with metadata and usage info

### 2. `generate-reel`
- **Purpose**: Complete video generation pipeline
- **Input**: Product ID, script ID, media IDs
- **Process**:
  1. Validate inputs and check usage limits
  2. Generate audio from script
  3. Process and analyze media
  4. Create video composition request
  5. Render video with subtitles
  6. Store final output
- **Output**: Rendered video file and metadata

### 3. `analyze-image`
- **Purpose**: AI-powered image description
- **Input**: Image URL and product ID
- **Process**:
  1. Validate image access
  2. Send to Claude 3.5 Sonnet
  3. Process AI response
- **Output**: Detailed image description

### 4. `create-script`
- **Purpose**: Manual script creation
- **Input**: Script content, title, caption
- **Process**:
  1. Validate user permissions
  2. Check usage limits
  3. Save script to database
  4. Update usage metrics
- **Output**: Saved script with usage info

### 5. `text-to-speech`
- **Purpose**: Audio generation from script
- **Input**: Script text
- **Process**:
  1. Send to ElevenLabs API
  2. Generate high-quality audio
  3. Extract transcription data
  4. Store in Supabase Storage
- **Output**: Audio file URL and transcription

### 6. Stripe Integration Functions
- **`create-checkout-session`**: Subscription setup
- **`stripe-webhooks`**: Payment event handling
- **`invite-member`**: Organization member invitations

---

## Frontend Components

### Core Components

#### `ReelCreator`
- **Purpose**: Multi-step reel creation wizard
- **Features**:
  - Script selection interface
  - Media selection with preview
  - Real-time status tracking
  - Usage limit enforcement
- **State Management**: Local state with real-time updates

#### `ScriptGenerator`
- **Purpose**: AI and manual script creation
- **Features**:
  - AI generation with product context
  - Manual script editor
  - Usage tracking display
  - Form validation and error handling

#### `MediaUploader`
- **Purpose**: File upload and management
- **Features**:
  - Drag-and-drop interface
  - Progress tracking
  - File type validation
  - Batch upload support

#### `VideoPreview`
- **Purpose**: Video playback with status overlay
- **Features**:
  - Custom video player
  - Loading states
  - Error handling
  - Download capabilities

#### `UsageTracker`
- **Purpose**: Real-time usage monitoring
- **Features**:
  - Progress bars for each metric
  - Plan-specific limits
  - Usage warnings
  - Upgrade prompts

### UI Components
- **Consistent Design System**: HeroUI/NextUI components
- **Responsive Layout**: Mobile-first design approach
- **Accessibility**: ARIA labels and keyboard navigation
- **Dark Mode**: Theme support throughout

---

## State Management

### Custom Hooks

#### `useReels`
- **Purpose**: Reel state management
- **Features**:
  - Real-time status updates
  - Polling for in-progress reels
  - CRUD operations
  - Error handling

#### `useMedia`
- **Purpose**: Media file management
- **Features**:
  - Upload progress tracking
  - File organization
  - Download capabilities
  - Deletion with confirmation

#### `useScripts`
- **Purpose**: Script management
- **Features**:
  - CRUD operations
  - Real-time updates
  - Usage tracking integration

#### `useUsage`
- **Purpose**: Usage metrics tracking
- **Features**:
  - Real-time usage updates
  - Limit enforcement
  - Plan-specific calculations
  - Warning thresholds

#### `useAuth`
- **Purpose**: Authentication state
- **Features**:
  - Session management
  - Auto-refresh tokens
  - Role-based access
  - Redirect handling

### State Patterns
- **Optimistic Updates**: Immediate UI updates with rollback capability
- **Real-Time Sync**: Supabase subscriptions for live data
- **Local Caching**: Efficient data fetching and caching
- **Error Boundaries**: Graceful error handling throughout

---

## Payment Integration

### Stripe Integration
- **Subscription Model**: Usage-based billing tiers
- **Features**:
  - Multiple subscription plans
  - Usage overage handling
  - Automated billing cycles
  - Invoice generation

### Usage Tiers
- **Free Tier**: Limited monthly usage
- **Pro Tier**: Increased limits
- **Enterprise**: Custom limits and features

### Billing Features
- **Real-Time Usage Tracking**: Live usage monitoring
- **Usage Warnings**: Proactive limit notifications
- **Plan Upgrades**: Seamless subscription changes
- **Payment Methods**: Multiple payment options via Stripe

---

## Usage Tracking & Limits

### Tracked Metrics
- **Scripts per Month**: AI and manual script creation
- **Reels per Month**: Generated video content
- **Storage Usage**: Media file storage limits
- **API Calls**: Third-party service usage

### Enforcement
- **Pre-Flight Checks**: Validate limits before processing
- **Real-Time Updates**: Immediate usage metric updates
- **Graceful Degradation**: Informative error messages
- **Upgrade Prompts**: Strategic upgrade suggestions

### User Experience
- **Progress Indicators**: Visual usage progress bars
- **Warning Thresholds**: 80% usage warnings
- **Usage History**: Historical usage tracking
- **Plan Comparisons**: Clear upgrade paths

---

## Media Processing

### Upload Pipeline
1. **Client-Side Validation**: File type and size checks
2. **Supabase Storage**: Secure file upload to organized buckets
3. **Metadata Extraction**: Duration, resolution, file info
4. **AI Analysis**: Automatic image description generation
5. **Database Storage**: File metadata and relationships

### Storage Organization
```
media/
├── photos/
│   └── {user-id}/
│       └── {photo-id}.{ext}
├── videos/
│   └── {user-id}/
│       └── {video-id}.{ext}
├── audio/
│   └── {user-id}/
│       └── {audio-id}.{ext}
└── generated-reels/
    └── {user-id}/
        └── {reel-id}.mp4
```

### Processing Features
- **Thumbnail Generation**: Automatic video thumbnails
- **Format Validation**: Supported file type enforcement
- **Size Limits**: Per-file and total storage limits
- **CDN Integration**: Fast global content delivery

---

## Organization Management

### Multi-Tenant Architecture
- **Organization Isolation**: Complete data separation
- **Member Management**: Role-based team access
- **Subscription Sharing**: Organization-level billing
- **Resource Sharing**: Shared usage limits and media

### Features
- **Invitation System**: Email-based member invitations
- **Role Management**: Admin and member permissions
- **Usage Aggregation**: Organization-wide usage tracking
- **Billing Management**: Centralized subscription control

---

## User Interface

### Design System
- **Component Library**: HeroUI with Radix UI extensions
- **Styling**: Tailwind CSS with custom design tokens
- **Animations**: Framer Motion for smooth interactions
- **Icons**: Lucide React icon library

### Layout Structure
- **Sidebar Navigation**: Collapsible product-focused navigation
- **Top Navigation**: User account and organization switching
- **Content Areas**: Tabbed interfaces for different content types
- **Modal System**: Consistent modal patterns for forms

### Responsive Design
- **Mobile-First**: Optimized for mobile devices
- **Breakpoint System**: Consistent responsive behavior
- **Touch Interactions**: Mobile-optimized touch targets
- **Progressive Enhancement**: Core functionality on all devices

### Accessibility
- **ARIA Labels**: Comprehensive screen reader support
- **Keyboard Navigation**: Full keyboard accessibility
- **Color Contrast**: WCAG compliant color schemes
- **Focus Management**: Logical focus flow

---

## API Integration

### External APIs
- **Fal.ai**: AI model inference for scripts and image analysis
- **ElevenLabs**: Audio generation and transcription
- **Creatomate**: Video rendering and composition
- **Stripe**: Payment processing and subscription management

### API Patterns
- **Authentication**: Bearer token authentication
- **Error Handling**: Consistent error response format
- **Rate Limiting**: Built-in request throttling
- **Retry Logic**: Automatic retry for transient failures

### Performance Optimization
- **Connection Pooling**: Efficient database connections
- **Caching**: Strategic caching of AI responses
- **Compression**: Response compression for large payloads
- **CDN Integration**: Cached static asset delivery

---

## Deployment & Infrastructure

### Deployment Options
- **Vercel (Recommended)**: Seamless Next.js deployment
- **Edge Functions**: Supabase edge function deployment
- **Environment Variables**: Secure configuration management
- **Domain Configuration**: Custom domain support

### Environment Configuration
```env
# Core Infrastructure
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Payment Processing
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# AI Services
FAL_API_KEY=
ELEVENLABS_API_KEY=
CREATOMATE_API_KEY=
```

### Monitoring & Logging
- **Structured Logging**: JSON-formatted logs across edge functions
- **Performance Tracking**: Execution time monitoring
- **Error Tracking**: Comprehensive error logging
- **Usage Analytics**: Real-time usage metrics

### Security Considerations
- **Environment Isolation**: Separate dev/staging/production environments
- **Secret Management**: Secure API key storage
- **HTTPS Enforcement**: SSL/TLS for all communications
- **Data Encryption**: Encrypted data at rest and in transit

---

## Development Workflow

### Code Organization
- **TypeScript**: Full type safety throughout the application
- **ESLint/Prettier**: Consistent code formatting
- **Component Structure**: Modular, reusable components
- **Custom Hooks**: Business logic separation

### Testing Strategy
- **Type Safety**: TypeScript for compile-time error detection
- **Error Boundaries**: Runtime error handling
- **Manual Testing**: Comprehensive feature testing
- **Integration Testing**: End-to-end workflow validation

### Performance Considerations
- **Code Splitting**: Dynamic imports for large components
- **Image Optimization**: Next.js image optimization
- **Bundle Analysis**: Regular bundle size monitoring
- **Caching Strategy**: Effective caching at multiple levels

---

## Future Enhancement Opportunities

### Technical Improvements
- **Test Coverage**: Comprehensive automated testing
- **Performance Monitoring**: APM integration
- **Content Moderation**: AI-powered content filtering
- **Batch Processing**: Queue-based video generation

### Feature Enhancements
- **Template Editor**: Custom video template creation
- **Brand Kit**: Brand asset management
- **Analytics Dashboard**: Content performance metrics
- **API Access**: Public API for integrations

### Scalability Considerations
- **Microservices**: Service decomposition for scale
- **CDN Optimization**: Global content delivery
- **Database Optimization**: Query performance tuning
- **Caching Layers**: Multi-level caching strategy

---

This comprehensive documentation covers all major aspects of the CourtneyAI v5 application, from high-level architecture to implementation details. The application represents a sophisticated AI-powered content creation platform with enterprise-grade features including multi-tenancy, usage-based billing, and comprehensive media processing capabilities. 