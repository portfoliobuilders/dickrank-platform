# DickRank.online

[![Vercel](https://img.shields.io/badge/Vercel-Deployed-black)](https://dickrank.online)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green)](https://supabase.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> The premier platform for adult content discovery, ranking, and creator monetization.

[Live Demo](https://dickrank.online) · [Documentation](./docs) · [API Reference](./docs/api.md)

Overview

DickRank.online is a community-driven platform for adult content ranking, creator monetization, and event management. Built with Next.js 14, TypeScript, Supabase, and Tailwind CSS.

Features
- 🏆 Content ranking & leaderboards
- 💰 Creator subscription system
- 🎉 Real-time matching & events
- 🤖 AI-powered content moderation
- 📊 Advanced analytics & insights

Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS + shadcn/ui
- **Hosting**: Vercel
- **Payments**: Stripe

Getting Started

Prerequisites
- Node.js 18+
- npm or pnpm
- Supabase account

Installation

```bash
# Clone the repository
git clone https://github.com/portfolioxtech/dickrank-platform.git
cd dickrank-platform

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

Project Structure

```
dickrank-platform/
├── apps/
│   └── web/                 # Next.js application
├── packages/
│   ├── ui/                  # Shared UI components
│   └── database/            # Database schema & types
├── docs/                    # Documentation
└── scripts/                 # Utility scripts
```

Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Note**: This is an adult content platform. All users must be 18+ and content must comply with applicable laws.
