import json
import os
from pathlib import Path
from typing import Any

import requests
from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "problems.json"

app = Flask(__name__, static_folder=None)


def load_problems() -> dict[str, dict[str, Any]]:
    with DATA_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def fallback_answer(problem: dict[str, Any], question: str) -> str:
    text = question.lower()
    if "why" in text or "cause" in text:
        return f"The most likely cause is {problem['rootCause']}. {problem['summary']}"
    if "best" in text or "decision" in text or "recommend" in text:
        return "The recommended decision is to " + problem["actions"][0].lower() + " Then " + problem["actions"][1].lower()
    if "delay" in text or "wait" in text or "risk" in text:
        return f"Delaying action may increase customer complaints and reduce the performance of {problem['service']}."
    return f"PulseBank AI recommends prioritizing {problem['title']} and following the proposed action plan because it is currently classified as {problem['priority']} priority."


def ask_gemini(problem: dict[str, Any], question: str) -> str | None:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    prompt = f"""
You are PulseBank AI, a concise banking operations decision-support assistant.
Use only the supplied simulated incident data. Do not claim access to real bank systems.

Incident:
{json.dumps(problem, ensure_ascii=False)}

Manager question: {question}

Answer in clear professional English in no more than 90 words. Give a direct recommendation when relevant.
""".strip()

    try:
        response = requests.post(
            url,
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        return payload["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (requests.RequestException, KeyError, IndexError, TypeError):
        return None


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "PulseBank AI Backend"})


@app.get("/api/problems")
def problems():
    return jsonify(list(load_problems().values()))


@app.get("/api/problems/<problem_id>")
def problem_details(problem_id: str):
    problem = load_problems().get(problem_id)
    if not problem:
        return jsonify({"error": "Problem not found"}), 404
    return jsonify(problem)


@app.post("/api/analyze")
def analyze():
    payload = request.get_json(silent=True) or {}
    problem_id = payload.get("problem_id", "otp")
    problem = load_problems().get(problem_id)
    if not problem:
        return jsonify({"error": "Problem not found"}), 404
    return jsonify({"source": "backend", "analysis": problem})


@app.post("/api/ask")
def ask():
    payload = request.get_json(silent=True) or {}
    problem_id = payload.get("problem_id", "otp")
    question = str(payload.get("question", "")).strip()
    if not question:
        return jsonify({"error": "Question is required"}), 400

    problem = load_problems().get(problem_id)
    if not problem:
        return jsonify({"error": "Problem not found"}), 404

    gemini_answer = ask_gemini(problem, question)
    return jsonify({
        "answer": gemini_answer or fallback_answer(problem, question),
        "source": "gemini" if gemini_answer else "backend-fallback",
    })


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/<path:filename>")
def static_files(filename: str):
    return send_from_directory(BASE_DIR, filename)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG") == "1")
