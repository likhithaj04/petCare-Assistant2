import React, { useState } from "react";
import ReactMarkdown from "react-markdown";

export default function Query() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const handleQuery = async () => {
    if (!question.trim()) return;

    setLoading(true);

    try {
      const res = await fetch("https://petcare-assistant2.onrender.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      setAnswer(data.answer);
    } catch (error) {
      console.error(error);
      setAnswer("Error fetching answer. Please try again.");
    }

    setLoading(false);
  };

  const handleClear = () => {
    setQuestion("");
    setAnswer("");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center items-center p-6">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">
            Pet Care Assistant 🐾
          </h1>
          <p className="text-gray-600 mt-2">
            Ask anything about your pet
          </p>
        </div>

        {/* Input Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <textarea
            rows={6}
            placeholder="Any queries on your pet?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full border border-gray-300 rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex gap-4 mt-4">
            <button
              onClick={handleQuery}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              {loading ? "Thinking..." : "Submit"}
            </button>

            <button
              onClick={handleClear}
              className="bg-gray-200 text-gray-800 px-6 py-2 rounded-xl hover:bg-gray-300 transition"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Answer Card */}
        {answer && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Answer
            </h2>

            <div className="prose max-w-none">
              <ReactMarkdown>{answer}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}