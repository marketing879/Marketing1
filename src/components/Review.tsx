// src/components/Review.tsx
import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";

const Review: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getTaskById, updateTask } = useUser();

  const task = getTaskById(id!);
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState(0);

  if (!task) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Task not found
          </h2>
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
            onClick={() => navigate("/")}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleApprove = () => {
    if (rating === 0) {
      alert("Please provide a rating before approving");
      return;
    }
    updateTask(task.id, { status: "completed" });
    alert("Task approved and marked as completed!");
    navigate("/");
  };

  const handleRequestChanges = () => {
    if (!feedback.trim()) {
      alert("Please provide feedback for the required changes");
      return;
    }
    updateTask(task.id, { status: "in-progress" });
    alert("Task sent back for revisions");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            className="text-blue-500 hover:text-blue-700 font-medium mb-4"
            onClick={() => navigate(`/task/${task.id}`)}
          >
            ← Back to Task
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Review Task</h1>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Task Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {task.title}
            </h2>
            <p className="text-gray-600 mb-6">{task.description}</p>

            <div className="space-y-4">
              <div className="border-t pt-4">
                <span className="text-sm font-medium text-gray-700">
                  Assigned To:
                </span>
                <p className="text-gray-900">{task.assignedTo}</p>
              </div>

              <div className="border-t pt-4">
                <span className="text-sm font-medium text-gray-700">
                  Priority:
                </span>
                <div className="mt-2">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      task.priority === "high"
                        ? "bg-red-100 text-red-700"
                        : task.priority === "medium"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {task.priority.charAt(0).toUpperCase() +
                      task.priority.slice(1)}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4">
                <span className="text-sm font-medium text-gray-700">
                  Due Date:
                </span>
                <p className="text-gray-900">{task.dueDate}</p>
              </div>
            </div>
          </div>

          {/* Review Form */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6">
              Provide Review
            </h3>

            {/* Rating */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Rate the work quality
              </label>
              <div className="flex space-x-2 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    className={`text-3xl transition ${
                      rating >= star
                        ? "text-yellow-400"
                        : "text-gray-300 hover:text-yellow-300"
                    }`}
                    onClick={() => setRating(star)}
                  >
                    ★
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-600">
                {rating === 0 && "Click to rate"}
                {rating === 1 && "Poor"}
                {rating === 2 && "Fair"}
                {rating === 3 && "Good"}
                {rating === 4 && "Very Good"}
                {rating === 5 && "Excellent"}
              </p>
            </div>

            {/* Feedback */}
            <div className="mb-6">
              <label
                htmlFor="feedback"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Feedback & Comments
              </label>
              <textarea
                id="feedback"
                placeholder="Provide feedback or comments about this task..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium transition"
                onClick={handleRequestChanges}
              >
                Request Changes
              </button>
              <button
                className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition"
                onClick={handleApprove}
              >
                Approve & Complete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Review;
