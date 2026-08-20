# 🌊 موج (Wave) - Social Audio Platform

**موج** is an open-source social audio platform. It allows users to record and share short audio clips, engage with a community, and participate in a token-based economy. Our goal is to create a fast, modern, and interactive space for audio creators.

![SvelteKit](https://img.shields.io/badge/SvelteKit-5.x-FF3E00?style=flat&logo=svelte)
![Supabase](https://img.shields.io/badge/Supabase-3.x-3ECF8E?style=flat&logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-06B6D4?style=flat&logo=tailwindcss)

---

## ✨ Features

### Core Features (MVP)
- **🔐 Authentication:** Sign up and log in with Email/Password or Google OAuth.
- **🎵 Audio Waves:** Record and publish short audio clips (under 60 seconds for "short" waves).
- **📱 Social Feed:** Browse a dynamic feed of waves from the community, with a dedicated section for "Short Waves" (like stories).
- **❤️ Reactions:** React to waves with a variety of emojis, similar to Telegram.
- **💬 Comments:** Leave text comments on any wave, with real-time display.
- **👤 User Profiles:** View user profiles, their published waves, and follower counts.
- **👥 Follow System:** Follow other users to stay updated with their content.

### Advanced Features
- **🚀 Wave Boosting:** Spend earned tokens to boost your wave, making it more visible for 24 hours.
- **👥 Referral System:** Invite friends using a unique code and earn tokens when they join.
- **💰 Token Economy:** Earn tokens through daily rewards, publishing waves, receiving likes, and referring friends.
- **📊 User Analytics:** Each user has a personal analytics dashboard showing their stats, engagement score, and achievements.
- **🗂️ Categories:** Filter waves by category (e.g., Music, Education, News).
- **🔍 Search:** Search for waves, users, and categories.
- **🏠 Wave Rooms:** Join a real-time chat room for each wave to discuss with other listeners.

---

## 🧱 Tech Stack

- **Frontend:** [SvelteKit 5](https://kit.svelte.dev/) (with Runes)
- **Backend & Database:** [Supabase](https://supabase.com/) (PostgreSQL, Auth, Storage, Realtime)
- **Styling:** CSS-in-JS with a Facebook-inspired UI design.
- **State Management:** Svelte's built-in stores and Runes (`$state`, `$derived`, `$effect`).
- **Language:** TypeScript

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or later)
- [npm](https://www.npmjs.com/) (v9 or later)
- A [Supabase](https://supabase.com/) account (free tier is fine)

### 🛠️ Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/RashidBik/muj.git
    cd muj