# MEALers connect

A streamlined platform connecting food donors, volunteers, and orphanages to eliminate food waste and fight hunger.

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)

## Getting Started

1.  **Install Dependencies**

    Open a terminal in the project root directory and run:
    ```bash
    npm install
    ```

2.  **Configure Environment Variables**

    This application uses the Google Gemini API for AI features (food safety analysis, mapping, etc.). You must provide a valid API key.

    - Create a new file named `.env` in the root directory.
    - Add your API key to it (see `.env.example` for reference):

    ```env
    API_KEY=your_google_gemini_api_key_here
    ```

3.  **Run the Application**

    Start the local development server:
    ```bash
    npm run dev
    ```

4.  **Open in Browser**

    Navigate to the URL displayed in your terminal (usually `http://localhost:5173`).

## Building for Production

To create an optimized build for deployment:

```bash
npm run build
```
The output will be generated in the `dist` folder.

5.  **Link of web**

    https://genesis-project--aaryankai145.replit.app
