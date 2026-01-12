
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

    This application uses **Google Gemini API** for AI features (food safety, mapping) and **Firebase** for OTP authentication.

    - Create a new file named `.env` in the root directory.
    - Copy the contents from `.env.example` and fill in your actual keys.

    ```env
    # Google Gemini API
    API_KEY=your_google_gemini_api_key

    # Firebase Config (Optional - For Real OTP)
    FIREBASE_API_KEY=your_firebase_api_key
    FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
    FIREBASE_PROJECT_ID=your_project_id
    FIREBASE_STORAGE_BUCKET=your_project.appspot.com
    FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    FIREBASE_APP_ID=your_app_id
    ```

    > **Simulation Mode:** If you do not provide Firebase keys (or leave them as placeholders), the app will automatically run in **Simulation Mode**. OTPs will be mocked and displayed in an in-app notification for testing purposes.

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
