# Casa Inteligente APP - Security & Domotics Management

## Setup

1.  **Install Dependencies**: (Done)
    `npm install`

2.  **Environment Variables**:
    Copy `.env.example` to `.env.local` and fill in your Supabase details.
    
    ```bash
    cp .env.example .env.local
    ```

    Required variables:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3.  **Run Development Server**:
    
    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser.

## Features

- **Projects Dashboard**: Kanban board with drag-and-drop project management.
- **Budget ROI**: Real-time margin calculation on project cards.
- **Supabase Integration**: Server Actions for data fetching and updates.
- **UI**: Built with Tailwind CSS and Shadcn/UI components.

## Structure

- `/app`: Next.js App Router pages and API actions.
- `/components`: UI components (Shadcn) and Dashboard features.
- `/lib`: Utilities and Supabase clients.
- `/types`: TypeScript interfaces.
