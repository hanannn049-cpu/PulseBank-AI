# PulseBank AI

AI-powered banking decision-support prototype.

## Run locally

```bash
pip install -r requirements.txt
python app.py
```

Open: `http://127.0.0.1:5000`

> Do not open `index.html` directly. The API features require Flask to be running.

## Optional Gemini integration

Set `GEMINI_API_KEY` in your environment or Replit Secrets. Without it, the built-in backend fallback still answers demo questions.
