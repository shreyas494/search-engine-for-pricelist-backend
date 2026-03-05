# Deployment Guide: Vercel & Render

Your application has been refactored for optimal performance and split deployment. Follow these steps to deploy.

## 1. Backend Deployment (Render)

1.  Push your code to GitHub.
2.  Log in to [Render](https://render.com/).
3.  Click **New +** -> **Web Service**.
4.  Connect your GitHub repository.
5.  **Settings**:
    -   **Name**: `search-engine-backend` (or similar)
    -   **Root Directory**: `backend` (Important!)
    -   **Runtime**: `Node`
    -   **Build Command**: `npm install`
    -   **Start Command**: `npm start`
6.  **Environment Variables** (Advanced):
    -   `NODE_ENV`: `production`
    -   `MONGO_URI`: *[Copy from your local `backend/.env` or the `mongodb...txt` file]*
    -   `FRONTEND_URL`: *[Leave empty for now]*
7.  Click **Create Web Service**.
8.  **Copy the Backend URL** (e.g., `https://search-engine-backend.onrender.com`).

## 2. Frontend Deployment (Vercel)

1.  Log in to [Vercel](https://vercel.com/).
2.  Click **Add New...** -> **Project**.
3.  Import your GitHub repository.
4.  **Settings**:
    -   **Framework Preset**: Vite (should be auto-detected).
    -   **Root Directory**: `frontend` (Click "Edit" next to Root Directory).
5.  **Environment Variables**:
    -   `VITE_API_URL`: Paste your Render Backend URL (e.g., `https://search-engine-backend.onrender.com`).
6.  Click **Deploy**.
7.  **Copy the Frontend URL** (e.g., `https://search-engine-frontend.vercel.app`).

## 3. Final Connection

1.  Go back to **Render Dashboard** -> **Environment**.
2.  Add/Update `FRONTEND_URL` with your **Vercel Frontend URL**.
3.  The backend will auto-redeploy.

## Local Development

-   **Backend**: `cd backend && npm start` (Runs on port 5000)
-   **Frontend**: `cd frontend && npm run dev` (Runs on port 5173, connects to localhost:5000)


## 🚀 Alternatives (Non-Sleep Platforms)

If you don't want to use a free plan that sleeps, consider these options:
-   **Render (Starter Plan)**: $7/month – No sleep, reliable.
-   **Railway.app**: ~$5/month – No sleep, very easy setup.
-   **DigitalOcean / Hetzner**: $4-5/month – A "VPS" that is 100% yours and never sleeps.
