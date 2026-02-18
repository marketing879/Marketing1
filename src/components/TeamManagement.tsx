// src/components/TeamManagement.tsx
import React, { useState } from "react";
import { useUser } from "../contexts/UserContext";
import AddNewUserForm from "./AddNewUserForm"; // Updated import

export const TeamManagement: React.FC = () => {
  const { teamMembers, deleteTeamMember, tasks } = useUser();
  const [showAddForm, setShowAddForm] = useState(false);

  const handleDeleteMember = (memberId: string) => {
    const member = teamMembers.find((m) => m.id === memberId);
    if (!member) return;

    const tasksAssigned = tasks.filter(
      (task) => task.assignedTo === member.name
    );
    const confirmMessage =
      tasksAssigned.length > 0
        ? `${member.name} has ${tasksAssigned.length} task(s) assigned. Deleting will unassign these tasks. Continue?`
        : `Are you sure you want to delete ${member.name}?`;

    if (window.confirm(confirmMessage)) {
      deleteTeamMember(memberId);
    }
  };

  const getTaskCount = (memberName: string) => {
    return tasks.filter((task) => task.assignedTo === memberName).length;
  };

  const getRoleBadgeColor = (role: string) => {
    if (role.includes("Senior")) return "bg-purple-100 text-purple-800";
    if (role.includes("Lead")) return "bg-blue-100 text-blue-800";
    if (role.includes("Designer")) return "bg-pink-100 text-pink-800";
    if (role.includes("Editor")) return "bg-green-100 text-green-800";
    if (role.includes("Writer")) return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
  };

  const doers = teamMembers.filter((m) => m.isDoer !== false);
  const nonDoers = teamMembers.filter((m) => m.isDoer === false);

  if (showAddForm) {
    return (
      <AddNewUserForm
        onSuccess={() => setShowAddForm(false)}
        onCancel={() => setShowAddForm(false)}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Team Management</h2>
          <p className="text-gray-600 mt-1">
            {teamMembers.length} total members ({doers.length} doers,{" "}
            {nonDoers.length} non-doers)
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          + Add Team Member
        </button>
      </div>

      {/* Doers Section */}
      {doers.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span>👥 Doers</span>
            <span className="text-sm font-normal text-gray-500">
              (Can be assigned tasks)
            </span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {doers.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 text-lg mb-1">
                      {member.name}
                    </h3>
                    {member.email && (
                      <p className="text-sm text-gray-500 mb-2">
                        {member.email}
                      </p>
                    )}
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(
                        member.role
                      )}`}
                    >
                      {member.role}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteMember(member.id)}
                    className="text-red-500 hover:text-red-700 transition-colors ml-2"
                    title="Delete member"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {getTaskCount(member.name)} task(s)
                    </span>
                    <span className="text-xs text-gray-400">
                      ID: {member.id}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Non-Doers Section */}
      {nonDoers.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span>👔 Non-Doers</span>
            <span className="text-sm font-normal text-gray-500">
              (Cannot be assigned tasks)
            </span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nonDoers.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-shadow opacity-75"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 text-lg mb-1">
                      {member.name}
                    </h3>
                    {member.email && (
                      <p className="text-sm text-gray-500 mb-2">
                        {member.email}
                      </p>
                    )}
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(
                        member.role
                      )}`}
                    >
                      {member.role}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteMember(member.id)}
                    className="text-red-500 hover:text-red-700 transition-colors ml-2"
                    title="Delete member"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <span className="text-xs text-gray-400">ID: {member.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {teamMembers.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow-md">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <p className="text-lg">No team members yet</p>
          <p className="text-sm mt-1">
            Click "Add Team Member" to create your first team member
          </p>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
