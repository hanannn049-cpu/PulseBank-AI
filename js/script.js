const fallbackProblems = {
  otp: {
    id: "otp", title: "OTP Service Delay",
    summary: "OTP complaints increased by 48% within one day, affecting transfer verification.",
    rootCause: "SMS Gateway Latency", confidence: "96%", priority: "High",
    service: "OTP / Transfers", badge: "High Priority",
    actions: ["Switch OTP messages to backup SMS provider.", "Test OTP gateway response time.", "Notify affected customers.", "Monitor complaints for 24 hours."],
    impact: ["Complaints -35%", "Success Rate +18%", "Response Time Faster"]
  }
};

function currentProblemId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || localStorage.getItem("pulsebank_problem_id") || "otp";
}

async function fetchProblem(id) {
  try {
    const response = await fetch(`/api/problems/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error("Problem request failed");
    return await response.json();
  } catch (error) {
    console.warn("Using local fallback data:", error);
    return fallbackProblems[id] || fallbackProblems.otp;
  }
}

async function loadAnalysis() {
  const id = currentProblemId();
  localStorage.setItem("pulsebank_problem_id", id);
  const p = await fetchProblem(id);

  const setText = (elementId, value) => {
    const element = document.getElementById(elementId);
    if (element) element.textContent = value;
  };

  setText("analysisTitle", p.title);
  setText("analysisSummary", p.summary);
  setText("rootCause", p.rootCause);
  setText("confidence", p.confidence);
  setText("priority", p.priority);
  setText("affectedService", p.service);
  setText("analysisBadge", p.badge || `${p.priority} Priority`);

  const actionPlan = document.getElementById("actionPlan");
  if (actionPlan) {
    actionPlan.innerHTML = "";
    (p.actions || []).forEach(action => {
      const item = document.createElement("li");
      item.textContent = action;
      actionPlan.appendChild(item);
    });
  }

  const impactBox = document.getElementById("impactBox");
  if (impactBox) {
    const impact = p.impact || [];
    impactBox.innerHTML = `
      <div class="impact-item red-soft"><span>${impact[0] || "Complaints reduced"}</span></div>
      <div class="impact-item green-soft"><span>${impact[1] || "Success rate improved"}</span></div>
      <div class="impact-item blue-soft"><span>${impact[2] || "Response time improved"}</span></div>
    `;
  }

  const assistantLink = document.querySelector('a[href="assistant.html"]');
  if (assistantLink) assistantLink.href = `assistant.html?id=${encodeURIComponent(id)}`;
}

function quickAsk(question) {
  const input = document.getElementById("userQuestion");
  if (!input) return;
  input.value = question;
  askAI();
}

async function askAI() {
  const input = document.getElementById("userQuestion");
  const chatBox = document.getElementById("chatBox");
  if (!input || !chatBox) return;

  const question = input.value.trim();
  if (!question) return;

  const userMessage = document.createElement("div");
  userMessage.className = "message user";
  userMessage.textContent = question;
  chatBox.appendChild(userMessage);
  input.value = "";

  const loadingMessage = document.createElement("div");
  loadingMessage.className = "message ai";
  loadingMessage.textContent = "Analyzing...";
  chatBox.appendChild(loadingMessage);
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problem_id: currentProblemId(), question })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "AI request failed");
    loadingMessage.textContent = data.answer;
  } catch (error) {
    loadingMessage.textContent = "The assistant could not connect to the backend. Please run the project through app.py.";
    console.error(error);
  }

  chatBox.scrollTop = chatBox.scrollHeight;
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("userQuestion");
  if (input) {
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") askAI();
    });
  }
});
