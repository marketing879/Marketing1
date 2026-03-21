/**
 * ExportCredentialsButton
 *
 * Superadmin-only button that downloads all users + their OTP passwords
 * as a formatted .xlsx file using exceljs library.
 *
 * Installation (if not already installed):
 *   npm install exceljs
 */

import React, { useState } from "react";
import ExcelJS from "exceljs";
import { useUser } from "../contexts/UserContext";

// ── Types mirroring what's stored in UserContext ──────────────────────────
interface StoredUserRow {
  "#": string;
  "Full Name": string;
  Email: string;
  Role: string;
  "OTP / Password": string;
}

// Hardcoded default passwords — keep in sync with UserContext defaultUsers
// (The context intentionally strips passwords before exposing teamMembers.)
const DEFAULT_PASSWORDS: Record<string, string> = {
  "pushkaraj.gore@roswalt.com": "100001",
  "aziz.khan@roswalt.com": "100002",
  "vinay.vanmali@roswalt.com": "100003",
  "jalal.shaikh@roswalt.com": "100004",
  "nidhi.mehta@roswalt.com": "100005",
  "keerti.barua@roswalt.com": "100006",
  "hetal.makwana@roswalt.com": "100007",
  "prathamesh.chile@roswalt.com": "100008",
  "samruddhi.shivgan@roswalt.com": "100009",
  "irfan.ansari@roswalt.com": "100010",
  "vishal.chaudhary@roswalt.com": "100011",
  "mithilesh.menge@roswalt.com": "100012",
  "jai.bhojwani@roswalt.com": "100013",
  "vikrant.pabrekar@roswalt.com": "100014",
  "gaurav.chavan@roswalt.com": "100015",
  "harish.utkam@roswalt.com": "100016",
  "siddhesh.achari@roswalt.com": "100017",
  "raj.vichare@roswalt.com": "100018",
  "rohan.fernandes@roswalt.com": "100019",
  "vaibhavi.gujjeti@roswalt.com": "100020",
};

const roleOrder: Record<string, number> = { superadmin: 0, admin: 1, staff: 2 };

const ExportCredentialsButton: React.FC = () => {
  const { user, teamMembers } = useUser();
  const [exporting, setExporting] = useState(false);

  // Only superadmins should see/use this button
  if (user?.role !== "superadmin") return null;

  const handleExport = async () => {
    setExporting(true);

    try {
      // Sort: superadmin → admin → staff
      const sorted = [...teamMembers].sort(
        (a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9)
      );

      // Build row data
      const rows: StoredUserRow[] = sorted.map((member, idx) => ({
        "#": String(idx + 1),
        "Full Name": member.name,
        Email: member.email,
        Role: member.role.charAt(0).toUpperCase() + member.role.slice(1),
        "OTP / Password": DEFAULT_PASSWORDS[member.email.toLowerCase()] ?? "—",
      }));

      // Create workbook and worksheet
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("User Credentials");

      // Add headers
      ws.columns = [
        { header: "#", key: "#", width: 5 },
        { header: "Full Name", key: "Full Name", width: 30 },
        { header: "Email", key: "Email", width: 36 },
        { header: "Role", key: "Role", width: 14 },
        { header: "OTP / Password", key: "OTP / Password", width: 18 },
      ];

      // Add rows
      rows.forEach((row) => {
        ws.addRow(row);
      });

      // Style headers
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFC9A96E" },
      };
      ws.getRow(1).font = { bold: true, color: { argb: "FF050510" } };

      // Download
      await wb.xlsx.writeFile(
        `Roswalt_Credentials_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      title="Download all user credentials as Excel"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 18px",
        background: exporting
          ? "rgba(255,255,255,0.1)"
          : "linear-gradient(90deg, #16a34a, #15803d)",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "8px",
        fontWeight: "600",
        fontSize: "14px",
        cursor: exporting ? "not-allowed" : "pointer",
        transition: "all 0.2s ease",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) => {
        if (!exporting) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 8px 20px rgba(22,163,74,0.35)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Excel icon */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
      {exporting ? "Exporting…" : "Export Credentials (.xlsx)"}
    </button>
  );
};

export default ExportCredentialsButton;

/*
──────────────────────────────────────────────────────────────────
USAGE — drop this anywhere in your superadmin dashboard/header:

  import ExportCredentialsButton from "./ExportCredentialsButton";

  // Inside your JSX:
  <ExportCredentialsButton />

The button is invisible to non-superadmin users (returns null).
──────────────────────────────────────────────────────────────────
*/
