# CourtneyAI v5 🎬

An AI-powered video creation platform that transforms product information into engaging video content and reels.

## ✨ Features

- **🤖 AI Video Generation** - Create professional reels from product data
- **📝 Smart Script Generation** - AI-powered script creation and editing
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

5. **Open your browser**
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
│   └── migrations/       # Database migrations
└── types/                # TypeScript type definitions
```

## 🔧 Key Components

### Edge Functions
- `generate-reel/` - AI video generation
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
   supabase functions deploy
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

- `POST /api/edge/generate-reel` - Generate video content
- `POST /api/edge/generate-script` - Create AI scripts
- `POST /api/edge/analyze-image` - Analyze product images
- `POST /api/edge/text-to-speech` - Convert text to audio

### REST API

- `GET /api/stripe/create-checkout-session` - Create payment session
- `POST /api/stripe/cancel-subscription` - Cancel subscription

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