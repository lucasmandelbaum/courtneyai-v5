# CourtneyAI v5 🎬

An AI-powered video creation platform that transforms product information into engaging video content and reels with intelligent subtitle generation and customizable text sizing.

## ✨ Features

- **🤖 AI Video Generation** - Create professional reels from product data
- **📝 Smart Script Generation** - AI-powered script creation and editing
- **🎙️ Voice Selection** - Choose from multiple ElevenLabs voices for text-to-speech generation
- **🎯 Customizable Subtitles** - Dynamic subtitle sizing (small, medium, large) for optimal readability
- **🖼️ Media Processing** - Advanced image and video upload/processing
- **🏢 Organization Management** - Multi-tenant architecture with team collaboration
- **💳 Billing & Usage Tracking** - Stripe integration with usage limits
- **🔐 Complete Authentication** - Secure auth with Supabase Auth
- **📊 Analytics Dashboard** - Track usage and performance metrics

## 🚀 Tech Stack

- **Frontend**: Next.js 15 with App Router, React 19, TypeScript
- **UI/UX**: NextUI, Framer Motion, Tailwind CSS, Radix UI
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Payments**: Stripe
- **Deployment**: Vercel (recommended)
- **Package Manager**: Yarn

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+ 
- Yarn
- Supabase CLI
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/lucasmandelbaum/courtneyai-v5.git
   cd courtneyai-v5
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your environment variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   STRIPE_SECRET_KEY=your_stripe_secret_key
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
   ```

4. **Start the development server**
   ```bash
   yarn dev
   ```

5. **Set up the database**
   ```bash
   # Run migrations to set up the voices table
   supabase migration up
   
   # Optional: Populate with additional voices
   supabase db reset --linked  # Or run the population script manually
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🏗️ Project Structure

```
courtneyai-v5/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   ├── (protected)/       # Protected routes
│   ├── api/               # API routes
│   ├── organization/      # Organization management
│   └── settings/          # User settings
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── reel-creator.tsx  # Main reel creation component
│   ├── script-generator.tsx # AI script generation
│   └── media-uploader.tsx # Media upload handling
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and configurations
├── supabase/             # Supabase configuration
│   ├── functions/        # Edge Functions
│   ├── migrations/       # Database migrations
│   └── scripts/          # Database utility scripts
└── types/                # TypeScript type definitions
```

## 🔧 Key Components

### Edge Functions
- `generate-reel/` - AI video generation with customizable subtitles
- `generate-script/` - Script creation
- `analyze-image/` - Image analysis
- `text-to-speech/` - Audio generation
- `stripe-webhooks/` - Payment processing

### Custom Hooks
- `useReels` - Reel management and state
- `useAuth` - Authentication state
- `useUsage` - Usage tracking and limits
- `useMedia` - Media handling
- `useProducts` - Product management

## 🚢 Deployment

### Vercel (Recommended)

1. **Connect to Vercel**
   ```bash
   vercel --prod
   ```

2. **Configure environment variables in Vercel dashboard**

3. **Set up Supabase Edge Functions**
   ```bash
   # Deploy all functions
   supabase functions deploy
   
   # Or deploy specific function with voice selection updates
   supabase functions deploy generate-reel
   ```

4. **Run database migrations for voice support**
   ```bash
   supabase migration up --linked
   ```

## 🔒 Environment Variables

Create a `.env.local` file with the following variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Optional: AI Services
OPENAI_API_KEY=
```

## 📚 API Documentation

### Edge Functions

- `POST /api/edge/generate-reel` - Generate video content with AI-powered subtitles
- `POST /api/edge/generate-script` - Create AI scripts
- `POST /api/edge/analyze-image` - Analyze product images
- `POST /api/edge/text-to-speech` - Convert text to audio

#### Generate Reel API

**Endpoint**: `POST /api/edge/generate-reel`

**Request Body**:
```json
{
  "productId": "string",
  "scriptId": "string",
  "photoIds": ["string"],
  "videoIds": ["string"],
  "title": "string",
  "fontSize": "small" | "medium" | "large",  // optional
  "voiceId": "string"  // optional - ElevenLabs voice ID
}
```

**Subtitle Font Sizes**:
- `small`: 4 vmin (compact subtitles)
- `medium`: 6.5 vmin (default, balanced visibility)
- `large`: 9 vmin (maximum accessibility)

**Voice Selection**:
- `voiceId`: Optional ElevenLabs voice ID from the voices table
- If not provided, uses the default voice from the database
- Falls back to "Brittney" (kPzsL2i3teMYv0FxEYQ6) if no default is set

**Response**:
```json
{
  "message": "Reel creation started",
  "reel_id": "string",
  "status": 200,
  "usage": {
    "currentUsage": number,
    "limit": number,
    "planName": "string"
  }
}
```

### REST API

- `GET /api/stripe/create-checkout-session` - Create payment session
- `POST /api/stripe/cancel-subscription` - Cancel subscription

## 🎙️ Voice Management

### Database Schema

The voices table stores available ElevenLabs voices with the following structure:

```sql
CREATE TABLE voices (
  id UUID PRIMARY KEY,
  voice_id TEXT UNIQUE NOT NULL,      -- ElevenLabs voice ID
  name TEXT NOT NULL,                 -- Display name
  description TEXT,                   -- Voice description
  category TEXT NOT NULL,             -- professional, social_media, etc.
  gender TEXT,                        -- male, female, neutral
  age TEXT,                          -- young, middle_aged, old
  accent TEXT,                       -- american, british, etc.
  use_case TEXT,                     -- informative_educational, etc.
  descriptive TEXT,                  -- casual, energetic, etc.
  preview_url TEXT,                  -- Sample audio URL
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Adding New Voices

1. **Via SQL (recommended)**:
   ```sql
   INSERT INTO voices (voice_id, name, description, category, gender, age, accent, use_case, descriptive, is_active)
   VALUES ('your_voice_id', 'Voice Name', 'Description', 'professional', 'male', 'young', 'american', 'social_media', 'energetic', true);
   ```

2. **Via population script**:
   ```bash
   # Edit supabase/scripts/populate_voices.sql
   # Then run:
   supabase db reset --linked
   ```

### Setting Default Voice

```sql
-- Unset current default
UPDATE voices SET is_default = false WHERE is_default = true;

-- Set new default
UPDATE voices SET is_default = true WHERE voice_id = 'your_preferred_voice_id';
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

For support, email support@courtneyai.com or create an issue in this repository.

## 🔗 Links

- [Live Demo](https://courtneyai-v5.vercel.app)
- [Documentation](https://docs.courtneyai.com)
- [Supabase Dashboard](https://supabase.com/dashboard)
- [Stripe Dashboard](https://dashboard.stripe.com)

---

Made with ❤️ by [Lucas Mandelbaum](https://github.com/lucasmandelbaum) 